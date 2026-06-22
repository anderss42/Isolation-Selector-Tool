import { test, expect } from '@playwright/test';
import { fillStage1, expectStage2, fillStage2AndCalculate } from './helpers.js';

async function run(page, stage1, selIso = 'dbb') {
    await fillStage1(page, { temp: 20, period: 'oneOrLess', ...stage1 });
    await expectStage2(page);
    await fillStage2AndCalculate(page, { selIso });
}

async function isDriverCell(page, cellId) {
    return page.locator(`#${cellId}`).evaluate(el => (
        el.style.color === 'red' && el.style.fontWeight === 'bold'
    ));
}

async function isNotHighlighted(page, cellId) {
    return page.locator(`#${cellId}`).evaluate(el => (
        el.style.color !== 'red'
    ));
}

test('CSE drives → outCSE is highlighted red and bold', async ({ page }) => {
    await fillStage1(page, { otherGroup: 2, otherName: 'G2', temp: 20, period: 'oneOrLess', cse: true });
    await expectStage2(page);
    await fillStage2AndCalculate(page);
    expect(await isDriverCell(page, 'outCSE')).toBe(true);
    expect(await isNotHighlighted(page, 'outHotWork')).toBe(true);
    expect(await isNotHighlighted(page, 'outDur')).toBe(true);
});

test('positiveIsoRisk=no drives → outPosIsoRisk is highlighted', async ({ page }) => {
    await fillStage1(page, { otherGroup: 1, otherName: 'G1', temp: 20, period: 'oneOrLess', positiveIsoRisk: false });
    await expectStage2(page);
    await fillStage2AndCalculate(page);
    expect(await isDriverCell(page, 'outPosIsoRisk')).toBe(true);
    expect(await isNotHighlighted(page, 'outCSE')).toBe(true);
});

test('hotWork drives (G1, short) → outHotWork is highlighted', async ({ page }) => {
    await run(page, { otherGroup: 1, otherName: 'G1', hotWork: true });
    expect(await isDriverCell(page, 'outHotWork')).toBe(true);
    expect(await isNotHighlighted(page, 'outDur')).toBe(true);
});

test('boundary drives → outBound is highlighted', async ({ page }) => {
    await run(page, { otherGroup: 1, otherName: 'G1', boundary: true });
    expect(await isDriverCell(page, 'outBound')).toBe(true);
});

test('long duration drives (G3) → outDur is highlighted', async ({ page }) => {
    await fillStage1(page, { otherGroup: 3, otherName: 'G3', temp: 20, period: 'moreThanShift' });
    await expectStage2(page);
    await fillStage2AndCalculate(page, { selIso: 'dbb' });
    expect(await isDriverCell(page, 'outDur')).toBe(true);
    expect(await isNotHighlighted(page, 'outHotWork')).toBe(true);
});

test('fluid group/substance drives (G1, short, no hotwork) → outSub is highlighted', async ({ page }) => {
    await run(page, { otherGroup: 1, otherName: 'G1', period: 'oneOrLess' });
    expect(await isDriverCell(page, 'outSub')).toBe(true);
    expect(await isNotHighlighted(page, 'outHotWork')).toBe(true);
    expect(await isNotHighlighted(page, 'outDur')).toBe(true);
});

test('FVD drives → outExempt is highlighted', async ({ page }) => {
    await run(page, { otherGroup: 1, otherName: 'G1', flareVentDrains: true });
    expect(await isDriverCell(page, 'outExempt')).toBe(true);
});

test('SBT drives → outExempt is highlighted', async ({ page }) => {
    await run(page, { otherGroup: 1, otherName: 'G1', sbt: true });
    expect(await isDriverCell(page, 'outExempt')).toBe(true);
});

test('only one cell is highlighted as driver at a time', async ({ page }) => {
    // hotWork scenario: only outHotWork should be red, not outDur and outSub both
    await run(page, { otherGroup: 1, otherName: 'G1', hotWork: true });
    const allCells = ['outPosIsoRisk', 'outHotWork', 'outCSE', 'outExempt', 'outBound', 'outDur', 'outSub'];
    let highlightedCount = 0;
    for (const id of allCells) {
        const highlighted = await isDriverCell(page, id);
        if (highlighted) highlightedCount++;
    }
    expect(highlightedCount).toBe(1);
});
