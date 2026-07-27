# GifToFrames Decision Record

Date checked: 2026-07-27

## Target Task

US English users need to extract complete still frames from an animated GIF in their browser and download the frames as ordered image files.

## Historical Attachment Notes

The provided screenshot is treated only as historical third-party research. It suggested:

- `gif to frames` had tool intent and low Ahrefs KD around 3 at the time of the screenshot.
- The trend screenshot showed rising interest for related GIF frame extraction queries.
- Historical competitors included Ezgif, OnlineGIFTools/Browserling, Convertio and older utility interfaces.
- A GitHub GIF converter repository was mentioned as a technical clue, not as code to copy.

These historical metrics are not used as current facts.

## Screenshot Section 6 Technical Advice Review

The later screenshot section titled "technical implementation proposal" was reviewed separately on 2026-07-27.

Source implementation reference:

- `https://github.com/puzdjX/Gif-To-Frames-Converter` exists. `git ls-remote` returned HEAD `76956fd8735ef67ebf495a28f354dea46be4c675`; latest checked commit date was 2025-04-07.
- The repository is MIT licensed and uses `libgif.js/SuperGif`.
- Its product ideas include file upload, drag/drop, progress, thumbnail frame extraction from a full GIF canvas, modal preview, sprite sheet generation, and local browser processing.

Decision:

- Use now: product-level ideas for drag/drop, progress, cancellation, local processing disclosure, preview, and avoiding raw patch thumbnails.
- Use with changes: full-frame extraction concept. This site uses `gifuct-js` plus a tested compositor in a Web Worker instead of copying the older `libgif.js` implementation.
- Postpone: sprite sheet export. It is useful, but version one prioritizes verified frame extraction, selection, and ZIP downloads.
- Avoid: copying source code or bundled old library code into this project.
- Avoid: converting popular third-party GIFs into many indexable download pages. That requires explicit media rights, provenance, takedown handling, unique page value, quality controls, and a non-doorway architecture. Without those controls it creates copyright, platform, thin-page, and search-spam risk.
- Test small after launch: infer legitimate follow-up tools from real user feedback or GSC queries, then build only tools with independent utility and manageable risk.
- Use carefully: distribution/backlinks. Create relevant, disclosed, editorial links such as repository README, launch notes, or community answers where the tool genuinely helps. Do not batch-submit low-quality links, buy links, automate outreach spam, or depend on backlinks as a ranking promise.

## Current SERP And Demand Evidence

Observed on 2026-07-27 from current English web results for `gif to frames`, `extract frames from gif`, `split gif into frames`, and `gif to png frames`:

- Dominant intent: tool/converter. Results repeatedly present upload boxes or one-step split/extract tools rather than long informational articles.
- Visible competitors: Ezgif split GIF into frames, Online GIF Tools GIF frame extractor, W3Schools GIF frame extractor, ImageOnline GIF splitter, WuTools GIF to frames, Aspose/GroupDocs style converter pages, exact-match domains such as `giftoframes.com`, and several small micro-tool domains.
- SERP gap: many tools are visually old, ad-heavy, server-upload based, unclear about privacy, or vague about full-frame composition versus raw frame patches.
- Independent demand signal: the same task appears across multiple query phrasings and competitor tools, and users search both action words (`extract`, `split`) and output words (`png frames`, `frame extractor`).

Verdict: **build**.

Rationale: demand and intent are clear, the product can be built as a low-cost static site, risk is manageable with authorization/privacy controls, and there is room to differentiate on reliable composition, local processing clarity, mobile UX, and accurate limits.

## Build / Test Small / Postpone / Avoid Decisions

Build:

- Homepage browser-local GIF frame extractor.
- Guide page covering steps, timing, transparency, disposal, limits, failures, privacy and legitimate use.
- Privacy, Terms, real 404, robots, sitemap, OG/Twitter and JSON-LD.
- PNG default, WebP where browser-supported, JPEG with user-selected background and quality.
- ZIP export of all or selected frames with ordered filenames.

Test small:

- Post-launch content refresh based on GSC queries and task completion events if analytics is later added.
- Potential troubleshooting module if support/search evidence shows repeated failure patterns.

Postpone:

- Sprite sheet export. It has possible utility but was not required to satisfy the primary SERP intent and should not dilute core reliability.
- Multilingual versions. No current evidence was collected for non-English demand plus translation maintenance.
- Analytics. The first version avoids analytics to keep privacy simple; add only minimized task events later if needed.
- Scenario-specific follow-up tools. Build only after GSC/user feedback shows a distinct second task.

