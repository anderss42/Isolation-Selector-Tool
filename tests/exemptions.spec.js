import { test, expect } from '@playwright/test';
import { fillStage1, expectStage2, fillStage2AndCalculate, readOutput } from './helpers.js';

// Run a standard exemption test — uses DBB as the selected isolation so it meets
// any requirement down to IIB, and doesn't interfere with auto-spade paths.
async function run(page, stage1, selIso = 'dbb') {
    await fillStage1(page, { temp: 20, period: 'oneOrLess', ...stage1 });
    await expectStage2(page);
    await fillStage2AndCalculate(page, { selIso });
    return readOutput(page);
}

test('CSE forces Category I regardless of group', async ({ page }) => {
    // cse=true → isoTypeSection hidden, spade auto-selected → no selIso needed
    await fillStage1(page, { otherGroup: 4, otherName: 'Seawaterish', temp: 20, period: 'oneOrLess', cse: true });
    await expectStage2(page);
    await fillStage2AndCalculate(page);
    const out = await readOutput(page);
    expect(out.minReqText).toContain('Category I');
    expect(out.cse).toBe('Yes');
    expect(out.outcome).toContain('meets the minimum standard');
});

test('CSE hides the isolation picker and shows CSE notice', async ({ page }) => {
    await fillStage1(page, { otherGroup: 2, otherName: 'Chem', temp: 20, period: 'oneOrLess', cse: true });
    await expectStage2(page);
    await expect(page.locator('#isoTypeSection')).toBeHidden();
    await expect(page.locator('#cseNotice')).toBeVisible();
    await expect(page.locator('#posIsoNotice')).toBeHidden();
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
    expect(out.exempt).toContain('small-bore');
});

test('boundary isolation → Category III', async ({ page }) => {
    const out = await run(page, { otherGroup: 1, otherName: 'Gas', boundary: true });
    expect(out.minReqText).toContain('Category III');
    expect(out.boundary).toBe('Yes');
});

test('CSE wins over boundary (precedence)', async ({ page }) => {
    await fillStage1(page, { otherGroup: 1, otherName: 'Gas', temp: 20, period: 'oneOrLess', cse: true, boundary: true });
    await expectStage2(page);
    await fillStage2AndCalculate(page);
    const out = await readOutput(page);
    expect(out.minReqText).toContain('Category I');
});

test('CSE wins over flare/vent/drains (precedence)', async ({ page }) => {
    await fillStage1(page, { otherGroup: 1, otherName: 'Gas', temp: 20, period: 'oneOrLess', cse: true, flareVentDrains: true });
    await expectStage2(page);
    await fillStage2AndCalculate(page);
    const out = await readOutput(page);
    expect(out.minReqText).toContain('Category I');
});

test('boundary takes priority over flare/vent/drains', async ({ page }) => {
    // boundary → III, fvd → III — same outcome either way but boundary should be the driver
    const out = await run(page, { otherGroup: 1, otherName: 'Gas', boundary: true, flareVentDrains: true });
    expect(out.minReqText).toContain('Category III');
    expect(out.boundary).toBe('Yes');
});

test('positiveIsoRisk=no takes priority over CSE (positiveIsoRisk checked first)', async ({ page }) => {
    // Both positiveIsoRisk=false and cse=true force Category I; posIsoRisk=no is checked first in showSpec().
    await fillStage1(page, {
        otherGroup: 1, otherName: 'Gas', temp: 20, period: 'oneOrLess',
        positiveIsoRisk: false, cse: true,
    });
    await expectStage2(page);
    // posIsoNotice is shown in Stage 2 (before Calculate hides the input section)
    await expect(page.locator('#posIsoNotice')).toBeVisible();
    await expect(page.locator('#cseNotice')).toBeHidden();
    // Calculate and verify output
    await fillStage2AndCalculate(page);
    const out = await readOutput(page);
    expect(out.minReqText).toContain('Category I');
    expect(out.posIsoRisk).toBe('No');
});
