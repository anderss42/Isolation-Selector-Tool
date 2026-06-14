import { test, expect } from '@playwright/test';
import { fillStage1, expectStage2, fillStage2AndCalculate, readOutput } from './helpers.js';

async function groupFor(page, { baseGroup, temp }) {
    await fillStage1(page, { otherGroup: baseGroup, otherName: 'TempFluid', temp, period: 'oneOrLess' });
    await expectStage2(page);
    await fillStage2AndCalculate(page, { selIso: 'spade' });
    return readOutput(page);
}

test('non-hazardous (G4) above 50 °C escalates to Group 3', async ({ page }) => {
    const out = await groupFor(page, { baseGroup: 4, temp: 55 });
    expect(out.fluid).toContain('Group 3');
    expect(out.fluid).toContain('escalated from Group 4');
});

test('above 60 °C escalates to Group 1', async ({ page }) => {
    const out = await groupFor(page, { baseGroup: 4, temp: 65 });
    expect(out.fluid).toContain('Group 1');
});

test('below -10 °C escalates to Group 1', async ({ page }) => {
    const out = await groupFor(page, { baseGroup: 3, temp: -15 });
    expect(out.fluid).toContain('Group 1');
});

test('normal temperature does not escalate', async ({ page }) => {
    const out = await groupFor(page, { baseGroup: 3, temp: 20 });
    expect(out.fluid).toContain('Group 3');
    expect(out.fluid).not.toContain('escalated');
});

test('temperature never downgrades a more onerous base group', async ({ page }) => {
    // Group 1 fluid at a benign 20 °C stays Group 1.
    const out = await groupFor(page, { baseGroup: 1, temp: 20 });
    expect(out.fluid).toContain('Group 1');
});

test('standard dropdown fluid infers its group', async ({ page }) => {
    await fillStage1(page, { fluidLabel: 'Crude Oil', temp: 20, period: 'oneOrLess' });
    await expectStage2(page);
    await fillStage2AndCalculate(page, { selIso: 'spade' });
    const out = await readOutput(page);
    expect(out.fluid).toContain('Crude Oil');
    expect(out.fluid).toContain('Group 1');
});
