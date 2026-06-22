import { test, expect } from '@playwright/test';
import { fillStage1, expectStage2, fillStage2AndCalculate, readOutput } from './helpers.js';

// Control strings (partial matches for robustness)
const C1 = 'Pressure build-up test to ensure valve integrity';
const C2 = 'Regular monitoring of the isolation integrity';
const C3 = 'Continuous gas monitoring to be present when breaching';
const C4 = 'Contingency plan to be detailed in the ICC or TBT';
const C5 = 'Radio link to control room when containment is being broken';
const HW = 'Hot work permit and dedicated fire watch';

const SBT1 = 'double block valves should be used on impulse lines';
const SBT2 = 'Pressure build-up test to ensure valve integrity';
const SBT3 = 'Regular monitoring of the isolation integrity';
const SBT4 = 'Radio link to control room when containment is being broken';
const SBT5 = 'Contingency plan to be detailed on ICC or TBT';
const SBT6 = 'Continuous gas monitoring to be present when breaching hydrocarbon systems';

const FVD1 = 'Production Supervisor confirms no abnormal';
const FVD2 = 'Work party formally briefed that work is against a single valve';
const FVD3 = 'Additional controls for toxic service';
const FVD4 = 'Rated blanks/bolts/gaskets verified';
const FVD5 = 'valve position indicator shows fully closed';
const FVD6 = 'AA attends TBT';

const CSE1 = 'Complete separation of the plant';
const CSE2 = 'Controls required as per TUK-17-C-004';

async function run(page, stage1, selIso) {
    await fillStage1(page, { temp: 20, period: 'oneOrLess', ...stage1 });
    await expectStage2(page);
    await fillStage2AndCalculate(page, { selIso });
    return readOutput(page);
}

// ── Standard controls ─────────────────────────────────────────────────────────

test.describe('Standard controls — proven valve', () => {
    test('Group 1, proven valve → pressure test + monitoring + gas + contingency + radio', async ({ page }) => {
        const out = await run(page, { otherGroup: 1, otherName: 'G1', period: 'oneOrLess' }, 'dbb');
        expect(out.controls).toContainEqual(expect.stringContaining(C1));
        expect(out.controls).toContainEqual(expect.stringContaining(C2));
        expect(out.controls).toContainEqual(expect.stringContaining(C3));
        expect(out.controls).toContainEqual(expect.stringContaining(C4));
        expect(out.controls).toContainEqual(expect.stringContaining(C5));
        expect(out.controls).toHaveLength(5);
    });

    test('Group 2, proven valve → same 5 controls as Group 1', async ({ page }) => {
        const out = await run(page, { otherGroup: 2, otherName: 'G2', period: 'oneOrLess' }, 'sbb');
        expect(out.controls).toHaveLength(5);
        expect(out.controls).toContainEqual(expect.stringContaining(C3));
        expect(out.controls).toContainEqual(expect.stringContaining(C5));
    });

    test('Group 3, proven valve → pressure test + monitoring + contingency (no gas/radio)', async ({ page }) => {
        const out = await run(page, { otherGroup: 3, otherName: 'G3', period: 'oneOrLess' }, 'dbb');
        expect(out.controls).toContainEqual(expect.stringContaining(C1));
        expect(out.controls).toContainEqual(expect.stringContaining(C2));
        expect(out.controls).toContainEqual(expect.stringContaining(C4));
        expect(out.controls).toHaveLength(3);
        expect(out.controls.join(' ')).not.toContain(C3.substring(0, 20)); // no gas monitor
        expect(out.controls.join(' ')).not.toContain(C5.substring(0, 20)); // no radio
    });

    test('Group 4, proven valve → same 3 controls as Group 3', async ({ page }) => {
        const out = await run(page, { otherGroup: 4, otherName: 'G4', period: 'oneOrLess' }, 'twin_seal');
        expect(out.controls).toHaveLength(3);
        expect(out.controls).toContainEqual(expect.stringContaining(C1));
        expect(out.controls).toContainEqual(expect.stringContaining(C4));
    });
});

