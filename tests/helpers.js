// Independent expected-result model — deliberately NOT copied from the application code.
// Based on the approved flowchart and scoring matrix.

// Release potential matrix: row = pipe-size band, col = pressure band
// Rows: [>=24, >=12, >=6, >1, <=1]   Cols: [>=150, >=100, >=50, >=20, >=10, <10]
const RELEASE_MATRIX = [
    [10, 10, 10,  9, 7, 6],
    [10, 10,  9,  7, 6, 6],
    [10,  9,  6,  6, 6, 6],
    [10,  6,  6,  3, 2, 1],
    [10,  4,  3,  3, 1, 1],
];

function pressureCol(p) {
    if (p >= 150) return 0;
    if (p >= 100) return 1;
    if (p >= 50)  return 2;
    if (p >= 20)  return 3;
    if (p >= 10)  return 4;
    return 5;
}

function pipeSizeRow(s) {
    if (s >= 24) return 0;
    if (s >= 12) return 1;
    if (s >= 6)  return 2;
    if (s > 1)   return 3;
    return 4;
}

export function releaseScore(pipeSize, pressure) {
    return RELEASE_MATRIX[pipeSizeRow(pipeSize)][pressureCol(pressure)];
}

export function calcScore({ purpose, substance, period, pipeSize, pressure }) {
    if (purpose === 'cse') return 900;
    if (purpose === 'sbt' || purpose === 'motion') return 80;
    const s = { flammable: 10, haz: 3, nonHaz: 1 }[substance];
    const d = { oneOrLess: 3, upToWeek: 7, moreWeek: 10 }[period];
    return s * d * releaseScore(pipeSize, pressure);
}

export function minimumIsolation(score) {
    if (score > 450) return 'spade';
    if (score > 89)  return 'dbb';
    if (score > 29)  return 'sbb';
    return 'single';
}

export const ISO_SCORES = { spade: 1000, dbb: 450, sbb: 89, single: 29 };

export function isolationMeets(selIso, score) {
    return ISO_SCORES[selIso] >= score;
}

// --- Output text labels (must match application output exactly) ---

export const ISOLATION_TEXT = {
    spade:  'Positive isolation - Spade or disconnection',
    dbb:    'Proven isolation - Double Block and Bleed (DBB) or double seal valve with body bleed.',
    sbb:    'Proven isolation - Leak tight Single Block and Bleed (SBB).',
    single: 'Non-proven isolation - Single or double valve - Double valve should be used rather than single, if available.',
};

export const SUBSTANCE_TEXT = {
    flammable: 'Flammable or Toxic liquid or gas',
    haz:       'Hazardous utilities or Chemicals',
    nonHaz:    'Non-Hazardous Substances',
};

export const DURATION_TEXT = {
    oneOrLess: 'Less than one shift',
    upToWeek:  'More than one shift, less than one week',
    moreWeek:  'More than one week',
};

export const PURPOSE_TEXT = {
    boc:    'Breaking of Containment',
    sbt:    'Small Bore Tubing 1/2 inch or less.',
    motion: 'To prevent motion in equipment for non-invasive work',
    cse:    'For confined space entry',
};

export const MEETS_TEXT     = 'The isolation selected meets the minimum standards required and can be used.';
export const NOT_MEETS_TEXT = 'The isolation selected does not meet the minimum standard required. A Level 2 risk assessment MUST be carried out if this is to be used.';

// --- Page interaction helpers ---

export async function fillStage1(page, { title, purpose, substance, period, boundary = false, iccNo }) {
    await page.goto('/');
    await page.fill('#isoTitle', title);
    await page.locator(`label[for="${purpose}"]`).click();
    if (substance) await page.locator(`label[for="${substance}"]`).click();
    if (period)    await page.selectOption('#period', period);
    if (boundary)  await page.check('#boundary');
    if (iccNo)     await page.fill('#iccNo', String(iccNo));
    await page.click('#nextBtn');
    // Wait for the calculation section to appear
    await page.locator('#calcBtn').waitFor({ state: 'visible' });
}

export async function fillStage2AndCalculate(page, { lineDesc, pipeSize, pressure, selIso }) {
    if (lineDesc  !== undefined) await page.fill('#lineDesc', lineDesc);
    if (pipeSize  !== undefined) await page.fill('#pipeSizeNum', String(pipeSize));
    if (pressure  !== undefined) await page.fill('#pressure', String(pressure));
    if (selIso)                  await page.locator(`label[for="${selIso}"]`).click();
    await page.click('#calcBtn');
    await page.locator('#outCard').waitFor({ state: 'visible' });
}

export async function readOutput(page) {
    const controls = await Promise.all(
        [1, 2, 3, 4, 5, 6].map(i => page.locator(`#listControl${i}`).textContent()),
    );
    return {
        title:      (await page.locator('#outTitle').textContent()).trim(),
        lineDesc:   (await page.locator('#outLineDesc').textContent()).trim(),
        purpose:    (await page.locator('#outPur').textContent()).trim(),
        substance:  (await page.locator('#outSub').textContent()).trim(),
        duration:   (await page.locator('#outDur').textContent()).trim(),
        boundary:   (await page.locator('#outBound').textContent()).trim(),
        pipe:       (await page.locator('#outPipe').textContent()).trim(),
        pressure:   (await page.locator('#outBar').textContent()).trim(),
        isoSel:     (await page.locator('#outIsoSel').textContent()).trim(),
        minReqText: (await page.locator('#outIsoText').textContent()).trim(),
        minReqImg:  await page.locator('#outIsoImg').getAttribute('src'),
        selIsoImg:  await page.locator('#outSelIsoImg').getAttribute('src'),
        outcome:    (await page.locator('#isoOutcome').textContent()).trim(),
        outImg:     await page.locator('#outImg').getAttribute('src'),
        controls:   controls.map(t => t.trim()).filter(t => t !== ''),
    };
}
