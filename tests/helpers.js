// Independent expected-result model for the HSG253 decision tree.
// Deliberately re-derived from the requirements doc, not imported from the app.

export const GROUP_NAMES = { 1: 'Highly Dangerous', 2: 'Dangerous', 3: 'Hazardous', 4: 'Non-hazardous' };

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

// positiveIsoRisk: boolean — false = "No, safe to fit spade" → forces Category I
// All other booleans: true = Yes
export function requiredCategory({ cse, boundary, flareVentDrains, sbt, group, longDuration, hotWork, positiveIsoRisk }) {
    if (positiveIsoRisk === false) return 'I';
    if (cse)             return 'I';
    if (boundary)        return 'III';
    if (flareVentDrains) return 'III';
    if (sbt)             return group <= 2 ? 'IIB' : 'III';
    if (group <= 2)      return (longDuration || hotWork) ? 'I' : 'IIA';
    if (group === 3)     return longDuration ? 'IIA' : 'IIB';
    return longDuration ? 'IIB' : 'III';
}

export const CATEGORY_RANK   = { I: 4, IIA: 3, IIB: 2, III: 1 };
export const ISO_TO_CATEGORY = { spade: 'I', dbb: 'IIA', twin_seal: 'IIA', sbb: 'IIB', single: 'III' };
export const CATEGORY_LABEL  = { I: 'Category I', IIA: 'Category IIA', IIB: 'Category IIB', III: 'Category III' };
export const CATEGORY_IMG    = { I: 'spade', IIA: 'dbb', IIB: 'sbb', III: 'single' };

export function meets(selIso, requiredCat) {
    return CATEGORY_RANK[ISO_TO_CATEGORY[selIso]] >= CATEGORY_RANK[requiredCat];
}

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

// Answers all six Yes/No questions in the progressive chain, waiting for each to appear.
// positiveIsoRisk: boolean (true=Yes/use valves, false=No/safe to fit spade)
async function answerProgressiveQuestions(page, {
    positiveIsoRisk = true,
    hotWork = false,
    cse = false,
    flareVentDrains = false,
    sbt = false,
    boundary = false,
} = {}) {
    // Q1 is always visible once restBlock appears
    await page.locator(`input[name="positiveIsoRisk"][value="${positiveIsoRisk ? 'yes' : 'no'}"]`).check();

    await page.locator('#qHotWork').waitFor({ state: 'visible' });
    await page.locator(`input[name="hotWork"][value="${hotWork ? 'yes' : 'no'}"]`).check();

    await page.locator('#qCse').waitFor({ state: 'visible' });
    await page.locator(`input[name="cse"][value="${cse ? 'yes' : 'no'}"]`).check();

    await page.locator('#qFlareVentDrains').waitFor({ state: 'visible' });
    await page.locator(`input[name="flareVentDrains"][value="${flareVentDrains ? 'yes' : 'no'}"]`).check();

    await page.locator('#qSbt').waitFor({ state: 'visible' });
    await page.locator(`input[name="sbt"][value="${sbt ? 'yes' : 'no'}"]`).check();

    await page.locator('#qBoundary').waitFor({ state: 'visible' });
    await page.locator(`input[name="boundary"][value="${boundary ? 'yes' : 'no'}"]`).check();

    await page.locator('#iccBlock').waitFor({ state: 'visible' });
}

