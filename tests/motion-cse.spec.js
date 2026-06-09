import { test, expect } from '@playwright/test';
import {
    fillStage1, fillStage2AndCalculate, readOutput,
    calcScore, minimumIsolation, isolationMeets,
    ISOLATION_TEXT, MEETS_TEXT, NOT_MEETS_TEXT,
} from './helpers.js';

// Motion score = 80, minimum = SBB
// CSE score = 900, minimum = spade

const ISO_TYPES = ['spade', 'dbb', 'sbb', 'single'];

test.describe('Motion isolation', () => {
    for (const selIso of ISO_TYPES) {
        test(`Motion iso=${selIso} @quick`, async ({ page }) => {
            const score  = calcScore({ purpose: 'motion' });
            const minIso = minimumIsolation(score);
            const meets  = isolationMeets(selIso, score);

            await fillStage1(page, { title: `Motion ${selIso}`, purpose: 'motion' });
            await fillStage2AndCalculate(page, { selIso });

            const out = await readOutput(page);

            expect(out.purpose,    'purpose').toBe('To prevent motion in equipment for non-invasive work');
            expect(out.substance,  'substance').toBe('N/A');
            expect(out.duration,   'duration').toBe('N/A');
            expect(out.pipe,       'pipe').toBe('N/A');
            expect(out.pressure,   'pressure').toBe('N/A');
            expect(out.minReqText, 'minReqText').toBe(ISOLATION_TEXT[minIso]);
            expect(out.outcome,    'outcome').toBe(meets ? MEETS_TEXT : NOT_MEETS_TEXT);
            expect(out.outImg,     'outImg').toContain(meets ? 'caution' : 'stop');
        });
    }

    test('Motion with no isolation selected defaults to single @quick', async ({ page }) => {
        const score  = calcScore({ purpose: 'motion' });
        const meets  = isolationMeets('single', score);

        await fillStage1(page, { title: 'Motion no iso', purpose: 'motion' });
        // Do not select an isolation type — app defaults to single
        await page.click('#calcBtn');
        await page.locator('#outCard').waitFor({ state: 'visible' });

        const out = await readOutput(page);
        expect(out.isoSel,  'isoSel default').toBe(ISOLATION_TEXT.single);
        expect(out.outcome, 'outcome default').toBe(meets ? MEETS_TEXT : NOT_MEETS_TEXT);
    });
});

test.describe('CSE isolation', () => {
    for (const selIso of ISO_TYPES) {
        test(`CSE iso=${selIso} @quick`, async ({ page }) => {
            const score  = calcScore({ purpose: 'cse' });
            const minIso = minimumIsolation(score);
            const meets  = isolationMeets(selIso, score);

            await fillStage1(page, { title: `CSE ${selIso}`, purpose: 'cse' });
            await fillStage2AndCalculate(page, { selIso });

            const out = await readOutput(page);

            expect(out.purpose,    'purpose').toBe('For confined space entry');
            expect(out.substance,  'substance').toBe('N/A');
            expect(out.duration,   'duration').toBe('N/A');
            expect(out.pipe,       'pipe').toBe('N/A');
            expect(out.pressure,   'pressure').toBe('N/A');
            expect(out.minReqText, 'minReqText').toBe(ISOLATION_TEXT[minIso]);
            expect(out.outcome,    'outcome').toBe(meets ? MEETS_TEXT : NOT_MEETS_TEXT);
            expect(out.outImg,     'outImg').toContain(meets ? 'caution' : 'stop');
        });
    }

    test('CSE with no isolation selected defaults to single @quick', async ({ page }) => {
        const score  = calcScore({ purpose: 'cse' });
        const meets  = isolationMeets('single', score);

        await fillStage1(page, { title: 'CSE no iso', purpose: 'cse' });
        await page.click('#calcBtn');
        await page.locator('#outCard').waitFor({ state: 'visible' });

        const out = await readOutput(page);
        expect(out.isoSel,  'isoSel default').toBe(ISOLATION_TEXT.single);
        expect(out.outcome, 'outcome default').toBe(meets ? MEETS_TEXT : NOT_MEETS_TEXT);
    });
});
