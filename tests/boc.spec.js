import { test, expect } from '@playwright/test';
import {
    fillStage1, fillStage2AndCalculate, readOutput,
    calcScore, minimumIsolation, isolationMeets,
    SUBSTANCE_TEXT, DURATION_TEXT, ISOLATION_TEXT,
    MEETS_TEXT, NOT_MEETS_TEXT,
} from './helpers.js';

const SUBSTANCES  = ['flammable', 'haz', 'nonHaz'];
const PERIODS     = ['oneOrLess', 'upToWeek', 'moreWeek'];
const PIPE_SIZES  = [24, 12, 6, 2, 1];
const PRESSURES   = [150, 100, 50, 20, 10, 5];
const ISO_TYPES   = ['spade', 'dbb', 'sbb', 'single'];
const BOUNDARIES  = [false, true];

// 3 × 3 × 2 × 5 × 6 × 4 = 2160 combinations
const combinations = [];
for (const substance of SUBSTANCES)
    for (const period of PERIODS)
        for (const boundary of BOUNDARIES)
            for (const pipeSize of PIPE_SIZES)
                for (const pressure of PRESSURES)
                    for (const selIso of ISO_TYPES)
                        combinations.push({ substance, period, boundary, pipeSize, pressure, selIso });

test.describe('BoC full combinations', () => {
    for (const c of combinations) {
        const score   = calcScore({ purpose: 'boc', ...c });
        const minIso  = minimumIsolation(score);
        const meets   = isolationMeets(c.selIso, score);
        const label   = `${c.substance} ${c.period} bnd=${c.boundary} pipe=${c.pipeSize} p=${c.pressure} iso=${c.selIso}`;

        test(label, async ({ page }) => {
            await fillStage1(page, {
                title: label,
                purpose: 'boc',
                substance: c.substance,
                period: c.period,
                boundary: c.boundary,
            });
            await fillStage2AndCalculate(page, {
                lineDesc: `Line: ${label}`,
                pipeSize: c.pipeSize,
                pressure: c.pressure,
                selIso: c.selIso,
            });

            const out = await readOutput(page);

            expect(out.title,      'title').toBe(label);
            expect(out.purpose,    'purpose').toBe('Breaking of Containment');
            expect(out.substance,  'substance').toBe(SUBSTANCE_TEXT[c.substance]);
            expect(out.duration,   'duration').toBe(DURATION_TEXT[c.period]);
            expect(out.boundary,   'boundary').toBe(c.boundary ? 'Yes' : 'No');
            expect(out.pipe,       'pipe').toBe(`${c.pipeSize} inches`);
            expect(out.pressure,   'pressure').toBe(`${c.pressure} bar`);
            expect(out.lineDesc,   'lineDesc').toBe(`Line: ${label}`);
            expect(out.minReqText, 'minReqText').toBe(ISOLATION_TEXT[minIso]);
            expect(out.minReqImg,  'minReqImg').toContain(`${minIso}.png`);
            expect(out.isoSel,     'isoSel').toBe(ISOLATION_TEXT[c.selIso]);
            expect(out.selIsoImg,  'selIsoImg').toContain(`${c.selIso}.png`);
            expect(out.outcome,    'outcome').toBe(meets ? MEETS_TEXT : NOT_MEETS_TEXT);
            expect(out.outImg,     'outImg').toContain(meets ? 'caution' : 'stop');
        });
    }
});