test.describe('Standard controls — single valve (non-proven)', () => {
    test('Group 1, single valve → monitoring + gas + contingency + radio (no pressure test)', async ({ page }) => {
        // G1 short no-hotwork → IIA required; single is III → doesn't meet, but controls still apply
        const out = await run(page, { otherGroup: 1, otherName: 'G1', period: 'oneOrLess' }, 'single');
        expect(out.controls.join(' ')).not.toContain(C1.substring(0, 20)); // no pressure test
        expect(out.controls).toContainEqual(expect.stringContaining(C2));
        expect(out.controls).toContainEqual(expect.stringContaining(C3));
        expect(out.controls).toContainEqual(expect.stringContaining(C4));
        expect(out.controls).toContainEqual(expect.stringContaining(C5));
        expect(out.controls).toHaveLength(4);
    });

    test('Group 3, single valve → monitoring + contingency only', async ({ page }) => {
        const out = await run(page, { otherGroup: 3, otherName: 'G3', period: 'oneOrLess' }, 'single');
        expect(out.controls).toContainEqual(expect.stringContaining(C2));
        expect(out.controls).toContainEqual(expect.stringContaining(C4));
        expect(out.controls).toHaveLength(2);
    });
});

// ── Hot work controls ─────────────────────────────────────────────────────────

test.describe('Hot work control appended', () => {
    test('Group 1, proven valve, hot work → 5 standard + hot work = 6 controls', async ({ page }) => {
        const out = await run(page, { otherGroup: 1, otherName: 'G1', period: 'oneOrLess', hotWork: true }, 'dbb');
        expect(out.controls).toHaveLength(6);
        expect(out.controls[5]).toContain(HW);
    });

    test('Group 3, proven valve, hot work → 3 standard + hot work = 4 controls', async ({ page }) => {
        const out = await run(page, { otherGroup: 3, otherName: 'G3', period: 'oneOrLess', hotWork: true }, 'dbb');
        expect(out.controls).toHaveLength(4);
        expect(out.controls[3]).toContain(HW);
    });

    test('Group 1, single valve, hot work → 4 standard + hot work = 5 controls', async ({ page }) => {
        const out = await run(page, { otherGroup: 1, otherName: 'G1', period: 'oneOrLess', hotWork: true }, 'single');
        expect(out.controls).toHaveLength(5);
        expect(out.controls[4]).toContain(HW);
    });

    test('hot work NOT added when CSE applies (CSE controls only)', async ({ page }) => {
        await fillStage1(page, {
            otherGroup: 1, otherName: 'G1', temp: 20, period: 'oneOrLess',
            hotWork: true, cse: true,
        });
        await expectStage2(page);
        await fillStage2AndCalculate(page);
        const out = await readOutput(page);
        expect(out.controls.join(' ')).not.toContain(HW.substring(0, 20));
        expect(out.controls).toHaveLength(2); // CSE controls only
    });
});

// ── CSE controls ──────────────────────────────────────────────────────────────

test('CSE controls: complete separation + TUK procedure reference', async ({ page }) => {
    await fillStage1(page, {
        otherGroup: 2, otherName: 'G2', temp: 20, period: 'oneOrLess', cse: true,
    });
    await expectStage2(page);
    await fillStage2AndCalculate(page);
    const out = await readOutput(page);
    expect(out.controls).toHaveLength(2);
    expect(out.controls[0]).toContain(CSE1);
    expect(out.controls[1]).toContain(CSE2);
});

// ── SBT controls ──────────────────────────────────────────────────────────────

test.describe('SBT controls', () => {
    test('SBT + proven valve → 6 SBT controls including pressure test', async ({ page }) => {
        const out = await run(page, { otherGroup: 1, otherName: 'G1', period: 'oneOrLess', sbt: true }, 'dbb');
        expect(out.controls).toHaveLength(6);
        expect(out.controls[0]).toContain(SBT1);
        expect(out.controls[1]).toContain(SBT2); // pressure test present
        expect(out.controls[2]).toContain(SBT3);
        expect(out.controls[3]).toContain(SBT4);
        expect(out.controls[4]).toContain(SBT5);
        expect(out.controls[5]).toContain(SBT6);
    });

    test('SBT + single valve → 5 SBT controls (no pressure test)', async ({ page }) => {
        const out = await run(page, { otherGroup: 1, otherName: 'G1', period: 'oneOrLess', sbt: true }, 'single');
        expect(out.controls).toHaveLength(5);
        expect(out.controls[0]).toContain(SBT1);
        // SBT2 (pressure test) is omitted for non-proven valves
        expect(out.controls.join(' ')).not.toContain('Pressure build-up test');
        expect(out.controls[1]).toContain(SBT3);
    });

    test('SBT + proven valve + hot work → 7 controls (6 SBT + hot work)', async ({ page }) => {
        const out = await run(page, { otherGroup: 1, otherName: 'G1', period: 'oneOrLess', sbt: true, hotWork: true }, 'dbb');
        expect(out.controls).toHaveLength(7);
        expect(out.controls[6]).toContain(HW);
    });

    test('SBT + single valve + hot work → 6 controls (5 SBT + hot work)', async ({ page }) => {
        const out = await run(page, { otherGroup: 1, otherName: 'G1', period: 'oneOrLess', sbt: true, hotWork: true }, 'single');
        expect(out.controls).toHaveLength(6);
        expect(out.controls[5]).toContain(HW);
    });
});

