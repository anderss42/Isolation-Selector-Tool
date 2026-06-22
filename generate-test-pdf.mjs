/**
 * generate-test-pdf.mjs
 * Runs the Playwright test suite, collects JSON results, and saves a formatted
 * PDF report to IST-Test-Report.pdf in the project root.
 *
 * Usage: node generate-test-pdf.mjs
 */

import { execSync }   from 'child_process';
import { chromium }   from '@playwright/test';
import { readFileSync } from 'fs';

// ── 1. Run tests and collect JSON results ─────────────────────────────────────

console.log('Running test suite…');
let jsonText;
try {
    jsonText = execSync('npx playwright test --reporter=json', {
        encoding: 'utf8',
        maxBuffer: 50 * 1024 * 1024,
        // Redirect stderr to inherit so progress appears in the terminal,
        // stdout goes to the variable.
        stdio: ['ignore', 'pipe', 'inherit'],
    });
} catch (err) {
    // Playwright exits with code 1 when tests fail; JSON is still in stdout.
    jsonText = err.stdout || '';
}

const results = JSON.parse(jsonText);

// ── 2. Flatten all specs from the suite tree ──────────────────────────────────

function flattenSuites(suites, filePath = '') {
    const rows = [];
    for (const suite of (suites || [])) {
        const file = suite.file || filePath;
        for (const spec of (suite.specs || [])) {
            const status = spec.tests?.[0]?.results?.[0]?.status ?? 'unknown';
            const duration = spec.tests?.[0]?.results?.[0]?.duration ?? 0;
            rows.push({
                file,
                suite: suite.title,
                title: spec.title,
                ok: spec.ok,
                status,
                duration,
            });
        }
        rows.push(...flattenSuites(suite.suites || [], file));
    }
    return rows;
}

const allSpecs = flattenSuites(results.suites || []);

const passed  = allSpecs.filter(s => s.ok).length;
const failed  = allSpecs.filter(s => !s.ok).length;
const total   = allSpecs.length;
const totalMs = allSpecs.reduce((a, s) => a + s.duration, 0);

const runDate = new Date().toLocaleString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
});

// ── 3. Group specs by file ────────────────────────────────────────────────────

const byFile = {};
for (const spec of allSpecs) {
    const key = spec.file || 'ungrouped';
    if (!byFile[key]) byFile[key] = [];
    byFile[key].push(spec);
}

// Friendly file name: strip path and .spec.js
function friendlyFile(f) {
    return f.replace(/^.*[\\/]/, '').replace(/\.spec\.js$/, '').replace(/-/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase());
}

