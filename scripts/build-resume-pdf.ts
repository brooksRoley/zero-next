/**
 * Builds public/Brooks_Roley.pdf from src/lib/resume.ts.
 *
 * The PDF used to be a hand export from a separate document, and it carried
 * misspellings for over a year because nothing tied it to the page. Now the
 * page and the attachment come from the same data: change resume.ts, run
 * `yarn resume:pdf`, commit both.
 *
 * Needs Google Chrome (headless print-to-PDF). Set CHROME_PATH to override.
 */
import { execFileSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { EDUCATION, EXPERIENCE, INTERLUDE, LOCATION, SKILLS, SUMMARY } from '../src/lib/resume'

// The email appears on the PDF only, never in the page's HTML. Kept in pieces
// so a plain-text scrape of this repository doesn't lift it whole. No phone
// number: this repository and the PDF are both public.
const EMAIL = ['brooksroley', 'gmail.com'].join('@')
const LINKS = ['linkedin.com/in/brooksroley', 'github.com/brooksroley', 'brooksroley.com']

const CHROME =
  process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const OUT = path.join(process.cwd(), 'public', 'Brooks_Roley.pdf')

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const roles = EXPERIENCE.map((r, i) => {
  const interlude = i === INTERLUDE.afterIndex ? `<p class="interlude">${esc(INTERLUDE.text)}</p>` : ''
  return `<section class="role">
    <div class="role-head"><h3>${esc(r.org)} <span>— ${esc(r.role)}</span></h3><p class="dates">${esc(r.dates)}</p></div>
    <ul>${r.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
  </section>${interlude}`
}).join('')

const skills = SKILLS.map(
  (g) => `<div class="skill"><h4>${esc(g.label)}</h4><p>${g.items.map(esc).join(', ')}</p></div>`
).join('')

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Brooks Roley — Resume</title>
<style>
  @page { size: Letter; margin: 0.55in 0.6in; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font: 9.4pt/1.42 "Helvetica Neue", Helvetica, Arial, sans-serif; color: #1c2321; }
  header { display: flex; justify-content: space-between; align-items: flex-end; gap: 24pt;
           border-bottom: 1.2pt solid #1f5c3a; padding-bottom: 8pt; margin-bottom: 10pt; }
  h1 { font-size: 23pt; font-weight: 700; letter-spacing: -0.3pt; line-height: 1.1; }
  .title { color: #1f5c3a; font-size: 10.5pt; font-weight: 600; margin-top: 2pt; }
  .contact { text-align: right; font-size: 8.6pt; line-height: 1.5; color: #3c4744; }
  .summary { font-size: 9.8pt; margin-bottom: 12pt; }
  .cols { display: grid; grid-template-columns: 1fr 1.72in; column-gap: 20pt; }
  h2 { font-size: 8.2pt; text-transform: uppercase; letter-spacing: 1.1pt; color: #1f5c3a;
       margin-bottom: 6pt; }
  .role { margin-bottom: 9pt; break-inside: avoid; }
  .role-head { display: flex; justify-content: space-between; align-items: baseline; gap: 10pt; }
  h3 { font-size: 10.2pt; font-weight: 700; }
  h3 span { font-weight: 400; }
  .dates { font-size: 8.6pt; color: #56625e; white-space: nowrap; }
  ul { margin: 3pt 0 0 12pt; }
  li { margin-bottom: 2pt; }
  .interlude { font-style: italic; color: #3c4744; margin: 0 0 9pt; }
  aside h2:not(:first-child) { margin-top: 14pt; }
  .skill { margin-bottom: 7pt; break-inside: avoid; }
  h4 { font-size: 8.8pt; font-weight: 700; }
  .skill p, .edu { font-size: 8.8pt; color: #2c3532; }
</style></head>
<body>
  <header>
    <div><h1>Brooks Roley</h1><p class="title">Software Engineer · ${esc(LOCATION)}</p></div>
    <div class="contact">${EMAIL}<br>${LINKS.join(' · ')}</div>
  </header>
  <p class="summary">${esc(SUMMARY)}</p>
  <div class="cols">
    <main><h2>Experience</h2>${roles}</main>
    <aside>
      <h2>Skills</h2>${skills}
      <h2>Education</h2>
      <p class="edu"><strong>${esc(EDUCATION.school)}</strong><br>${esc(EDUCATION.degree)}, ${esc(EDUCATION.year)}</p>
    </aside>
  </div>
</body></html>`

if (!fs.existsSync(CHROME)) {
  console.error(`Chrome not found at ${CHROME}. Set CHROME_PATH to a Chrome or Chromium binary.`)
  process.exit(1)
}
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'resume-'))
const src = path.join(dir, 'resume.html')
fs.writeFileSync(src, html)
const startedAt = Date.now()
try {
  execFileSync(CHROME, [
    '--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--no-first-run',
    '--disable-extensions', '--use-mock-keychain', '--password-store=basic',
    `--user-data-dir=${path.join(dir, 'profile')}`,
    `--print-to-pdf=${OUT}`, `file://${src}`,
  ], { stdio: 'ignore', timeout: 45_000, killSignal: 'SIGKILL' })
} catch {
  // Headless Chrome on macOS sometimes writes the file and then never exits.
  // The timeout kills it; whether the build worked is decided by the file below.
}
try {
  // Helper processes can outlive the kill; they all carry the profile path.
  execFileSync('pkill', ['-f', dir], { stdio: 'ignore' })
} catch {
  // nothing left to stop
}
fs.rmSync(dir, { recursive: true, force: true })
if (!fs.existsSync(OUT) || fs.statSync(OUT).mtimeMs < startedAt) {
  console.error('Chrome did not write the PDF.')
  process.exit(1)
}
console.log(`Wrote ${path.relative(process.cwd(), OUT)} (${fs.statSync(OUT).size} bytes)`)