Avoid:

- Third-party URL fetching, protected-media downloading, public result pages, UGC galleries, account systems, or server-side file retention.
- Doorway pages for minor keyword variants.
- Copying competitor copy, screenshots, or older GitHub GIF decoder code.
- Mass pages built from unlicensed popular GIFs or celebrity/brand GIF searches.
- Batch backlink submission, paid links, reciprocal schemes, or community spam.

## Risk Decision

Feature/data/content: user-selected GIF files and generated frame images.

Legitimate user and authorized task: users extracting frames from GIFs they own or are allowed to process.

Potential harmful/prohibited use: unauthorized copying of copyrighted GIFs, attempts to fetch third-party protected files, accidental upload/logging of user media.

Rights/source/terms: sample GIF and fixtures are generated in this repository. Open-source dependencies must be reviewed before launch. No competitor content is copied.

Personal/sensitive data flow: GIF bytes and frame pixels remain in browser memory. No analytics, accounts, uploads, database, or crash-reporting service are included. The static host receives normal page/asset requests and may log IP/user-agent per its platform behavior.

Public/indexable behavior: only finished static pages are indexable; user files/results are never public URLs.

Controls and residual risk: file-type validation, resource limits, cancellation, error states, reset cleanup, clear legal-use terms, and no URL fetcher.

Outcome: **allow with controls**.

Reviewer/date: Codex, 2026-07-27.

Recheck trigger: adding analytics, uploads, URL fetching, UGC, ads, affiliate links, public examples from third parties, or a new export format.

## Minimum Useful Product

Acceptance criteria:

- Drag/drop and file picker accept GIF files and reject non-GIF files.
- Safe example GIF is generated in-project and loadable from the first screen.
- Worker parses animated GIFs and returns width, height, file size, frame count, total duration and per-frame delay.
- Frame composition handles transparent pixels, interlacing through decoder output, local frame rectangles, disposal 2 and disposal 3.
- UI supports playback, pause, scrubber, previous/next, current frame label, stable thumbnail grid, keyboard focus and 390px mobile width.
- Selection supports all, none, range, individual frame toggles, single-frame download, and selected/all ZIP export.
- Export defaults to PNG with transparency; WebP is offered only if the browser supports encoding; JPEG requires a background color and quality.
- Progress, cancellation, success, invalid file, corrupt GIF, resource-limit, memory and reset states are visible and accurate.
- Reset revokes object URLs and clears large arrays.

## URL/Page Map

| URL | Intent | Index/canonical | Notes |
| --- | --- | --- | --- |
| `/` | GIF to frames tool, extract frames from GIF, split GIF into PNG frames | index, canonical `https://www.giftoframes.net/` | Primary tool and concise supporting content |
| `/guide/` | How to extract frames from a GIF | index, canonical `https://www.giftoframes.net/guide/` | Independent how-to/troubleshooting guide |
| `/privacy/` | Privacy disclosure | index, canonical `https://www.giftoframes.net/privacy/` | Matches actual no-upload/no-analytics behavior |
| `/terms/` | Terms and authorized-use limits | index, canonical `https://www.giftoframes.net/terms/` | Clarifies user rights and limitations |
| `/404.html` | Not found | no sitemap, canonical omitted | Real 404 page for Vercel fallback |

## Launch Metrics

No analytics in version one. Initial review uses:

- Vercel deployment status, logs, response codes and errors.
- Google Search Console indexing, sitemap, selected canonical, queries and countries after ownership is configured.
- Manual product checks and user feedback.

## Expansion/Stop Thresholds

Expand only if GSC shows distinct query intent or user feedback that cannot be handled on the homepage/guide. Stop or merge if pages duplicate the same extraction task, if maintenance cannot keep claims true, or if abuse/rights risk increases.

## Open Assumptions

- The current target market is US English.
- Search Console indexing and query evidence must be reviewed after the new property has collected data.

## Resolved Launch Facts

- GitHub and Vercel access were completed through their web interfaces.
- Namecheap DNS control was confirmed. Both apex A endpoints timed out from the launch network, so the final compatible setup uses an apex ALIAS and `www` CNAME to the same Vercel project target.
- `www.giftoframes.net` is the HTTPS production host; the apex domain redirects to it with Vercel's permanent `308` configuration.
- Google Search Console domain ownership was verified by DNS TXT and the canonical sitemap was submitted successfully with four discovered pages.
- Version one remains analytics-free, with no cookies or file-content telemetry added during deployment.