// Fills Stage 1 (System Properties) and clicks Next.
//
// positiveIsoRisk defaults to true (Yes = risk exists, user picks a valve in Stage 2).
// Pass positiveIsoRisk: false when you want the spade auto-select path.
// hotWork / cse / flareVentDrains / sbt / boundary default to false (No).
export async function fillStage1(page, opts = {}) {
    const {
        title = 'Test isolation',
        majorAccident = 'no',
        waitShutdown  = 'no',
        fluidLabel, otherName, otherGroup, temp, period,
        positiveIsoRisk = true,
        hotWork = false, cse = false, flareVentDrains = false, sbt = false, boundary = false,
        iccNo,
    } = opts;

    await page.goto('/');
    await page.fill('#isoTitle', title);

    await page.locator('#gatingBlock').waitFor({ state: 'visible' });
    await page.locator(`input[name="majorAccident"][value="${majorAccident}"]`).check();
    await page.locator(`input[name="waitShutdown"][value="${waitShutdown}"]`).check();

    const defers = majorAccident === 'yes' || waitShutdown === 'yes';
    if (!defers) {
        await page.locator('#restBlock').waitFor({ state: 'visible' });

        if (fluidLabel) {
            await page.selectOption('#fluidSelect', { label: fluidLabel });
        } else if (otherGroup !== undefined) {
            await page.selectOption('#fluidSelect', 'other');
            if (otherName) await page.fill('#otherFluidName', otherName);
            await page.selectOption('#otherFluidGroup', String(otherGroup));
        }

        if (temp !== undefined) await page.fill('#operatingTemp', String(temp));
        if (period) await page.selectOption('#period', period);

        await answerProgressiveQuestions(page, { positiveIsoRisk, hotWork, cse, flareVentDrains, sbt, boundary });

        if (iccNo) await page.fill('#iccNo', String(iccNo));
    }

    await page.locator('#nextBtn').waitFor({ state: 'visible' });
    await page.click('#nextBtn');
}

export async function expectStage2(page) {
    await page.locator('#calcBtn').waitFor({ state: 'visible' });
}

// selIso: isolation radio value (dbb / twin_seal / sbb / single).
// For the spade auto-select paths (positiveIsoRisk=false or cse=true), pass selIso: undefined
// or any value — the section will be hidden and the click will be skipped automatically.
export async function fillStage2AndCalculate(page, { lineDesc = 'Test line', selIso } = {}) {
    await page.fill('#lineDesc', lineDesc);
    if (selIso) {
        const labelLoc = page.locator(`label[for="${selIso}"]`);
        if (await labelLoc.isVisible()) {
            await labelLoc.click();
        }
        // If label is hidden (auto-select paths or spadeOption always hidden), skip the click.
    }
    await page.click('#calcBtn');
    await page.locator('#outCard').waitFor({ state: 'visible' });
}

export async function readOutput(page) {
    const controls = await Promise.all(
        [1, 2, 3, 4, 5, 6, 7].map(i => page.locator(`#listControl${i}`).textContent()),
    );
    const prepControls = await Promise.all(
        [1, 2, 3, 4].map(i => page.locator(`#prepControl${i}`).textContent()),
    );
    return {
        title:           (await page.locator('#outTitle').textContent()).trim(),
        fluid:           (await page.locator('#outSub').textContent()).trim(),
        temp:            (await page.locator('#outTemp').textContent()).trim(),
        duration:        (await page.locator('#outDur').textContent()).trim(),
        lineDesc:        (await page.locator('#outLineDesc').textContent()).trim(),
        posIsoRisk:      (await page.locator('#outPosIsoRisk').textContent()).trim(),
        hotWork:         (await page.locator('#outHotWork').textContent()).trim(),
        cse:             (await page.locator('#outCSE').textContent()).trim(),
        exempt:          (await page.locator('#outExempt').textContent()).trim(),
        boundary:        (await page.locator('#outBound').textContent()).trim(),
        isoSel:          (await page.locator('#outIsoSel').textContent()).trim(),
        minReqText:      (await page.locator('#outIsoText').textContent()).trim(),
        minReqImg:       await page.locator('#outIsoImg').getAttribute('src'),
        selIsoText:      (await page.locator('#outIsoSelText').textContent()).trim(),
        selIsoImg:       await page.locator('#outSelIsoImg').getAttribute('src'),
        outcome:         (await page.locator('#isoOutcome').textContent()).trim(),
        authGuidance:    (await page.locator('#authGuidance').textContent()).trim(),
        outImg:          await page.locator('#outImg').getAttribute('src'),
        controlsHeading: (await page.locator('#controlsHeading').textContent()).trim(),
        prepHeading:     (await page.locator('#prepHeading').textContent()).trim(),
        controls:        controls.map(t => t.trim()).filter(t => t !== ''),
        prepControls:    prepControls.map(t => t.trim()),
    };
}
