// Independent expected-result model for the HSG253 decision tree.
// Deliberately re-derived from the requirements doc, not imported from the app.

export const GROUP_NAMES = { 1: 'Highly Dangerous', 2: 'Dangerous', 3: 'Hazardous', 4: 'Non-hazardous' };

// Base group per standard fluid (mirrors FLUIDS in the app).
export const FLUID_GROUPS = {
    'Natural Gas': 1, 'NGL': 1, 'Crude Oil': 1,
    'Methanol': 2, 'CRW85733': 2, 'Proxel XL2': 2, 'GT-7511': 2, 'Corrtreat 15340': 2, 'Biotreat 4632': 2,
    'Diesel': 3, 'Aviation Fuel': 3, 'MEG': 3, 'R410A': 3, 'Scaletreat 8019': 3, 'Phasetreat 13647': 3,
    'CRW85689': 3, 'RBW85165': 3, 'HW 443 ND': 3, 'Brayco Micronic SV/3': 3, 'Foamtreat SOC313': 3,
    'Seawater': 4, 'TEG': 4,
};

export function tempGroup(t) {
    if (t > 60 || t < -10) return 1;
    if ((t > 50 && t <= 60) || (t < 0 && t >= -10)) return 3;
    return 4;
}

export function finalGroup(baseGroup, temp) {
    if (Number.isNaN(temp)) return baseGroup;
    return Math.min(baseGroup, tempGroup(temp));
}

export function requiredCategory({ cse, boundary, flareVentDrains, sbt, group, longDuration, hotWork }) {
    if (cse)             return 'I';
    if (boundary)        return 'III';
    if (flareVentDrains) return 'III';
    if (sbt)             return group <= 2 ? 'IIB' : 'III';
    if (group <= 2)      return (longDuration || hotWork) ? 'I' : 'IIA';
    if (group === 3)     return longDuration ? 'IIA' : 'IIB';
    return longDuration ? 'IIB' : 'III';
}

export const CATEGORY_RANK  = { I: 4, IIA: 3, IIB: 2, III: 1 };
export const ISO_TO_CATEGORY = { spade: 'I', dbb: 'IIA', sbb: 'IIB', single: 'III' };
export const CATEGORY_LABEL = { I: 'Category I', IIA: 'Category IIA', IIB: 'Category IIB', III: 'Category III' };
export const CATEGORY_IMG   = { I: 'spade', IIA: 'dbb', IIB: 'sbb', III: 'single' };

export function meets(selIso, requiredCat) {
    return CATEGORY_RANK[ISO_TO_CATEGORY[selIso]] >= CATEGORY_RANK[requiredCat];
}

// Offshore/onshore describe where the approver resides, not where the work is done.
// Some rows have an offshore approver only (onshore: null).
export function getAuthorisers(group, requiredCat) {
    if (group <= 2) {
        if (requiredCat === 'I')   return { offshore: 'OIM', onshore: 'Process TA & Operations Manager' };
        if (requiredCat === 'IIA') return { offshore: 'OIM', onshore: 'Process Engineer' };
    } else {
        if (requiredCat === 'I')   return { offshore: 'OIM', onshore: 'Process TA & Operations Manager' };
        if (requiredCat === 'IIA') return { offshore: 'Department Head', onshore: null };
        if (requiredCat === 'IIB') return { offshore: 'Area Authority', onshore: null };
    }
    return null;
}

// --- Page interaction helpers ---

// Fills the System Properties form (respecting the progressive reveal) and
// clicks Next. Does NOT wait afterwards — the caller chooses whether to expect
// stage 2 (selector) or a shutdown outcome.
export async function fillStage1(page, opts) {
    const {
        title = 'Test isolation',
        majorAccident = 'no', waitShutdown = 'no',
        fluidLabel, otherName, otherGroup, temp, period,
        hotWork, cse, flareVentDrains, sbt, boundary, iccNo,
    } = opts;

    await page.goto('/');
    await page.fill('#isoTitle', title);

    // Step 2 — planning checks appear once the title is entered.
    await page.locator('#gatingBlock').waitFor({ state: 'visible' });
    await page.check(majorAccident === 'yes' ? '#majorAccidentYes' : '#majorAccidentNo');
    await page.check(waitShutdown === 'yes' ? '#waitShutdownYes' : '#waitShutdownNo');

    const defers = majorAccident === 'yes' || waitShutdown === 'yes';
    if (!defers) {
        // Step 3 — the rest appears once both checks are "No".
        await page.locator('#restBlock').waitFor({ state: 'visible' });

        if (fluidLabel)      await page.selectOption('#fluidSelect', { label: fluidLabel });
        else if (otherGroup) {
            await page.selectOption('#fluidSelect', 'other');
            if (otherName) await page.fill('#otherFluidName', otherName);
            await page.selectOption('#otherFluidGroup', String(otherGroup));
        }

        if (temp !== undefined) await page.fill('#operatingTemp', String(temp));
        if (period)             await page.selectOption('#period', period);
        if (hotWork)            await page.check('#hotWork');
        if (cse)                await page.check('#cse');
        if (flareVentDrains)    await page.check('#flareVentDrains');
        if (sbt)                await page.check('#sbt');
        if (boundary)           await page.check('#boundary');
        if (iccNo)              await page.fill('#iccNo', String(iccNo));
    }

    await page.click('#nextBtn');
}

export async function expectStage2(page) {
    await page.locator('#calcBtn').waitFor({ state: 'visible' });
}

export async function fillStage2AndCalculate(page, { lineDesc = 'Test line', selIso }) {
    await page.fill('#lineDesc', lineDesc);
    if (selIso) await page.locator(`label[for="${selIso}"]`).click();
    await page.click('#calcBtn');
    await page.locator('#outCard').waitFor({ state: 'visible' });
}

export async function readOutput(page) {
    const controls = await Promise.all(
        [1, 2, 3, 4, 5, 6].map(i => page.locator(`#listControl${i}`).textContent()),
    );
    return {
        title:       (await page.locator('#outTitle').textContent()).trim(),
        fluid:       (await page.locator('#outSub').textContent()).trim(),
        temp:        (await page.locator('#outTemp').textContent()).trim(),
        duration:    (await page.locator('#outDur').textContent()).trim(),
        lineDesc:    (await page.locator('#outLineDesc').textContent()).trim(),
        hotWork:     (await page.locator('#outHotWork').textContent()).trim(),
        cse:         (await page.locator('#outCSE').textContent()).trim(),
        exempt:      (await page.locator('#outExempt').textContent()).trim(),
        boundary:    (await page.locator('#outBound').textContent()).trim(),
        isoSel:      (await page.locator('#outIsoSel').textContent()).trim(),
        minReqText:  (await page.locator('#outIsoText').textContent()).trim(),
        minReqImg:   await page.locator('#outIsoImg').getAttribute('src'),
        selIsoText:  (await page.locator('#outIsoSelText').textContent()).trim(),
        selIsoImg:   await page.locator('#outSelIsoImg').getAttribute('src'),
        outcome:     (await page.locator('#isoOutcome').textContent()).trim(),
        authGuidance:(await page.locator('#authGuidance').textContent()).trim(),
        outImg:      await page.locator('#outImg').getAttribute('src'),
        controls:    controls.map(t => t.trim()).filter(t => t !== ''),
    };
}
