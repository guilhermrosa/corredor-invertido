// Highlight shots for docs/evolucao: one picture per version that shows what that version changed,
// which the fixed menu / floor / roof shots (always the first metres of a run) often miss.
// Each entry in versions.json may carry `destaque`: { legenda, ate, desde, metros, depois, set, seed,
// charon }. The version is taken from git, tools/highlight.html is copied in and plays that version's
// own sim with the autopilot from a fixed seed until `ate` (a JS expression over an obstacle `o` and
// the sim `S`, e.g. "o.topple && o.z > 5 && o.z < 9") holds for some obstacle, past `desde` metres
// (or simply until `metros`), runs `depois` more frames, applies `set` to the sim and draws one frame.
// `charon: true` instead opens the real page and shows its Charon screen.
//
//   node tools/capture-highlights.cjs 0.54=HEAD 0.50=719e9b8 ...   (label=commit)
//
// Needs Playwright with Chromium. Writes docs/evolucao/img/<label>-destaque.jpg.
const { chromium } = require('playwright');
const { execSync, spawn } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');

const repo = path.resolve(__dirname, '..');
const out = path.join(repo, 'docs/evolucao/img');
const list = JSON.parse(fs.readFileSync(path.join(repo, 'docs/evolucao/versions.json'), 'utf8'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-highlights-'));
const PORT = 8791;

(async () => {
  const jobs = process.argv.slice(2).map(a => { const [label, src] = a.split('='); return { label, src, spec: (list.find(e => e.v === label) || {}).destaque }; });
  for (const j of jobs) {
    if (!j.spec) throw new Error(`no "destaque" for ${j.label} in versions.json`);
    const dir = path.join(tmp, j.label);
    fs.mkdirSync(dir); execSync(`git -C "${repo}" archive ${j.src} | tar -x -C "${dir}"`);
    fs.copyFileSync(path.join(repo, 'tools/highlight.html'), path.join(dir, '_highlight.html'));
  }
  const server = spawn('python3', ['-m', 'http.server', String(PORT), '-d', tmp], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800));
  const browser = await chromium.launch();
  try {
    for (const j of jobs) {
      const page = await browser.newPage({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2 });
      const file = path.join(out, `${j.label}-destaque.jpg`);
      if (j.spec.charon) {
        await page.goto(`http://localhost:${PORT}/${j.label}/index.html`);
        await page.waitForTimeout(1500);
        await page.evaluate(() => { document.getElementById('menu').hidden = true; document.getElementById('charon').hidden = false; });
        await page.waitForTimeout(800);
      } else {
        await page.goto(`http://localhost:${PORT}/${j.label}/_highlight.html?spec=${encodeURIComponent(JSON.stringify(j.spec))}`);
        await page.waitForFunction(() => document.title, null, { timeout: 120000 });
        const title = await page.title();
        console.log(`${j.label}: ${title}`);
        await page.waitForTimeout(300);
      }
      await page.screenshot({ path: file, type: 'jpeg', quality: 82 });
      await page.close();
      console.log('captured', j.label, j.spec.charon ? '' : await Promise.resolve(''));
    }
  } finally { await browser.close(); server.kill(); fs.rmSync(tmp, { recursive: true, force: true }); }
})();