// Format milliseconds
function fmtMs(ms) {
    return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`;
}

// ── 4. Build the HTML document ────────────────────────────────────────────────

function tableRows(specs) {
    return specs.map((s, i) => {
        const icon   = s.ok ? '✓' : '✗';
        const cls    = s.ok ? 'pass' : 'fail';
        const suite  = s.suite && s.suite !== s.file ? `<span class="suite-tag">${esc(s.suite)}</span> ` : '';
        return `<tr class="${cls}">
            <td class="num">${i + 1}</td>
            <td class="icon">${icon}</td>
            <td>${suite}${esc(s.title)}</td>
            <td class="dur">${fmtMs(s.duration)}</td>
        </tr>`;
    }).join('\n');
}

function esc(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const fileSections = Object.entries(byFile).map(([file, specs]) => {
    const filePass = specs.filter(s => s.ok).length;
    const fileFail = specs.filter(s => !s.ok).length;
    const badge    = fileFail > 0
        ? `<span class="badge fail-badge">${fileFail} FAILED</span>`
        : `<span class="badge pass-badge">All passed</span>`;
    return `
    <section class="file-section">
        <h2>${esc(friendlyFile(file))} ${badge}
            <span class="file-sub">${specs.length} tests — ${filePass} passed${fileFail ? ', ' + fileFail + ' failed' : ''}</span>
        </h2>
        <table>
            <thead><tr>
                <th class="num">#</th><th class="icon"></th>
                <th>Test</th><th class="dur">Time</th>
            </tr></thead>
            <tbody>${tableRows(specs)}</tbody>
        </table>
    </section>`;
}).join('\n');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>IST Test Report</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1a1a1a; background: #fff; }

  /* Cover / header */
  .cover { background: #0d47a1; color: #fff; padding: 36px 40px 28px; page-break-after: avoid; }
  .cover h1 { font-size: 24px; font-weight: 700; letter-spacing: 0.5px; }
  .cover .subtitle { font-size: 13px; opacity: 0.85; margin-top: 4px; }
  .cover .run-date { font-size: 11px; opacity: 0.7; margin-top: 6px; }

  /* Summary bar */
  .summary { display: flex; gap: 0; background: #f5f7fa; border-bottom: 2px solid #dde3ec; }
  .stat { flex: 1; text-align: center; padding: 14px 0; }
  .stat .num { font-size: 30px; font-weight: 700; line-height: 1; }
  .stat .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: #555; margin-top: 3px; }
  .stat.s-pass .num { color: #1b7f3e; }
  .stat.s-fail .num { color: #c62828; }
  .stat.s-total .num { color: #0d47a1; }
  .stat.s-time .num { color: #555; font-size: 20px; padding-top: 6px; }
  .stat + .stat { border-left: 1px solid #dde3ec; }

  /* Body */
  .body { padding: 20px 32px 40px; }

  /* Section per file */
  .file-section { margin-bottom: 22px; page-break-inside: avoid; }
  h2 { font-size: 13px; font-weight: 600; color: #0d47a1; border-bottom: 1.5px solid #c5d5f0;
       padding-bottom: 5px; margin-bottom: 8px; display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
  .file-sub { font-size: 10px; font-weight: 400; color: #666; margin-left: auto; }
  .badge { font-size: 9px; font-weight: 700; padding: 2px 7px; border-radius: 10px; letter-spacing: 0.4px; }
  .pass-badge { background: #d4edda; color: #155724; }
  .fail-badge { background: #f8d7da; color: #721c24; }

  /* Test table */
  table { width: 100%; border-collapse: collapse; }
  th { background: #eef2fb; color: #333; font-size: 9px; text-transform: uppercase;
       letter-spacing: 0.6px; padding: 5px 8px; text-align: left; border-bottom: 1px solid #d0d9ec; }
  td { padding: 5px 8px; border-bottom: 1px solid #eff1f5; vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  .num { width: 32px; color: #aaa; text-align: right; padding-right: 10px; }
  .icon { width: 20px; font-size: 12px; text-align: center; }
  .dur { width: 60px; text-align: right; color: #888; white-space: nowrap; }
  tr.pass .icon { color: #1b7f3e; }
  tr.fail .icon { color: #c62828; font-weight: 700; }
  tr.fail td { background: #fff9f9; color: #8b0000; }
  tr.fail td:first-child { border-left: 3px solid #e53935; }
  .suite-tag { background: #e8edf8; color: #3a4d85; border-radius: 3px;
               padding: 1px 5px; font-size: 9px; font-weight: 600; margin-right: 3px; }

  /* Footer */
  .footer { margin-top: 28px; border-top: 1px solid #dde3ec; padding-top: 10px;
            font-size: 9px; color: #999; text-align: center; }

  /* Print */
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>

<div class="cover">
  <h1>Isolation Selector Tool — Test Report</h1>
  <div class="subtitle">Automated end-to-end test suite (Playwright / Chromium)</div>
  <div class="run-date">Generated: ${runDate}</div>
</div>

<div class="summary">
  <div class="stat s-total"><div class="num">${total}</div><div class="label">Total tests</div></div>
  <div class="stat s-pass"><div class="num">${passed}</div><div class="label">Passed</div></div>
  <div class="stat s-fail"><div class="num">${failed}</div><div class="label">Failed</div></div>
  <div class="stat s-time"><div class="num">${fmtMs(totalMs)}</div><div class="label">Duration</div></div>
</div>

<div class="body">
${fileSections}
<div class="footer">
  TAQA Isolation Selector Tool &nbsp;|&nbsp; Isolation standard: HSG253 &nbsp;|&nbsp;
  Test framework: Playwright ${results.config?.version ?? ''} &nbsp;|&nbsp; Browser: Chromium
</div>
</div>
</body>
</html>`;

// ── 5. Launch browser, render HTML, save PDF ──────────────────────────────────

console.log('Generating PDF…');
const browser = await chromium.launch();
const page    = await browser.newPage();
await page.setContent(html, { waitUntil: 'load' });

await page.pdf({
    path:               'IST-Test-Report.pdf',
    format:             'A4',
    printBackground:    true,
    margin:             { top: '0', right: '0', bottom: '0', left: '0' },
});

await browser.close();

console.log(`\nPDF saved → IST-Test-Report.pdf`);
console.log(`  ${total} tests  ·  ${passed} passed  ·  ${failed} failed  ·  ${fmtMs(totalMs)}`);
