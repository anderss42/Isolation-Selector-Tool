import { test, expect } from '@playwright/test';
import {
    fillStage1, fillStage2AndCalculate, readOutput,
    calcScore, minimumIsolation, isolationMeets,
    SUBSTANCE_TEXT, DURATION_TEXT, ISOLATION_TEXT,
    MEETS_TEXT, NOT_MEETS_TEXT,
} from './helpers.js';

// SBT score is always 80 regardless of substance/period/pipe/pressure.
// Minimum required isolation for score 80: SBB (80 > 29, 80 <= 89).
// Pipe size is fixed by the app to 0.5 inches for SBT.

const SUBSTANCES = ['flammable', 'haz', 'nonHaz'];
const PERIODS    = ['oneOrLess', 'upToWeek', 'moreWeek'];
const PRESSURES  = [150, 100, 50, 20, 10, 5];
const BOUNDARIES = [false, true];
const ISO_TYPES  = ['spade', 'dbb', 'sbb', 'single'];

// 3 × 3 × 2 × 6 × 4 = 432 combinations
const combinations = [];
for (const substance of SUBSTANCES)
    for (const period of PERIODS)
        for (const boundary of BOUNDARIES)
            for (const pressure of PRESSURES)
                for (const selIso of ISO_TYPES)
                    combinations.push({ substance, period, boundary, pressure, selIso });

test.describe('SBT full combinations', () => {
    for (const c of combinations) {
        const score  = calcScore({ purpose: 'sbt' });
        const minIso = minimumIsolation(score);
        const meets  = isolationMeets(c.selIso, score);
        const label  = `SBT ${c.substance} ${c.period} bnd=${c.boundary} p=${c.pressure} iso=${c.selIso}`;

        test(label, async ({ page }) => {
            await fillStage1(page, {
                title: label,
                purpose: 'sbt',
                substance: c.substance,
                period: c.period,
                boundary: c.boundary,
            });
            // Pipe size is set to 0.5 automatically by the app for SBT — do not override
            await fillStage2AndCalculate(page, {
                lineDesc: `SBT line: ${label}`,
                pressure: c.pressure,
                selIso: c.selIso,
            });

            const out = await readOutput(page);

            expect(out.title,      'title').toBe(label);
            expect(out.purpose,    'purpose').toBe('Small Bore Tubing 1/2 inch or less.');
            expect(out.substance,  'substance').toBe(SUBSTANCE_TEXT[c.substance]);
            expect(out.duration,   'duration').toBe(DURATION_TEXT[c.period]);
            expect(out.boundary,   'boundary').toBe(c.boundary ? 'Yes' : 'No');
            expect(out.pipe,       'pipe').toBe('0.5 inches');
            expect(out.pressure,   'pressure').toBe(`${c.pressure} bar`);
            expect(out.minReqText, 'minReqText').toBe(ISOLATION_TEXT[minIso]);
            expect(out.outcome,    'outcome').toBe(meets ? MEETS_TEXT : NOT_MEETS_TEXT);
        });
    }
});
