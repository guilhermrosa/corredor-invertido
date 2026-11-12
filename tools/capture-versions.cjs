// Screenshots of past versions for docs/evolucao (the project's visual history).
// Each version is taken straight from git, served locally and played the same way with a fixed
// random seed: the menu, a moment on the floor, and a moment after flipping to the roof.
//
//   node tools/capture-versions.cjs 0.37=HEAD 0.30=2329548 ...   (label=commit)
//   node tools/capture-versions.cjs 0.5=dir:/path/to/prototype    (a folder with an index.html)
//
// Needs Playwright with Chromium (not a project dependency). Writes docs/evolucao/img/<label>-{menu,chao,teto}.jpg.
const { chromium } = require('playwright');
const { execSync, spawn } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');

const repo = path.resolve(__dirname, '..');
const out = path.join(repo, 'docs/evolucao/img');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-versions-'));
const PORT = 8790;

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const jobs = process.argv.slice(2).map(a => { const [label, src] = a.split('='); return { label, src }; });
  for (const j of jobs) {
    const dir = path.join(tmp, j.label);
    if (j.src.startsWith('dir:')) fs.cpSync(j.src.slice(4), dir, { recursive: true });
    else { fs.mkdirSync(dir); execSync(`git -C "${repo}" archive ${j.src} | tar -x -C "${dir}"`); }
  }
  const server = spawn('python3', ['-m', 'http.server', String(PORT), '-d', tmp], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800));
  const browser = await chromium.launch();
  try {
    for (const j of jobs) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 1 });
      await ctx.addInitScript(() => {
        let s = 20261112; // fixed seed: every version meets the same luck
        Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
        try { localStorage.setItem('ci-tutorial-done', 'true'); } catch (e) {}
      });
      // Two runs from a fresh load each (same seed, same obstacles): one stays on the floor; the
      // other flips to the roof early, before the first obstacle arrives.
      for (const roof of [false, true]) {
        const page = await ctx.newPage();
        await page.goto(`http://localhost:${PORT}/${j.label}/index.html`);
        await page.waitForTimeout(1500);
        const shot = name => page.screenshot({ path: path.join(out, `${j.label}-${name}.jpg`), type: 'jpeg', quality: 80 });
        if (!roof) await shot('menu');
        await page.click('#btnPlay').catch(() => page.keyboard.press('Enter'));
        if (!roof) { await page.waitForTimeout(1300); await shot('chao'); }
        else {
          await page.waitForTimeout(500);
          await page.keyboard.press('Space'); await page.waitForTimeout(110); await page.keyboard.press('Space');
          await page.waitForTimeout(700);
          await shot('teto');
        }
        await page.close();
      }
      await ctx.close();
      console.log('captured', j.label);
    }
  } finally { await browser.close(); server.kill(); fs.rmSync(tmp, { recursive: true, force: true }); }
})();