// ── FVD controls ──────────────────────────────────────────────────────────────

test.describe('Flare/vent/drains controls', () => {
    test('FVD + single valve → all 6 FVD controls including single-valve briefing', async ({ page }) => {
        const out = await run(page, { otherGroup: 1, otherName: 'G1', period: 'oneOrLess', flareVentDrains: true }, 'single');
        expect(out.controls).toHaveLength(6);
        expect(out.controls[0]).toContain(FVD1);
        expect(out.controls[1]).toContain(FVD2); // single valve briefing present
        expect(out.controls[2]).toContain(FVD3);
        expect(out.controls[3]).toContain(FVD4);
        expect(out.controls[4]).toContain(FVD5);
        expect(out.controls[5]).toContain(FVD6);
    });

    test('FVD + proven valve → 5 FVD controls (single-valve briefing omitted)', async ({ page }) => {
        const out = await run(page, { otherGroup: 1, otherName: 'G1', period: 'oneOrLess', flareVentDrains: true }, 'dbb');
        expect(out.controls).toHaveLength(5);
        expect(out.controls[0]).toContain(FVD1);
        // FVD2 is omitted for proven valves
        expect(out.controls.join(' ')).not.toContain('single valve on flare');
        expect(out.controls[1]).toContain(FVD3);
        expect(out.controls[4]).toContain(FVD6);
    });

    test('FVD + single valve + hot work → 7 controls', async ({ page }) => {
        const out = await run(page, { otherGroup: 1, otherName: 'G1', period: 'oneOrLess', flareVentDrains: true, hotWork: true }, 'single');
        expect(out.controls).toHaveLength(7);
        expect(out.controls[6]).toContain(HW);
    });

    test('FVD + proven valve + hot work → 6 controls', async ({ page }) => {
        const out = await run(page, { otherGroup: 1, otherName: 'G1', period: 'oneOrLess', flareVentDrains: true, hotWork: true }, 'dbb');
        expect(out.controls).toHaveLength(6);
        expect(out.controls[5]).toContain(HW);
    });
});

// ── Preparation requirements ──────────────────────────────────────────────────

test.describe('Preparation requirements', () => {
    test('Groups 1-3 get all 4 preparation controls including water flush and nitrogen purge', async ({ page }) => {
        for (const group of [1, 2, 3]) {
            await fillStage1(page, { otherGroup: group, otherName: `G${group}`, temp: 20, period: 'oneOrLess' });
            await expectStage2(page);
            await fillStage2AndCalculate(page, { selIso: 'dbb' });
            const out = await readOutput(page);
            expect(out.prepControls[0], `G${group} prep1`).toContain('Depressurised');
            expect(out.prepControls[1], `G${group} prep2`).toContain('Drain');
            expect(out.prepControls[2], `G${group} prep3`).toContain('Water flush');
            expect(out.prepControls[3], `G${group} prep4`).toContain('Nitrogen Purge');
            await page.click('#backBtn');
        }
    });

    test('Group 4 only gets 2 preparation controls (no water flush or nitrogen purge)', async ({ page }) => {
        await fillStage1(page, { otherGroup: 4, otherName: 'G4', temp: 20, period: 'oneOrLess' });
        await expectStage2(page);
        await fillStage2AndCalculate(page, { selIso: 'dbb' });
        const out = await readOutput(page);
        expect(out.prepControls[0]).toContain('Depressurised');
        expect(out.prepControls[1]).toContain('Drain');
        expect(out.prepControls[2]).toBe(''); // water flush omitted
        expect(out.prepControls[3]).toBe(''); // nitrogen purge omitted
    });
});

// ── Controls heading ──────────────────────────────────────────────────────────

test('controlsHeading says "required" when isolation meets standard', async ({ page }) => {
    const out = await run(page, { otherGroup: 4, otherName: 'G4', period: 'oneOrLess' }, 'dbb');
    expect(out.controlsHeading).toBe('Isolation Controls required are:');
    expect(out.prepHeading).toBe('Preparation of equipment requirements:');
});

test('controlsHeading says "Suggested controls" when isolation does not meet standard', async ({ page }) => {
    // G1, short, no hw → requires IIA; single is III → doesn't meet
    const out = await run(page, { otherGroup: 1, otherName: 'G1', period: 'oneOrLess' }, 'single');
    expect(out.controlsHeading).toContain('Suggested controls');
    expect(out.prepHeading).toContain('Suggested preparation controls');
});
