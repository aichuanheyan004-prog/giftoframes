import { readFile } from 'node:fs/promises'

const host = 'www.giftoframes.net'
const origin = 'https://' + host
const key = '13072be3caea795ef0319e71c4cc6d5c7a3c14237c7b830862fb47b0671acfa4'
const keyLocation = origin + '/' + key + '.txt'
const endpoint = 'https://api.indexnow.org/indexnow'
const args = new Set(process.argv.slice(2))
const live = args.has('--live')
const skipKeyCheck = args.has('--skip-key-check')

const xml = await readFile('public/sitemap.xml', 'utf8')
const urlList = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1].trim())
if (urlList.length === 0) throw new Error('No URLs found in public/sitemap.xml')

const invalid = urlList.filter((url) => {
  try {
    const parsed = new globalThis.URL(url)
    return parsed.host !== host || parsed.origin !== origin
  } catch {
    return true
  }
})
if (invalid.length > 0) throw new Error('Sitemap contains non-canonical URLs: ' + invalid.join(', '))

if (!live) {
  globalThis.console.log('[dry-run] IndexNow payload:')
  globalThis.console.log(JSON.stringify({ host, keyLocation, urlList: [...new Set(urlList)] }, null, 2))
  globalThis.console.log('Run with --live after production deploy to submit these URLs.')
  process.exit(0)
}

if (!skipKeyCheck) {
  const response = await globalThis.fetch(keyLocation, { cache: 'no-store' })
  const body = (await response.text()).trim()
  if (!response.ok || body !== key) throw new Error('IndexNow key is not publicly verifiable at ' + keyLocation)
}

const response = await globalThis.fetch(endpoint, {
  method: 'POST',
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host, key, keyLocation, urlList: [...new Set(urlList)] }),
})
const body = await response.text()
if (![200, 202].includes(response.status)) throw new Error('IndexNow submission failed: ' + response.status + ' ' + body)
globalThis.console.log(JSON.stringify({ submitted: new Set(urlList).size, status: response.status, body }, null, 2))
