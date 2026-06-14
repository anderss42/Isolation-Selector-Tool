import { test, expect } from '@playwright/test';
import { fillStage1, expectStage2, fillStage2AndCalculate, readOutput } from './helpers.js';

// Force a non-compliant outcome by selecting the weakest isolation (single = III),
// then assert the authorisation guidance (shown for both offshore and onshore).
async function deviation(page, { group, period }) {
    await fillStage1(page, { otherGroup: group, otherName: 'Auth fluid', temp: 20, period });
    await expectStage2(page);
    await fillStage2AndCalculate(page, { selIso: 'single' });
    return readOutput(page);
}

test('G1 long duration (req I) shows OIM and Process TA', async ({ page }) => {
    const out = await deviation(page, { group: 1, period: 'moreThanShift' });
    expect(out.outcome).toContain('does not meet');
    expect(out.authGuidance).toContain('OIM');
    expect(out.authGuidance).toContain('Process TA / Operations Manager');
});

test('G2 one shift (req IIA) shows OIM and Process Engineer', async ({ page }) => {
    const out = await deviation(page, { group: 2, period: 'oneOrLess' });
    expect(out.authGuidance).toContain('OIM');
    expect(out.authGuidance).toContain('Process Engineer');
});

test('G3 long duration (req IIA) shows Department Head and site deviation process', async ({ page }) => {
    const out = await deviation(page, { group: 3, period: 'moreThanShift' });
    expect(out.authGuidance).toContain('Department Head');
    expect(out.authGuidance).toContain('site deviation process');
});

test('G3 one shift (req IIB) shows Area Authority', async ({ page }) => {
    const out = await deviation(page, { group: 3, period: 'oneOrLess' });
    expect(out.authGuidance).toContain('Area Authority');
});

test('non-hazardous (G4) deviation does not require OIM', async ({ page }) => {
    const out = await deviation(page, { group: 4, period: 'moreThanShift' });
    expect(out.authGuidance).not.toContain('OIM');
});

test('compliant isolation shows no authorisation guidance', async ({ page }) => {
    await fillStage1(page, { otherGroup: 4, otherName: 'Seawater-ish', temp: 20, period: 'oneOrLess' });
    await expectStage2(page);
    await fillStage2AndCalculate(page, { selIso: 'spade' });
    const out = await readOutput(page);
    expect(out.outcome).toContain('meets the minimum standard');
    expect(out.authGuidance).toBe('');
});
