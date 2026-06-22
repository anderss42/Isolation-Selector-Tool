import { test, expect } from '@playwright/test';
import { fillStage1, expectStage2, fillStage2AndCalculate, readOutput, FLUID_GROUPS } from './helpers.js';

// Every named fluid in the dropdown should produce the correct Group label in the output.
const FLUID_CASES = Object.entries(FLUID_GROUPS);

test.describe('Named fluid groups', () => {
    for (const [fluid, expectedGroup] of FLUID_CASES) {
        test(`${fluid} → Group ${expectedGroup}`, async ({ page }) => {
            await fillStage1(page, {
                fluidLabel: fluid,
                temp: 20,       // neutral — no temperature escalation
                period: 'oneOrLess',
            });
            await expectStage2(page);
            await fillStage2AndCalculate(page, { selIso: 'dbb' });
            const out = await readOutput(page);
            expect(out.fluid, `fluid: ${fluid}`).toContain(fluid);
            expect(out.fluid, `fluid: ${fluid} group`).toContain(`Group ${expectedGroup}`);
            expect(out.fluid).not.toContain('escalated'); // no temperature escalation expected
        });
    }
});

test('"Other" fluid uses the manually entered group', async ({ page }) => {
    await fillStage1(page, {
        otherName: 'My Custom Fluid',
        otherGroup: 2,
        temp: 20,
        period: 'oneOrLess',
    });
    await expectStage2(page);
    await fillStage2AndCalculate(page, { selIso: 'dbb' });
    const out = await readOutput(page);
    expect(out.fluid).toContain('My Custom Fluid');
    expect(out.fluid).toContain('Group 2');
});

test('"Other" fluid group 4 can be escalated by temperature', async ({ page }) => {
    await fillStage1(page, {
        otherName: 'Custom Hot Fluid',
        otherGroup: 4,
        temp: 65,   // above 60 → escalates to Group 1
        period: 'oneOrLess',
    });
    await expectStage2(page);
    await fillStage2AndCalculate(page, { selIso: 'dbb' });
    const out = await readOutput(page);
    expect(out.fluid).toContain('Group 1');
    expect(out.fluid).toContain('escalated from Group 4');
});

// Temperature boundary cases
test.describe('Temperature boundary cases', () => {
    async function groupForTemp(page, temp, baseGroup = 4) {
        await fillStage1(page, { otherGroup: baseGroup, otherName: 'TempTest', temp, period: 'oneOrLess' });
        await expectStage2(page);
        await fillStage2AndCalculate(page, { selIso: 'dbb' });
        return (await readOutput(page)).fluid;
    }

    test('exactly 50°C — no escalation (boundary: 0–50 is safe)', async ({ page }) => {
        const fluid = await groupForTemp(page, 50);
        expect(fluid).toContain('Group 4');
        expect(fluid).not.toContain('escalated');
    });

    test('50.1°C escalates to Group 3', async ({ page }) => {
        const fluid = await groupForTemp(page, 51);
        expect(fluid).toContain('Group 3');
        expect(fluid).toContain('escalated from Group 4');
    });

    test('exactly 60°C escalates to Group 3 (boundary: 50 < t ≤ 60)', async ({ page }) => {
        const fluid = await groupForTemp(page, 60);
        expect(fluid).toContain('Group 3');
    });

    test('61°C escalates to Group 1', async ({ page }) => {
        const fluid = await groupForTemp(page, 61);
        expect(fluid).toContain('Group 1');
    });

    test('exactly 0°C — no escalation (boundary: 0 is not < 0)', async ({ page }) => {
        const fluid = await groupForTemp(page, 0);
        expect(fluid).toContain('Group 4');
        expect(fluid).not.toContain('escalated');
    });

    test('-1°C escalates to Group 3', async ({ page }) => {
        const fluid = await groupForTemp(page, -1);
        expect(fluid).toContain('Group 3');
        expect(fluid).toContain('escalated from Group 4');
    });

    test('exactly -10°C escalates to Group 3 (boundary: t >= -10 and t < 0)', async ({ page }) => {
        const fluid = await groupForTemp(page, -10);
        expect(fluid).toContain('Group 3');
    });

    test('-11°C escalates to Group 1', async ({ page }) => {
        const fluid = await groupForTemp(page, -11);
        expect(fluid).toContain('Group 1');
    });

    test('temperature never downgrades a more onerous base group', async ({ page }) => {
        // Group 1 at a benign 20°C stays Group 1
        const fluid = await groupForTemp(page, 20, 1);
        expect(fluid).toContain('Group 1');
        expect(fluid).not.toContain('escalated');
    });
});
