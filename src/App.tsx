import {
  AlertTriangle,
  CheckSquare,
  Download,
  FileImage,
  Info,
  LoaderCircle,
  Package,
  Pause,
  Play,
  RotateCcw,
  Scissors,
  ShieldCheck,
  SkipBack,
  SkipForward,
  Square,
  Upload,
  X
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { LIMITS, SAMPLE_GIF_PATH } from './lib/constants';
import { canEncodeWebP, downloadBlob, formatToExtension, frameToBlob, framesToZipBlob } from './lib/exporters';
import { clamp, formatBytes, formatDuration } from './lib/format';
import { createFullSelection, makeFrameFileName, makeZipFileName, parseFrameRange, sortedSelection } from './lib/selection';
import type { ComposedGifFrame, DecodeErrorCode, DecodeProgress, DecodeResult, ExportFormat, ExportOptions } from './lib/types';

type NoticeKind = 'info' | 'error' | 'success';

interface Notice {
  kind: NoticeKind;
  title: string;
  detail?: string;
}

interface WorkerResponse {
  type: 'progress' | 'complete' | 'error';
  jobId: string;
  progress?: DecodeProgress;
  result?: DecodeResult;
  code?: DecodeErrorCode;
  message?: string;
}

interface ExportState {
  mode: 'single' | 'zip';
  completed: number;
  total: number;
  currentName: string;
}

export function App() {
  const [result, setResult] = useState<DecodeResult | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isDecoding, setIsDecoding] = useState(false);
  const [progress, setProgress] = useState<DecodeProgress | null>(null);
  const [notice, setNotice] = useState<Notice>({
    kind: 'info',
    title: 'Choose a GIF to begin.',
    detail: 'Files are decoded locally in this browser. The current guardrails are 25 MB, 500 frames, and 4 million pixels per frame.'
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [rangeInput, setRangeInput] = useState('');
  const [format, setFormat] = useState<ExportFormat>('png');
  const [jpegBackground, setJpegBackground] = useState('#ffffff');
  const [jpegQuality, setJpegQuality] = useState(0.92);
  const [webpSupported] = useState(() => (typeof document === 'undefined' ? false : canEncodeWebP()));
  const [exportState, setExportState] = useState<ExportState | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const jobIdRef = useRef<string>('');
  const exportCancelRef = useRef(false);

  const frames = useMemo(() => result?.frames ?? [], [result]);
  const summary = result?.summary ?? null;
  const currentFrame = frames[currentIndex] ?? null;
  const selectedIndexes = useMemo(() => sortedSelection(selected, frames.length), [frames.length, selected]);
  const exportOptions: ExportOptions = useMemo(
    () => ({ format, jpegBackground, jpegQuality }),
    [format, jpegBackground, jpegQuality]
  );
  const selectedCount = selectedIndexes.length;
  const allSelected = frames.length > 0 && selectedCount === frames.length;
  const selectionSummary =
    frames.length === 0 ? 'No frames selected.' : `${selectedCount} of ${frames.length} frames selected.`;

  useEffect(() => {
    if (!isPlaying || frames.length === 0) return undefined;
    const delay = Math.max(frames[currentIndex]?.delayMs ?? 100, 20);
    const timer = window.setTimeout(() => {
      setCurrentIndex((index) => (index + 1) % frames.length);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [currentIndex, frames, isPlaying]);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  function resetTool(nextNotice?: Notice) {
    workerRef.current?.terminate();
    workerRef.current = null;
    jobIdRef.current = '';
    exportCancelRef.current = true;
    setResult(null);
    setSelected(new Set());
    setCurrentIndex(0);
    setIsDragging(false);
    setIsDecoding(false);
    setProgress(null);
    setIsPlaying(false);
    setRangeInput('');
    setExportState(null);
    setNotice(
      nextNotice ?? {
        kind: 'info',
        title: 'Ready for another GIF.',
        detail: 'The previous frame arrays and temporary download URLs have been released by the app.'
      }
    );
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function cancelDecode() {
    const worker = workerRef.current;
    const jobId = jobIdRef.current;
    if (worker && jobId) {
      worker.postMessage({ type: 'cancel', jobId });
      worker.terminate();
    }
    workerRef.current = null;
    jobIdRef.current = '';
    setIsDecoding(false);
    setProgress(null);
    setNotice({ kind: 'info', title: 'Decode cancelled.', detail: 'No frame data was kept.' });
  }

  async function handleFile(file: File | null | undefined) {
    if (!file) return;
    workerRef.current?.terminate();
    setIsPlaying(false);
    setResult(null);
    setSelected(new Set());
    setCurrentIndex(0);
    setProgress({ phase: 'reading', progress: 0.02, message: 'Reading the selected file...' });
    setIsDecoding(true);
    setNotice({ kind: 'info', title: 'Reading GIF...', detail: file.name });

    const isGif = file.type === 'image/gif' || /\.gif$/i.test(file.name);
    if (!isGif) {
      setIsDecoding(false);
      setProgress(null);
      setNotice({
        kind: 'error',
        title: 'That file is not a GIF.',
        detail: 'Choose a .gif file. Renamed videos, WebP files, and still images are not accepted.'
      });
      return;
    }

    if (file.size > LIMITS.maxFileBytes) {
      setIsDecoding(false);
      setProgress(null);
      setNotice({
        kind: 'error',
        title: 'This GIF is above the current browser guardrail.',
        detail: `${formatBytes(file.size)} selected. The current limit is ${formatBytes(LIMITS.maxFileBytes)}.`
      });
      return;
    }

    let buffer: ArrayBuffer;
    try {
      buffer = await file.arrayBuffer();
    } catch {
      setIsDecoding(false);
      setProgress(null);
      setNotice({
        kind: 'error',
        title: 'The browser could not read this file.',
        detail: 'This can happen when browser memory is low or the file is no longer available.'
      });
      return;
    }

    const jobId = createJobId();
    const worker = new Worker(new URL('./workers/gifWorker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    jobIdRef.current = jobId;

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      if (message.jobId !== jobIdRef.current) return;

      if (message.type === 'progress' && message.progress) {
        setProgress(message.progress);
        setNotice({ kind: 'info', title: message.progress.message });
      }

      if (message.type === 'complete' && message.result) {
        worker.terminate();
        workerRef.current = null;
        jobIdRef.current = '';
        setResult(message.result);
        setSelected(createFullSelection(message.result.frames.length));
        setCurrentIndex(0);
        setIsDecoding(false);
        setProgress(null);
        setNotice({
          kind: 'success',
          title: 'GIF decoded successfully.',
          detail: `${message.result.summary.frameCount} frames composed at ${message.result.summary.width}x${message.result.summary.height}.`
        });
      }

      if (message.type === 'error') {
        worker.terminate();
        workerRef.current = null;
        jobIdRef.current = '';
        setIsDecoding(false);
        setProgress(null);
        setNotice({
          kind: message.code === 'cancelled' ? 'info' : 'error',
          title: errorTitle(message.code),
          detail: message.message
        });
      }
    };

    worker.onerror = () => {
      worker.terminate();
      workerRef.current = null;
      jobIdRef.current = '';
      setIsDecoding(false);
      setProgress(null);
      setNotice({
        kind: 'error',
        title: 'The browser worker failed.',
        detail: 'Try resetting the tool or using a smaller GIF.'
      });
    };

    worker.postMessage({ type: 'decode', jobId, buffer, fileName: file.name, fileSize: file.size }, [buffer]);
  }

  async function loadSample() {
    setNotice({ kind: 'info', title: 'Loading the sample GIF...' });
    try {
      const response = await fetch(SAMPLE_GIF_PATH);
      if (!response.ok) throw new Error(`Sample request returned ${response.status}.`);
      const blob = await response.blob();
      const sample = new File([blob], 'giftoframes-sample.gif', { type: 'image/gif', lastModified: 1_782_432_000_000 });
      await handleFile(sample);
    } catch (error) {
      setNotice({
        kind: 'error',
        title: 'Sample GIF could not be loaded.',
        detail: error instanceof Error ? error.message : 'The sample file is unavailable.'
      });
      setIsDecoding(false);
      setProgress(null);
    }
  }

  function selectAll() {
    setSelected(createFullSelection(frames.length));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function toggleFrame(index: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function applyRange() {
    try {
      setSelected(parseFrameRange(rangeInput, frames.length));
      setNotice({ kind: 'success', title: 'Range selected.', detail: rangeInput.trim() || 'Selection cleared.' });
    } catch (error) {
      setNotice({
        kind: 'error',
        title: 'Range could not be applied.',
        detail: error instanceof Error ? error.message : 'Use a range such as 1-8.'
      });
    }
  }

  async function downloadSingle(frame: ComposedGifFrame) {
    setExportState({ mode: 'single', completed: 0, total: 1, currentName: 'Encoding frame...' });
    try {
      const blob = await frameToBlob(frame, exportOptions);
      const extension = formatToExtension(format);
      const fileName = makeFrameFileName(summary?.name ?? 'gif', frame.index, frames.length, extension);
      downloadBlob(blob, fileName);
      setExportState(null);
      setNotice({ kind: 'success', title: 'Frame downloaded.', detail: fileName });
    } catch (error) {
      setExportState(null);
      setNotice({ kind: 'error', title: 'Frame export failed.', detail: errorMessage(error) });
    }
  }

  async function downloadZip(mode: 'all' | 'selected') {
    const indexes = mode === 'all' ? frames.map((frame) => frame.index) : selectedIndexes;
    const framesToExport = indexes.map((index) => frames[index]).filter(Boolean);
    if (framesToExport.length === 0) {
      setNotice({ kind: 'error', title: 'No frames selected.', detail: 'Select at least one frame before downloading a ZIP.' });
      return;
    }

    exportCancelRef.current = false;
    setExportState({ mode: 'zip', completed: 0, total: framesToExport.length, currentName: 'Preparing export...' });
    try {
      const blob = await framesToZipBlob(framesToExport, summary?.name ?? 'gif', exportOptions, {
        shouldCancel: () => exportCancelRef.current,
        onProgress: (completed, total, currentName) => {
          setExportState({ mode: 'zip', completed, total, currentName });
        }
      });
      const zipName = makeZipFileName(summary?.name ?? 'gif', mode);
      downloadBlob(blob, zipName);
      setExportState(null);
      setNotice({ kind: 'success', title: 'ZIP downloaded.', detail: `${framesToExport.length} ordered files in ${zipName}.` });
    } catch (error) {
      setExportState(null);
      if (error instanceof DOMException && error.name === 'AbortError') {
        setNotice({ kind: 'info', title: 'Export cancelled.', detail: 'No ZIP was downloaded.' });
      } else {
        setNotice({ kind: 'error', title: 'ZIP export failed.', detail: errorMessage(error) });
      }
    }
  }

  function cancelExport() {
    exportCancelRef.current = true;
  }

  const progressPercent = Math.round((progress?.progress ?? 0) * 100);
  const exportPercent = exportState ? Math.round((exportState.completed / Math.max(exportState.total, 1)) * 100) : 0;

  return (
    <>
      <header className="site-header">
        <a className="brand" href="/" aria-label="GifToFrames home">
          <img src="/favicon.svg" alt="" width="32" height="32" />
          <span>GifToFrames</span>
        </a>
        <nav className="top-nav" aria-label="Primary navigation">
          <a href="/guide/">Guide</a>
          <a href="/blog/">Blog</a>
          <a href="/privacy/">Privacy</a>
          <a href="/terms/">Terms</a>
        </nav>
      </header>

      <main className="shell">
        <section className="tool-hero" aria-labelledby="page-title">
          <div className="tool-copy">
            <p className="eyebrow">GIF frame extractor</p>
            <h1 id="page-title">Extract complete frames from a GIF</h1>
            <p>
              Split an animated GIF into composed PNG frames in your browser, preview timing, pick exact frame ranges, and
              export ordered files without uploading the GIF to a conversion server.
            </p>
            <div className="privacy-note">
              <ShieldCheck size={20} aria-hidden="true" />
              <span>
                Processing runs in browser memory. The static host serves the app files, but this version has no analytics,
                account system, URL fetcher, or server-side GIF upload.
              </span>
            </div>
          </div>

          <section className="drop-panel" aria-label="Upload GIF">
            <label
              className={`drop-zone ${isDragging ? 'is-dragging' : ''}`}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                void handleFile(event.dataTransfer.files[0]);
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/gif,.gif"
                onChange={(event) => void handleFile(event.target.files?.[0])}
              />
              <span className="drop-inner">
                <span className="drop-icon">
                  <Upload size={26} aria-hidden="true" />
                </span>
                <span className="drop-title">Drop a GIF or choose a file</span>
                <span className="drop-copy">
                  Guardrails: {formatBytes(LIMITS.maxFileBytes)}, {LIMITS.maxFrames} frames, {LIMITS.maxPixelsPerFrame.toLocaleString()} pixels per frame.
                </span>
                <span className="button-row" aria-hidden="true">
                  <span className="btn">Choose GIF</span>
                </span>
              </span>
            </label>

            <div className="button-row" style={{ marginTop: '1rem' }}>
              <button className="btn secondary" type="button" onClick={() => void loadSample()} disabled={isDecoding} title="Load the repository-owned sample GIF">
                <FileImage size={18} aria-hidden="true" />
                Try sample GIF
              </button>
              <button className="btn secondary" type="button" onClick={() => resetTool()} title="Reset the current GIF">
                <RotateCcw size={18} aria-hidden="true" />
                Reset
              </button>
              {isDecoding ? (
                <button className="btn warning" type="button" onClick={cancelDecode} title="Cancel GIF decoding">
                  <X size={18} aria-hidden="true" />
                  Cancel
                </button>
              ) : null}
            </div>

            <StatusBox notice={notice} progress={progress} progressPercent={progressPercent} exportState={exportState} exportPercent={exportPercent} onCancelExport={cancelExport} />
          </section>
        </section>

        {summary ? (
          <section className="workspace" aria-label="GIF frame workspace">
            <section className="preview-panel">
              <div className="panel-heading">
                <div>
                  <h2>Preview</h2>
                  <p title={summary.name}>{summary.name}</p>
                </div>
              </div>

              <div className="viewer" aria-label="Current composed frame preview">
                {currentFrame ? <FrameCanvas frame={currentFrame} label={`Frame ${currentIndex + 1}`} /> : null}
              </div>

              <div className="playback-controls">
                <div className="toolbar" aria-label="Playback controls">
                  <button className="icon-btn secondary" type="button" onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))} disabled={currentIndex === 0} title="Previous frame">
                    <SkipBack size={18} aria-hidden="true" />
                    <span className="sr-only">Previous frame</span>
                  </button>
                  <button className="icon-btn" type="button" onClick={() => setIsPlaying((value) => !value)} title={isPlaying ? 'Pause animation' : 'Play animation'}>
                    {isPlaying ? <Pause size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
                    <span className="sr-only">{isPlaying ? 'Pause animation' : 'Play animation'}</span>
                  </button>
                  <button className="icon-btn secondary" type="button" onClick={() => setCurrentIndex((index) => Math.min(frames.length - 1, index + 1))} disabled={currentIndex >= frames.length - 1} title="Next frame">
                    <SkipForward size={18} aria-hidden="true" />
                    <span className="sr-only">Next frame</span>
                  </button>
                </div>
                <label className="scrubber">
                  <span className="sr-only">Frame scrubber</span>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0, frames.length - 1)}
                    value={currentIndex}
                    onChange={(event) => setCurrentIndex(Number(event.target.value))}
                  />
                  <span className="frame-label">
                    {currentIndex + 1} / {frames.length} - {formatDuration(currentFrame?.delayMs ?? 0)}
                  </span>
                </label>
              </div>

              <div className="stats-grid" aria-label="GIF details">
                <Stat label="Size" value={`${summary.width} x ${summary.height}`} />
                <Stat label="File" value={formatBytes(summary.size)} />
                <Stat label="Frames" value={String(summary.frameCount)} />
                <Stat label="Duration" value={formatDuration(summary.totalDurationMs)} />
              </div>

              <div className="frame-grid" aria-label="Extracted frame thumbnails">
                {frames.map((frame) => (
                  <article
                    className={`thumb-card ${frame.index === currentIndex ? 'is-current' : ''} ${selected.has(frame.index) ? 'is-selected' : ''}`}
                    key={frame.index}
                  >
                    <button
                      className="thumb-canvas-wrap"
                      type="button"
                      onClick={() => setCurrentIndex(frame.index)}
                      title={`Show frame ${frame.index + 1}`}
                    >
                      <FrameCanvas frame={frame} label={`Thumbnail frame ${frame.index + 1}`} />
                    </button>
                    <div className="thumb-meta">
                      <span>#{frame.index + 1}</span>
                      <span>{formatDuration(frame.delayMs)}</span>
                    </div>
                    <div className="thumb-actions">
                      <button
                        className="icon-btn secondary"
                        type="button"
                        onClick={() => toggleFrame(frame.index)}
                        title={selected.has(frame.index) ? 'Remove frame from selection' : 'Add frame to selection'}
                        aria-pressed={selected.has(frame.index)}
                      >
                        {selected.has(frame.index) ? <CheckSquare size={16} aria-hidden="true" /> : <Square size={16} aria-hidden="true" />}
                        <span className="sr-only">{selected.has(frame.index) ? 'Selected' : 'Not selected'}</span>
                      </button>
                      <button className="icon-btn secondary" type="button" onClick={() => void downloadSingle(frame)} title={`Download frame ${frame.index + 1}`}>
                        <Download size={16} aria-hidden="true" />
                        <span className="sr-only">Download frame {frame.index + 1}</span>
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <aside className="side-panel">
              <div className="toolbox">
                <section className="tool-section" aria-labelledby="selection-title">
                  <h2 id="selection-title">Selection</h2>
                  <p className="selection-summary">{selectionSummary}</p>
                  <div className="toolbar">
                    <button className="btn secondary" type="button" onClick={selectAll} disabled={allSelected} title="Select every frame">
                      <CheckSquare size={17} aria-hidden="true" />
                      All
                    </button>
                    <button className="btn secondary" type="button" onClick={clearSelection} disabled={selectedCount === 0} title="Clear selected frames">
                      <Square size={17} aria-hidden="true" />
                      None
                    </button>
                  </div>
                  <div className="range-row">
                    <label>
                      <span className="sr-only">Frame range</span>
                      <input
                        type="text"
                        inputMode="text"
                        placeholder="1-8, 12"
                        value={rangeInput}
                        onChange={(event) => setRangeInput(event.target.value)}
                      />
                    </label>
                    <button className="btn secondary" type="button" onClick={applyRange} title="Select the entered frame range">
                      <Scissors size={17} aria-hidden="true" />
                      Select range
                    </button>
                  </div>
                </section>

                <section className="tool-section" aria-labelledby="export-title">
                  <h2 id="export-title">Export</h2>
                  <div className="format-row">
                    <label>
                      <span className="sr-only">Output format</span>
                      <select value={format} onChange={(event) => setFormat(event.target.value as ExportFormat)}>
                        <option value="png">PNG transparent</option>
                        <option value="webp" disabled={!webpSupported}>
                          WebP {webpSupported ? '' : '(unsupported)'}
                        </option>
                        <option value="jpeg">JPEG</option>
                      </select>
                    </label>
                  </div>

                  {format === 'jpeg' ? (
                    <>
                      <div className="format-row">
                        <label>
                          <span className="sr-only">JPEG background color</span>
                          <input type="color" value={jpegBackground} onChange={(event) => setJpegBackground(event.target.value)} />
                        </label>
                        <span className="selection-summary">JPEG background {jpegBackground.toUpperCase()}</span>
                      </div>
                      <label className="quality-row">
                        <span className="selection-summary">JPEG quality {Math.round(jpegQuality * 100)}%</span>
                        <input
                          type="range"
                          min={0.5}
                          max={1}
                          step={0.01}
                          value={jpegQuality}
                          onChange={(event) => setJpegQuality(clamp(Number(event.target.value), 0.5, 1))}
                        />
                      </label>
                    </>
                  ) : null}

                  <p className="selection-summary">
                    Output size: {summary.width}x{summary.height}. Names use <code>{`${summary.name.replace(/\.[^.]+$/, '')}_frame_0001.${formatToExtension(format)}`}</code>.
                  </p>

                  <div className="export-grid">
                    <button className="btn" type="button" onClick={() => currentFrame && void downloadSingle(currentFrame)} disabled={!currentFrame || !!exportState} title="Download the current frame">
                      <Download size={17} aria-hidden="true" />
                      Current frame
                    </button>
                    <button className="btn secondary" type="button" onClick={() => void downloadZip('selected')} disabled={selectedCount === 0 || !!exportState} title="Download selected frames as a ZIP">
                      <Package size={17} aria-hidden="true" />
                      Selected ZIP
                    </button>
                    <button className="btn secondary" type="button" onClick={() => void downloadZip('all')} disabled={frames.length === 0 || !!exportState} title="Download every frame as a ZIP">
                      <Package size={17} aria-hidden="true" />
                      All ZIP
                    </button>
                  </div>
                </section>

                <section className="tool-section" aria-labelledby="details-title">
                  <h2 id="details-title">Frame data</h2>
                  <p className="selection-summary">
                    Current patch: {currentFrame?.patchWidth ?? 0}x{currentFrame?.patchHeight ?? 0} at {currentFrame?.left ?? 0},{currentFrame?.top ?? 0}. Disposal method: {currentFrame?.disposalType ?? 0}.
                  </p>
                </section>
              </div>
            </aside>
          </section>
        ) : null}

        <section className="content-section" aria-labelledby="how-it-works">
          <h2 id="how-it-works">Local GIF frame extraction</h2>
          <p>
            GifToFrames decodes a GIF in a Web Worker, composes each full display frame, and lets the browser export image files. PNG keeps
            transparent pixels. JPEG uses the background color you choose because the JPEG format has no alpha channel.
          </p>
          <p>
            The extractor is built for authorized files: GIFs you created, own, or have permission to process. It does not fetch third-party
            URLs, download protected media, create public galleries, or store results after you leave the page.
          </p>
          <p>
            Need the full workflow and troubleshooting details? <a href="/guide/">Read the GIF frame extraction guide</a>.
          </p>
        </section>
      </main>
    </>
  );
}

function StatusBox({
  notice,
  progress,
  progressPercent,
  exportState,
  exportPercent,
  onCancelExport
}: {
  notice: Notice;
  progress: DecodeProgress | null;
  progressPercent: number;
  exportState: ExportState | null;
  exportPercent: number;
  onCancelExport: () => void;
}) {
  return (
    <div className={`status-box ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'} aria-live="polite">
      <div className="button-row" style={{ justifyContent: 'flex-start' }}>
        {notice.kind === 'error' ? <AlertTriangle size={18} aria-hidden="true" /> : null}
        {notice.kind === 'success' ? <CheckSquare size={18} aria-hidden="true" /> : null}
        {notice.kind === 'info' ? <Info size={18} aria-hidden="true" /> : null}
        <strong>{notice.title}</strong>
      </div>
      {notice.detail ? <p>{notice.detail}</p> : null}
      {progress ? (
        <>
          <div className="progress-track" aria-label={`${progress.phase} progress`}>
            <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
          <p>{progressPercent}%</p>
        </>
      ) : null}
      {exportState ? (
        <>
          <div className="button-row" style={{ justifyContent: 'space-between', marginTop: '0.75rem' }}>
            <span>
              <LoaderCircle size={16} aria-hidden="true" /> Exporting {exportState.completed}/{exportState.total}
            </span>
            <button className="btn warning" type="button" onClick={onCancelExport} title="Cancel export">
              <X size={16} aria-hidden="true" />
              Cancel export
            </button>
          </div>
          <div className="progress-track" aria-label={`${exportState.mode} export progress`}>
            <div className="progress-fill" style={{ width: `${exportPercent}%` }} />
          </div>
          <p>{exportState.currentName}</p>
        </>
      ) : null}
    </div>
  );
}

function FrameCanvas({ frame, label }: { frame: ComposedGifFrame; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = frame.width;
    canvas.height = frame.height;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, frame.width, frame.height);
    context.putImageData(new ImageData(new Uint8ClampedArray(frame.pixels), frame.width, frame.height), 0, 0);
  }, [frame]);

  return <canvas ref={canvasRef} width={frame.width} height={frame.height} aria-label={label} />;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong title={value}>{value}</strong>
    </div>
  );
}

function createJobId(): string {
  if ('randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function errorTitle(code: DecodeErrorCode | undefined): string {
  if (code === 'resource-limit') return 'This GIF exceeds the browser guardrails.';
  if (code === 'corrupt-gif') return 'This GIF appears to be damaged or unsupported.';
  if (code === 'browser-memory') return 'The browser ran out of memory.';
  if (code === 'cancelled') return 'Decode cancelled.';
  if (code === 'invalid-file') return 'Invalid file.';
  return 'GIF decoding failed.';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The export could not be completed.';
}
