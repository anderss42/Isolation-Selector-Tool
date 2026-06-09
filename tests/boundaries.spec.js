/**
 * Boundary condition tests.
 *
 * Exact threshold scores of 29, 89 and 450 are not achievable through the
 * BoC release matrix (all are prime or have no valid s×d×r factorisation
 * using the permitted values).  Tests instead use the nearest achievable
 * values on each side of every threshold.
 *
 * Known near-boundary inputs used here:
 *   score 28  → nonHaz, upToWeek,  pipe=1,  pressure=100  (r=4: 1×7×4)
 *   score 30  → nonHaz, moreWeek,  pipe=1,  pressure=50   (r=3: 1×10×3)
 *   score 84  → haz,    upToWeek,  pipe=1,  pressure=100  (r=4: 3×7×4)
 *   score 90  → flammable, oneOrLess, pipe=1, pressure=50 (r=3: 10×3×3)
 *   score 420 → flammable, upToWeek, pipe=12, pressure=10 (r=6: 10×7×6)
 *   score 490 → flammable, upToWeek, pipe=12, pressure=20 (r=7: 10×7×7)
 */

import { test, expect } from '@playwright/test';
import {
    fillStage1, fillStage2AndCalculate, readOutput,
    calcScore, minimumIsolation, isolationMeets,
    ISOLATION_TEXT, MEETS_TEXT, NOT_MEETS_TEXT,
} from './helpers.js';

// Helper — runs a full BoC calculation and asserts outcome
async function bocOutcome(page, { substance, period, pipeSize, pressure, selIso }) {
    const score  = calcScore({ purpose: 'boc', substance, period, pipeSize, pressure });
    const minIso = minimumIsolation(score);
    const meets  = isolationMeets(selIso, score);
    const label  = `boundary ${substance} ${period} pipe=${pipeSize} p=${pressure} iso=${selIso}`;

    await fillStage1(page, { title: label, purpose: 'boc', substance, period });
    await fillStage2AndCalculate(page, { lineDesc: 'boundary line', pipeSize, pressure, selIso });

    const out = await readOutput(page);
    expect(out.minReqText, `minReq for score ${score}`).toBe(ISOLATION_TEXT[minIso]);
    expect(out.outcome,    `meets for score ${score}`).toBe(meets ? MEETS_TEXT : NOT_MEETS_TEXT);
    return score;
}

// --- Threshold 29: single vs SBB ---

test('score 28 requires single isolation @quick', async ({ page }) => {
    const score = await bocOutcome(page, {
        substance: 'nonHaz', period: 'upToWeek', pipeSize: 1, pressure: 100, selIso: 'sbb',
    });
    expect(score, 'expected score 28').toBe(28);
});

test('score 30 requires SBB isolation @quick', async ({ page }) => {
    const score = await bocOutcome(page, {
        substance: 'nonHaz', period: 'moreWeek', pipeSize: 1, pressure: 50, selIso: 'sbb',
    });
    expect(score, 'expected score 30').toBe(30);
});

test('score 30 — single valve does not meet SBB minimum @quick', async ({ page }) => {
    const score = await bocOutcome(page, {
        substance: 'nonHaz', period: 'moreWeek', pipeSize: 1, pressure: 50, selIso: 'single',
    });
    expect(score, 'expected score 30').toBe(30);
});

// --- Threshold 89: SBB vs DBB ---

test('score 84 requires SBB isolation @quick', async ({ page }) => {
    const score = await bocOutcome(page, {
        substance: 'haz', period: 'upToWeek', pipeSize: 1, pressure: 100, selIso: 'dbb',
    });
    expect(score, 'expected score 84').toBe(84);
});

test('score 90 requires DBB isolation @quick', async ({ page }) => {
    const score = await bocOutcome(page, {
        substance: 'flammable', period: 'oneOrLess', pipeSize: 1, pressure: 50, selIso: 'dbb',
    });
    expect(score, 'expected score 90').toBe(90);
});

test('score 90 — SBB does not meet DBB minimum @quick', async ({ page }) => {
    const score = await bocOutcome(page, {
        substance: 'flammable', period: 'oneOrLess', pipeSize: 1, pressure: 50, selIso: 'sbb',
    });
    expect(score, 'expected score 90').toBe(90);
});

// --- Threshold 450: DBB vs spade ---

test('score 420 requires DBB isolation @quick', async ({ page }) => {
    const score = await bocOutcome(page, {
        substance: 'flammable', period: 'upToWeek', pipeSize: 12, pressure: 10, selIso: 'dbb',
    });
    expect(score, 'expected score 420').toBe(420);
});

test('score 490 requires spade isolation @quick', async ({ page }) => {
    const score = await bocOutcome(page, {
        substance: 'flammable', period: 'upToWeek', pipeSize: 12, pressure: 20, selIso: 'spade',
    });
    expect(score, 'expected score 490').toBe(490);
});

test('score 490 — DBB does not meet spade minimum @quick', async ({ page }) => {
    const score = await bocOutcome(page, {
        substance: 'flammable', period: 'upToWeek', pipeSize: 12, pressure: 20, selIso: 'dbb',
    });
    expect(score, 'expected score 490').toBe(490);
});

