import { test, expect } from '@playwright/test';
import {
    fillStage1, expectStage2, fillStage2AndCalculate, readOutput,
    requiredCategory, meets, CATEGORY_LABEL, CATEGORY_IMG, ISO_TO_CATEGORY,
} from './helpers.js';

const GROUPS    = [1, 2, 3, 4];
const PERIODS   = ['oneOrLess', 'moreThanShift'];
const HOTWORK   = [false, true];
// spade is never user-selectable; it is covered by positive-iso-risk.spec.js
const ISO_TYPES = ['dbb', 'twin_seal', 'sbb', 'single'];

// Full group × duration × hotwork × selected-isolation matrix.
const combinations = [];
for (const group of GROUPS)
    for (const period of PERIODS)
        for (const hotWork of HOTWORK)
            for (const selIso of ISO_TYPES)
                combinations.push({ group, period, hotWork, selIso });

test.describe('Group/duration/hot-work decision table', () => {
    for (const c of combinations) {
        const longDuration = c.period === 'moreThanShift';
        const reqCat = requiredCategory({ group: c.group, longDuration, hotWork: c.hotWork });
        const ok     = meets(c.selIso, reqCat);
        const label  = `g${c.group} ${c.period} hw=${c.hotWork} iso=${c.selIso}`;

        test(label, async ({ page }) => {
            await fillStage1(page, {
                title: label,
                otherGroup: c.group,
                otherName: `Fluid ${label}`,
                temp: 20,
                period: c.period,
                hotWork: c.hotWork,
            });
            await expectStage2(page);
            await fillStage2AndCalculate(page, { selIso: c.selIso });

            const out = await readOutput(page);
            expect(out.minReqText, 'required category').toContain(CATEGORY_LABEL[reqCat]);
            expect(out.minReqImg,  'required image').toContain(`${CATEGORY_IMG[reqCat]}.png`);
            expect(out.selIsoText, 'selected category').toContain(CATEGORY_LABEL[ISO_TO_CATEGORY[c.selIso]]);

            if (ok) {
                expect(out.outcome).toContain('meets the minimum standard');
                expect(out.outImg).toContain('caution');
                expect(out.controlsHeading).toBe('Isolation Controls required are:');
            } else {
                expect(out.outcome).toContain('does not meet the minimum standard');
                expect(out.outImg).toContain('stop');
                expect(out.controlsHeading).toContain('Suggested controls');
            }
        });
    }
});

test('hot work does NOT escalate groups 3 and 4', async ({ page }) => {
    // Group 3, one shift, hot work → still IIB (hot work only affects groups 1 & 2).
    await fillStage1(page, { otherGroup: 3, otherName: 'G3', temp: 20, period: 'oneOrLess', hotWork: true });
    await expectStage2(page);
    await fillStage2AndCalculate(page, { selIso: 'dbb' });
    const out = await readOutput(page);
    expect(out.minReqText).toContain('Category IIB');
});

test('twin seal valve maps to Category IIA same as DBB', async ({ page }) => {
    // Group 1, short, no hot work → requires IIA. Twin seal satisfies IIA.
    await fillStage1(page, { otherGroup: 1, otherName: 'G1', temp: 20, period: 'oneOrLess' });
    await expectStage2(page);
    await fillStage2AndCalculate(page, { selIso: 'twin_seal' });
    const out = await readOutput(page);
    expect(out.selIsoText).toContain('Category IIA');
    expect(out.selIsoImg).toContain('twin_seal');
    expect(out.outcome).toContain('meets the minimum standard');
});
