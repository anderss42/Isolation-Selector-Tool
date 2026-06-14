import { test, expect } from '@playwright/test';
import { fillStage1, expectStage2, fillStage2AndCalculate, readOutput } from './helpers.js';

async function run(page, stage1) {
    await fillStage1(page, { temp: 20, period: 'oneOrLess', ...stage1 });
    await expectStage2(page);
    await fillStage2AndCalculate(page, { selIso: 'spade' });
    return readOutput(page);
}

test('CSE forces Category I regardless of group', async ({ page }) => {
    const out = await run(page, { otherGroup: 4, otherName: 'Seawaterish', cse: true });
    expect(out.minReqText).toContain('Category I');
    expect(out.cse).toBe('Yes');
});

test('flare/vent/drains gives Category III', async ({ page }) => {
    const out = await run(page, { otherGroup: 1, otherName: 'Gas', flareVentDrains: true });
    expect(out.minReqText).toContain('Category III');
    expect(out.exempt).toContain('Flare');
});

test('SBT: groups 1 & 2 → IIB', async ({ page }) => {
    const out = await run(page, { otherGroup: 2, otherName: 'Chem', sbt: true });
    expect(out.minReqText).toContain('Category IIB');
    expect(out.exempt).toContain('small-bore');
});

test('SBT: groups 3 & 4 → III', async ({ page }) => {
    const out = await run(page, { otherGroup: 3, otherName: 'Diesel-ish', sbt: true });
    expect(out.minReqText).toContain('Category III');
});

test('boundary isolation → Category III', async ({ page }) => {
    const out = await run(page, { otherGroup: 1, otherName: 'Gas', boundary: true });
    expect(out.minReqText).toContain('Category III');
    expect(out.boundary).toBe('Yes');
});

test('CSE wins over boundary (precedence)', async ({ page }) => {
    const out = await run(page, { otherGroup: 1, otherName: 'Gas', cse: true, boundary: true });
    expect(out.minReqText).toContain('Category I');
});