// --- Boundary isolation with pressure forced to 0 ---

test('boundary isolation forces pressure 0 in calculation @quick', async ({ page }) => {
    // When boundary is checked, showSpec sets pressure = 0.
    // Test that leaving the field at 0 produces a valid result.
    await fillStage1(page, {
        title: 'boundary pressure 0 test',
        purpose: 'boc',
        substance: 'flammable',
        period: 'moreWeek',
        boundary: true,
    });
    // Do NOT fill pressure — leave at 0 as set by the app
    await fillStage2AndCalculate(page, {
        lineDesc: 'zero pressure line',
        pipeSize: 24,
        pressure: undefined,
        selIso: 'spade',
    });

    const out = await readOutput(page);
    expect(out.boundary,  'boundary flag').toBe('Yes');
    expect(out.pressure,  'pressure value').toBe('0 bar');
    expect(out.outImg,    'outImg').toBeDefined();
    // Score with pressure=0, pipe=24, flammable, moreWeek:
    // releaseMatrix row 0, col 5 (<10) = 6; score = 10 × 10 × 6 = 600 > 450 → spade
    const score  = calcScore({ purpose: 'boc', substance: 'flammable', period: 'moreWeek', pipeSize: 24, pressure: 0 });
    const minIso = minimumIsolation(score);
    expect(out.minReqText, 'minReq').toBe(ISOLATION_TEXT[minIso]);
});

// --- SBT fixed pipe size ---

test('SBT always uses 0.5 inch pipe size @quick', async ({ page }) => {
    await fillStage1(page, {
        title: 'SBT pipe size check',
        purpose: 'sbt',
        substance: 'flammable',
        period: 'moreWeek',
    });
    await fillStage2AndCalculate(page, {
        lineDesc: 'SBT line',
        pressure: 100,
        selIso: 'sbb',
    });

    const out = await readOutput(page);
    expect(out.pipe, 'pipe fixed to 0.5').toBe('0.5 inches');
});

// --- Pressure band boundaries ---

test.describe('Pressure column transitions', () => {
    const cases = [
        { pressure: 150, label: '>=150', expectedCol: 0 },
        { pressure: 149, label: '<150 >=100', expectedCol: 1 },
        { pressure: 100, label: '>=100', expectedCol: 1 },
        { pressure: 99,  label: '<100 >=50', expectedCol: 2 },
        { pressure: 50,  label: '>=50', expectedCol: 2 },
        { pressure: 49,  label: '<50 >=20', expectedCol: 3 },
        { pressure: 20,  label: '>=20', expectedCol: 3 },
        { pressure: 19,  label: '<20 >=10', expectedCol: 4 },
        { pressure: 10,  label: '>=10', expectedCol: 4 },
        { pressure: 9,   label: '<10', expectedCol: 5 },
        { pressure: 0,   label: '0 bar', expectedCol: 5 },
    ];

    for (const { pressure, label } of cases) {
        test(`pipe=6 flammable moreWeek pressure=${pressure} (${label}) @quick`, async ({ page }) => {
            const score  = calcScore({ purpose: 'boc', substance: 'flammable', period: 'moreWeek', pipeSize: 6, pressure });
            const minIso = minimumIsolation(score);

            await fillStage1(page, { title: `pressure ${pressure}`, purpose: 'boc', substance: 'flammable', period: 'moreWeek' });
            await fillStage2AndCalculate(page, { lineDesc: 'p-band test', pipeSize: 6, pressure, selIso: 'spade' });

            const out = await readOutput(page);
            expect(out.pressure,   'pressure output').toBe(`${pressure} bar`);
            expect(out.minReqText, 'minReq').toBe(ISOLATION_TEXT[minIso]);
        });
    }
});

// --- Pipe-size band boundaries ---

test.describe('Pipe size row transitions', () => {
    const cases = [
        { pipeSize: 24,   label: '>=24' },
        { pipeSize: 23.9, label: '<24 >=12' },
        { pipeSize: 12,   label: '>=12' },
        { pipeSize: 11.9, label: '<12 >=6' },
        { pipeSize: 6,    label: '>=6' },
        { pipeSize: 5.9,  label: '<6 >1' },
        { pipeSize: 1.1,  label: '>1' },
        { pipeSize: 1,    label: '<=1' },
        { pipeSize: 0.5,  label: '<1 (SBT range)' },
    ];

    for (const { pipeSize, label } of cases) {
        test(`nonHaz moreWeek pipeSize=${pipeSize} (${label}) @quick`, async ({ page }) => {
            const score  = calcScore({ purpose: 'boc', substance: 'nonHaz', period: 'moreWeek', pipeSize, pressure: 150 });
            const minIso = minimumIsolation(score);

            await fillStage1(page, { title: `pipe ${pipeSize}`, purpose: 'boc', substance: 'nonHaz', period: 'moreWeek' });
            await fillStage2AndCalculate(page, { lineDesc: 'pipe-band test', pipeSize, pressure: 150, selIso: 'spade' });

            const out = await readOutput(page);
            expect(out.pipe,       'pipe output').toBe(`${pipeSize} inches`);
            expect(out.minReqText, 'minReq').toBe(ISOLATION_TEXT[minIso]);
        });
    }
});
