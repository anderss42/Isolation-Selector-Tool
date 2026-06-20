// ── Isolation Selector Tool ──────────────────────────────────────────────
// Decision-tree model (HSG253 aligned). Replaces the previous multiplicative
// risk score. The tool derives a minimum isolation CATEGORY (I, IIA, IIB, III)
// from the fluid group, work duration, hot work and confined-space-entry, plus
// front-end shutdown gating and exemption flags, then compares it against the
// best available isolation the user can apply.

// ── Isolation categories ─────────────────────────────────────────────────
// Higher rank = stronger isolation. Each category maps to a legacy isolation
// image/id so the existing icons are reused.
const CATEGORY_RANK = { I: 4, IIA: 3, IIB: 2, III: 1 };

const CATEGORY_INFO = {
    I:   { label: 'Category I',   iso: 'spade',  img: 'imgs/spade.png',  text: 'Positive isolation - Spade or disconnection.' },
    IIA: { label: 'Category IIA', iso: 'dbb',    img: 'imgs/dbb.png',    text: 'Proven isolation - Double Block and Bleed (DBB) or double seal valve with body bleed.' },
    IIB: { label: 'Category IIB', iso: 'sbb',    img: 'imgs/sbb.png',    text: 'Proven isolation - Leak-tight Single Block and Bleed (SBB).' },
    III: { label: 'Category III', iso: 'single', img: 'imgs/single.png', text: 'Non-proven isolation - Single or double valve (double preferred over single, if available).' },
};

// Best-available isolation the user selects → the category it satisfies
const ISO_TO_CATEGORY = { spade: 'I', dbb: 'IIA', twin_seal: 'IIA', sbb: 'IIB', single: 'III' };

// Per-selection display info (image and label shown on the "you selected" side of the output)
const ISO_INFO = {
    spade:     { label: 'Category I',   img: 'imgs/spade.png',     text: 'Positive isolation - Spade or disconnection.' },
    dbb:       { label: 'Category IIA', img: 'imgs/dbb.png',       text: 'Proven isolation - Double Block and Bleed (DBB).' },
    twin_seal: { label: 'Category IIA', img: 'imgs/twin_seal.png', text: 'Proven isolation - Twin Seal Valve.' },
    sbb:       { label: 'Category IIB', img: 'imgs/sbb.png',       text: 'Proven isolation - Leak-tight Single Block and Bleed (SBB).' },
    single:    { label: 'Category III', img: 'imgs/single.png',    text: 'Non-proven isolation - Single or double valve (double preferred over single, if available).' },
};

// ── Fluid groups ─────────────────────────────────────────────────────────
// Lower group number = more onerous. Standard fluids infer a base group; the
// operating temperature can escalate it (see finalGroup).
const GROUP_NAMES = { 1: 'Highly Dangerous', 2: 'Dangerous', 3: 'Hazardous', 4: 'Non-hazardous' };

const FLUIDS = [
    // Group 1 — Highly Dangerous
    { name: 'Natural Gas', group: 1 },
    { name: 'NGL',         group: 1 },
    { name: 'Crude Oil',   group: 1 },
    // Group 2 — Dangerous
    { name: 'Methanol',        group: 2 },
    { name: 'CRW85733',        group: 2 },
    { name: 'Proxel XL2',      group: 2 },
    { name: 'GT-7511',         group: 2 },
    { name: 'Corrtreat 15340', group: 2 },
    { name: 'Biotreat 4632',   group: 2 },
    // Group 3 — Hazardous
    { name: 'Diesel',              group: 3 },
    { name: 'Aviation Fuel',       group: 3 },
    { name: 'MEG',                 group: 3 },
    { name: 'R410A',               group: 3 },
    { name: 'Scaletreat 8019',     group: 3 },
    { name: 'Phasetreat 13647',    group: 3 },
    { name: 'CRW85689',            group: 3 },
    { name: 'RBW85165',            group: 3 },
    { name: 'HW 443 ND',           group: 3 },
    { name: 'Brayco Micronic SV/3', group: 3 },
    { name: 'Foamtreat SOC313',    group: 3 },
    // Group 4 — Non-hazardous
    { name: 'Seawater', group: 4 },
    { name: 'TEG',      group: 4 },
];

// Temperature-derived group per slide 9 thresholds. Returns 1, 3 or 4
// (temperature never implies group 2).
function tempGroup(temp) {
    if (temp > 60 || temp < -10) return 1;
    if ((temp > 50 && temp <= 60) || (temp < 0 && temp >= -10)) return 3;
    return 4; // 0–50 °C: no temperature escalation
}

// Final group = the more onerous (lower) of base group and temperature group.
function finalGroup(baseGroup, temp) {
    if (Number.isNaN(temp)) return baseGroup;
    return Math.min(baseGroup, tempGroup(temp));
}

// ── Decision logic ───────────────────────────────────────────────────────
// Returns the minimum required isolation category. Precedence:
//   CSE (I) > boundary isolation (III) > flare/vent/drains (III) >
//   small-bore tubing exemption > standard group/duration table.
function getRequiredCategory({ cse, boundary, flareVentDrains, sbt, group, longDuration, hotWork, positiveIsoRisk }) {
    if (positiveIsoRisk === 'no') return { cat: 'I',   driver: 'outPosIsoRisk' };
    if (cse)             return { cat: 'I',   driver: 'outCSE' };
    if (boundary)        return { cat: 'III', driver: 'outBound' };
    if (flareVentDrains) return { cat: 'III', driver: 'outExempt' };
    if (sbt)             return { cat: group <= 2 ? 'IIB' : 'III', driver: 'outExempt' };

    if (group <= 2) {
        if (longDuration || hotWork) return { cat: 'I', driver: hotWork ? 'outHotWork' : 'outDur' };
        return { cat: 'IIA', driver: 'outSub' };
    }
    if (group === 3) return { cat: longDuration ? 'IIA' : 'IIB', driver: longDuration ? 'outDur' : 'outSub' };
    return { cat: longDuration ? 'IIB' : 'III', driver: longDuration ? 'outDur' : 'outSub' };
}

// Authorisation approvers for a non-compliant deviation (slide 17). "Offshore" and
// "onshore" describe where the approving person resides, not where the work is done
// (all work is offshore). Some rows have an offshore approver only (onshore: null).
// OIM approval is not required for non-hazardous (group 4) deviations (which never
// reach an OIM row anyway).
function getAuthorisers(group, requiredCat) {
    if (group <= 2) {
        if (requiredCat === 'I')   return { offshore: 'OIM', onshore: 'Process TA & Operations Manager' };
        if (requiredCat === 'IIA') return { offshore: 'OIM', onshore: 'Process Engineer' };
    } else { // groups 3 & 4
        if (requiredCat === 'I')   return { offshore: 'OIM', onshore: 'Process TA & Operations Manager' };
        if (requiredCat === 'IIA') return { offshore: 'Department Head', onshore: null };
        if (requiredCat === 'IIB') return { offshore: 'Area Authority', onshore: null };
    }
    return null;
}

// ── Control / preparation text ───────────────────────────────────────────
const control1 = "Pressure build-up test to ensure valve integrity.";
const control2 = "Regular monitoring of the isolation integrity.";
const control3 = "Continuous gas monitoring to be present when breaching.";
const control4 = "Contingency plan to be detailed in the ICC or TBT (for personal isolations) in case of isolation failure.";
const control5 = "Radio link to control room when containment is being broken.";
const hotWorkControl = "Hot work permit and dedicated fire watch required throughout the activity.";

// Small bore tubing controls
const sbtControl1 = "Where available double block valves should be used on impulse lines.";
const sbtControl2 = "Pressure build-up test to ensure valve integrity.";
const sbtControl3 = "Regular monitoring of the isolation integrity.";
const sbtControl4 = "Radio link to control room when containment is being broken.";
const sbtControl5 = "Contingency plan to be detailed on ICC or TBT (for personal isolations) in case of isolation failure.";
const sbtControl6 = "Continuous gas monitoring to be present when breaching hydrocarbon systems.";

// Flare / LP vent / closed drains — single valve exception controls
const fvdControl1 = "Production Supervisor confirms no abnormal/increased flaring, venting, leak testing, compressor changes, well switches, deluge/F&G testing or other plant instability expected.";
const fvdControl2 = "Work party formally briefed that work is against a single valve on flare/vent/drain.";
const fvdControl3 = "Additional controls for toxic service.";
const fvdControl4 = "Rated blanks/bolts/gaskets verified and at worksite.";
const fvdControl5 = "AA/PA confirm valve position indicator shows fully closed.";
const fvdControl6 = "AA attends TBT.";

// CSE controls
const CSEControl1 = "Complete separation of the plant / equipment to be worked on from other parts of the system.";
const CSEControl2 = "Controls required as per TUK-17-C-004 section 8";

// Preparation controls
const prepControl1 = "Depressurised to nominal zero";
const prepControl2 = "Drain vessels and pipework";
const prepControl3 = "Water flush vessels and pipework";
const prepControl4 = "Nitrogen Purge vessels and pipework";

// ── Outcome text ─────────────────────────────────────────────────────────
const MEETS_TEXT = "The isolation selected meets the minimum standard required and can be used.";
const SHUTDOWN_HIGHRISK_TEXT = "A failure of this isolation could lead to a major accident event. Isolation selection is not appropriate — the plant must be shut down for this work.";
const SHUTDOWN_PRACTICABLE_TEXT = "It is reasonably practicable to wait for a shutdown. The plant should be shut down rather than relying on an in-service isolation for this work.";

// ── Modals (replace browser alert/prompt) ────────────────────────────────
function showAlert(message, title = 'Information') {
    document.getElementById('alertModalTitle').textContent = title;
    document.getElementById('alertModalBody').textContent = message;
    bootstrap.Modal.getOrCreateInstance(document.getElementById('alertModal')).show();
}

// Resolves with the entered name, or null if cancelled/dismissed.
function showNamePrompt(message) {
    return new Promise(resolve => {
        const modalEl    = document.getElementById('nameModal');
        const input      = document.getElementById('nameModalInput');
        const confirmBtn = document.getElementById('nameModalConfirm');
        document.getElementById('nameModalBody').textContent = message;
        input.value = '';

        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

        function cleanup() {
            confirmBtn.removeEventListener('click', onConfirm);
            modalEl.removeEventListener('hidden.bs.modal', onHide);
            input.removeEventListener('keydown', onKey);
        }
        function onConfirm() { cleanup(); modal.hide(); resolve(input.value.trim()); }
        function onHide()    { cleanup(); resolve(null); }
        function onKey(e)    { if (e.key === 'Enter') onConfirm(); }

        confirmBtn.addEventListener('click', onConfirm);
        modalEl.addEventListener('hidden.bs.modal', onHide);
        input.addEventListener('keydown', onKey);

        modalEl.addEventListener('shown.bs.modal', () => input.focus(), { once: true });
        modal.show();
    });
}

// ── Input readers ────────────────────────────────────────────────────────
function getRadio(name) {
    const checked = document.querySelector(`input[name="${name}"]:checked`);
    return checked ? checked.value : '';
}

function getFluidInfo() {
    const sel = document.getElementById('fluidSelect').value;
    if (sel === 'other') {
        const name = document.getElementById('otherFluidName').value.trim();
        const baseGroup = parseInt(document.getElementById('otherFluidGroup').value, 10);
        return { name, baseGroup };
    }
    if (sel === '') return null;
    const f = FLUIDS[parseInt(sel, 10)];
    return f ? { name: f.name, baseGroup: f.group } : null;
}

// ── Control selection ────────────────────────────────────────────────────
const PROVEN_VALVE_ISOS = new Set(['dbb', 'twin_seal', 'sbb']);

function getStandardControls(group, isProvenValve) {
    const controls = isProvenValve ? [control1, control2] : [control2];
    if (group <= 2) controls.push(control3, control4, control5);
    else            controls.push(control4);
    return controls;
}

function setControls({ cse, sbt, flareVentDrains, group, hotWork, selValue }) {
    const isProvenValve = PROVEN_VALVE_ISOS.has(selValue);
    let controls;
    if (cse) {
        controls = [CSEControl1, CSEControl2];
    } else if (sbt) {
        controls = isProvenValve
            ? [sbtControl1, sbtControl2, sbtControl3, sbtControl4, sbtControl5, sbtControl6]
            : [sbtControl1, sbtControl3, sbtControl4, sbtControl5, sbtControl6];
    } else if (flareVentDrains && selValue === 'single') {
        controls = [fvdControl1, fvdControl2, fvdControl3, fvdControl4, fvdControl5, fvdControl6];
    } else {
        controls = getStandardControls(group, isProvenValve);
    }

    if (hotWork && !cse && controls.length < 6) controls = [...controls, hotWorkControl];

    for (let i = 1; i <= 6; i++) {
        document.getElementById(`listControl${i}`).textContent = controls[i - 1] || '';
    }
}

// ── Field visibility helpers ─────────────────────────────────────────────
function toggleOtherFluid() {
    const isOther = document.getElementById('fluidSelect').value === 'other';
    document.getElementById('otherFluidWrap').style.display = isOther ? 'block' : 'none';
}

// Progressive disclosure: title → planning checks → the rest. Answering "Yes"
// to either planning check means the rest is not required (shutdown record).
function updateProgress() {
    const titleFilled = document.getElementById('isoTitle').value.trim() !== '';
    document.getElementById('gatingBlock').style.display = titleFilled ? 'block' : 'none';

    const majorAccident = getRadio('majorAccident');
    const waitShutdown  = getRadio('waitShutdown');
    const defersToShutdown = majorAccident === 'yes' || waitShutdown === 'yes';
    const bothAnswered = majorAccident !== '' && waitShutdown !== '';
    const proceed = titleFilled && bothAnswered && !defersToShutdown;

    document.getElementById('restBlock').style.display = proceed ? 'block' : 'none';
    document.getElementById('gatingNotice').style.display =
        (titleFilled && defersToShutdown) ? 'block' : 'none';

    const allQuestionsAnswered = proceed &&
        ['positiveIsoRisk', 'hotWork', 'cse', 'flareVentDrains', 'sbt', 'boundary']
        .every(n => getRadio(n) !== '');

    // Next is available once all questions answered, or to record a shutdown outcome.
    document.getElementById('nextBtn').style.display =
        (titleFilled && ((proceed && allQuestionsAnswered) || defersToShutdown)) ? 'block' : 'none';
}

// ── Stage navigation ─────────────────────────────────────────────────────
function showSpec() {
    let hasError = false;

    const titleEl = document.getElementById('isoTitle');
    if (!titleEl.value.trim()) {
        titleEl.style.borderColor = 'red';
        hasError = true;
    } else {
        titleEl.style.borderColor = '';
    }

    if (hasError) {
        showAlert('Please complete the highlighted fields before continuing.');
        return;
    }

    // Shutdown short-circuit — no further fields required.
    if (getRadio('majorAccident') === 'yes') { showShutdownOutcome(SHUTDOWN_HIGHRISK_TEXT); return; }
    if (getRadio('waitShutdown') === 'yes')  { showShutdownOutcome(SHUTDOWN_PRACTICABLE_TEXT); return; }

    const fluidEl = document.getElementById('fluidSelect');
    if (fluidEl.value === '') {
        fluidEl.style.borderColor = 'red';
        hasError = true;
    } else {
        fluidEl.style.borderColor = '';
    }

    if (fluidEl.value === 'other') {
        const otherNameEl = document.getElementById('otherFluidName');
        if (!otherNameEl.value.trim()) {
            otherNameEl.style.borderColor = 'red';
            hasError = true;
        } else {
            otherNameEl.style.borderColor = '';
        }
    }

    const tempEl = document.getElementById('operatingTemp');
    if (tempEl.value === '') {
        tempEl.style.borderColor = 'red';
        hasError = true;
    } else {
        tempEl.style.borderColor = '';
    }

    const periodEl = document.getElementById('period');
    if (!periodEl.value) {
        periodEl.style.borderColor = 'red';
        hasError = true;
    } else {
        periodEl.style.borderColor = '';
    }

    // Highlight any visible but unanswered question rows.
    [['positiveIsoRisk', 'qPosIsoRisk'], ['hotWork', 'qHotWork'], ['cse', 'qCse'],
     ['flareVentDrains', 'qFlareVentDrains'], ['sbt', 'qSbt'], ['boundary', 'qBoundary']]
        .forEach(([name, rowId]) => {
            const rowEl = document.getElementById(rowId);
            if (!rowEl) return;
            if (rowEl.style.display !== 'none' && getRadio(name) === '') {
                rowEl.classList.add('q-error');
                hasError = true;
            } else {
                rowEl.classList.remove('q-error');
            }
        });

    if (hasError) {
        showAlert('Please complete the highlighted fields before continuing.');
        return;
    }

    const posRisk = getRadio('positiveIsoRisk');

    // spade option is never shown in Stage 2 — it is either auto-applied (posRisk='no')
    // or ruled out by the user's answer (posRisk='yes').
    document.getElementById('spadeOption').style.display = 'none';

    if (posRisk === 'no') {
        // Positive isolation is safe to use — hide the picker, auto-select spade.
        document.getElementById('isoTypeSection').style.display = 'none';
        document.getElementById('posIsoNotice').style.display = 'block';
        document.getElementById('spade').checked = true;
    } else {
        // User must choose from valve options.
        document.getElementById('isoTypeSection').style.display = 'block';
        document.getElementById('posIsoNotice').style.display = 'none';
        // Clear spade if it was previously auto-selected.
        if (document.getElementById('spade').checked) document.getElementById('spade').checked = false;
    }

    document.getElementById('lineSpecificationDiv').style.display = 'block';
    document.getElementById('calcBtn').style.display = 'block';
    document.getElementById('nextBtn').style.visibility = 'hidden';

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Shutdown (gating) outcome ────────────────────────────────────────────
function showShutdownOutcome(message) {
    document.getElementById('outTitle').textContent = document.getElementById('isoTitle').value;

    ['outSub', 'outTemp', 'outDur', 'outLineDesc', 'outHotWork', 'outCSE', 'outExempt', 'outBound', 'outIsoSel']
        .forEach(id => { document.getElementById(id).textContent = 'N/A'; });

    document.getElementById('comparisonSection').style.display = 'none';
    document.getElementById('controlsFooter').style.display = 'none';
    document.getElementById('authGuidance').textContent = '';

    document.getElementById('outImg').src = 'imgs/stop.png';
    const outcomeEl = document.getElementById('isoOutcome');
    outcomeEl.textContent = message;
    outcomeEl.style.color = 'red';
    outcomeEl.style.fontSize = '24px';

    revealOutput();
}

// ── Main calculation ─────────────────────────────────────────────────────
function getInputData() {
    let hasError = false;

    const lineDescEl = document.getElementById('lineDesc');
    if (!lineDescEl.value.trim()) {
        lineDescEl.style.borderColor = 'red';
        hasError = true;
    } else {
        lineDescEl.style.borderColor = '';
    }

    const isoSectionEl = document.getElementById('isoTypeSection');
    if (isoSectionEl.style.display !== 'none' && !document.querySelector('input[name="isoTypeSelected"]:checked')) {
        isoSectionEl.classList.add('section-error');
        hasError = true;
    } else {
        isoSectionEl.classList.remove('section-error');
    }

    if (hasError) {
        showAlert('Please complete the highlighted fields before continuing.');
        return;
    }

    const fluid = getFluidInfo();
    const temp  = parseFloat(document.getElementById('operatingTemp').value);
    const group = finalGroup(fluid.baseGroup, temp);

    const positiveIsoRisk = getRadio('positiveIsoRisk');
    const cse             = getRadio('cse') === 'yes';
    const hotWork         = getRadio('hotWork') === 'yes';
    const flareVentDrains = getRadio('flareVentDrains') === 'yes';
    const sbt             = getRadio('sbt') === 'yes';
    const boundary        = getRadio('boundary') === 'yes';
    const longDuration    = document.getElementById('period').value === 'moreThanShift';

    const { cat: requiredCat, driver: drivingField } = getRequiredCategory({ cse, boundary, flareVentDrains, sbt, group, longDuration, hotWork, positiveIsoRisk });
    const required    = CATEGORY_INFO[requiredCat];

    const selValue = document.querySelector('input[name="isoTypeSelected"]:checked').value;
    const selCat   = ISO_TO_CATEGORY[selValue];
    const selected = ISO_INFO[selValue];

    const meets = CATEGORY_RANK[selCat] >= CATEGORY_RANK[requiredCat];

    // ── Populate output (textContent used throughout to prevent XSS) ──
    document.getElementById('outTitle').textContent = document.getElementById('isoTitle').value;

    const escalated = group < fluid.baseGroup;
    document.getElementById('outSub').textContent =
        `${fluid.name} — Group ${group} (${GROUP_NAMES[group]})` +
        (escalated ? ` [escalated from Group ${fluid.baseGroup} by operating temperature]` : '');
    document.getElementById('outTemp').textContent = `${temp} °C`;

    document.getElementById('outDur').textContent = longDuration ? 'More than one shift' : 'One shift or less';
    document.getElementById('outLineDesc').textContent = lineDescEl.value;
    document.getElementById('outPosIsoRisk').textContent = positiveIsoRisk === 'yes' ? 'Yes' : 'No';
    document.getElementById('outHotWork').textContent  = hotWork ? 'Yes' : 'No';
    document.getElementById('outCSE').textContent      = cse ? 'Yes' : 'No';

    const exemptions = [];
    if (flareVentDrains) exemptions.push('Flare / LP vent / closed drains');
    if (sbt)             exemptions.push('Instrument small-bore tubing (SBT)');
    document.getElementById('outExempt').textContent = exemptions.length ? exemptions.join('; ') : 'None';

    document.getElementById('outBound').textContent  = boundary ? 'Yes' : 'No';
    document.getElementById('outIsoSel').textContent = selected.text;

    document.getElementById('outIsoImg').src           = required.img;
    document.getElementById('outIsoText').textContent  = `${required.label} — ${required.text}`;
    document.getElementById('outSelIsoImg').src        = selected.img;
    document.getElementById('outIsoSelText').textContent = `${selected.label} — ${selected.text}`;

    const outcomeEl = document.getElementById('isoOutcome');
    const authEl    = document.getElementById('authGuidance');
    document.getElementById('comparisonSection').style.display = '';
    document.getElementById('controlsFooter').style.display = '';

    if (meets) {
        document.getElementById('outImg').src = 'imgs/caution.png';
        outcomeEl.textContent = MEETS_TEXT;
        outcomeEl.style.color = 'black';
        outcomeEl.style.fontSize = '';
        authEl.textContent = '';
    } else {
        document.getElementById('outImg').src = 'imgs/stop.png';
        outcomeEl.textContent =
            `The isolation selected (${selected.label}) does not meet the minimum standard required (${required.label}). ` +
            `A Level 2 risk assessment / deviation MUST be carried out before this isolation is used.`;
        outcomeEl.style.color = 'red';
        outcomeEl.style.fontSize = '24px';

        const authorisers = getAuthorisers(group, requiredCat);
        if (authorisers) {
            let who = `${authorisers.offshore} (offshore)`;
            if (authorisers.onshore) who += ` and ${authorisers.onshore} (onshore)`;
            authEl.textContent = `Authorisation for this deviation is required from: ${who}.`;
        } else {
            authEl.textContent = 'Authorisation for this deviation must be obtained through the site deviation process.';
        }
    }

    // Highlight the table cell that drove the required category
    ['outPosIsoRisk', 'outHotWork', 'outCSE', 'outExempt', 'outBound', 'outDur', 'outSub']
        .forEach(id => document.getElementById(id).removeAttribute('style'));
    const driverEl = document.getElementById(drivingField);
    if (driverEl) { driverEl.style.color = 'red'; driverEl.style.fontWeight = 'bold'; }

    setControls({ cse, sbt, flareVentDrains, group, hotWork, selValue });

    document.getElementById('prepControl1').textContent = prepControl1;
    document.getElementById('prepControl2').textContent = prepControl2;
    document.getElementById('prepControl3').textContent = group <= 3 ? prepControl3 : '';
    document.getElementById('prepControl4').textContent = group <= 3 ? prepControl4 : '';

    if (meets) {
        document.getElementById('controlsHeading').textContent = 'Isolation Controls required are:';
        document.getElementById('prepHeading').textContent = 'Preparation of equipment requirements:';
    } else {
        document.getElementById('controlsHeading').textContent = 'Suggested controls to consider in the Level 2 risk assessment:';
        document.getElementById('prepHeading').textContent = 'Suggested preparation controls to consider in the Level 2 risk assessment:';
    }

    revealOutput();
}

function revealOutput() {
    document.getElementById('outCard').style.display      = 'block';
    document.getElementById('inputSection').style.display = 'none';
    document.getElementById('header').style.display       = 'none';
    document.getElementById('backBtn').style.display      = 'block';
    document.getElementById('calcBtn').style.display      = 'none';
    document.getElementById('printBtn').style.display     = 'block';
    document.getElementById('backBtn').scrollIntoView();
}

function goBack() {
    document.getElementById('inputSection').style.display = 'flex';
    document.getElementById('outCard').style.display      = 'none';
    document.getElementById('backBtn').style.display      = 'none';
    document.getElementById('printBtn').style.display     = 'none';
    document.getElementById('header').style.display       = 'block';
    document.getElementById('comparisonSection').style.display = '';
    document.getElementById('controlsFooter').style.display = '';

    // Restore the progressive-reveal state from the current answers.
    document.getElementById('nextBtn').style.visibility = 'visible';
    updateProgress();

    // If stage 2 is showing, keep the Calculate button; otherwise show Next.
    if (document.getElementById('lineSpecificationDiv').style.display === 'block') {
        document.getElementById('calcBtn').style.display = 'flex';
    }
}

async function printPDF() {
    let filename = document.getElementById('iccNo').value;
    filename = filename ? `ICC ${filename} IST_Outcome.pdf` : 'IST_Outcome.pdf';

    const person = await showNamePrompt('Please confirm that you have read the outcome and comply with the controls stipulated, then enter your name to confirm.');
    if (!person) return;

    const date = new Date();
    document.getElementById('preparedBy').textContent = `Isolation Selector outcome prepared by: ${person} ${date}`;

    const element = document.getElementById('outCard');
    element.classList.add('pdf-render');

    try {
        const canvas = await html2canvas(element, { scale: 2, useCORS: true });
        const imgData = canvas.toDataURL('image/jpeg', 0.95);

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

        const pageW = 210, pageH = 297;
        const margin = 10;                  // equal margins on every side
        const usableW = pageW - margin * 2; // content area available
        const usableH = pageH - margin * 2;

        // Fit the whole card onto a single A4 page: render at full content width,
        // then scale down (keeping aspect ratio) if it would be taller than one page.
        let imgW = usableW;
        let imgH = imgW * (canvas.height / canvas.width);
        if (imgH > usableH) {
            imgH = usableH;
            imgW = imgH * (canvas.width / canvas.height);
        }
        const x = (pageW - imgW) / 2;       // centre horizontally if narrowed
        pdf.addImage(imgData, 'JPEG', x, margin, imgW, imgH);
        pdf.save(filename);
    } finally {
        element.classList.remove('pdf-render');
    }
}

function popitup(url) {
    const newwindow = window.open(url, 'name', 'height=900,width=800');
    if (window.focus) newwindow.focus();
}

// ── Contextual help popover content ─────────────────────────────────────────
const HELP_CONTENT = {
    temp: {
        title: 'Temperature escalation',
        content: 'Escalates the fluid group if the temperature is extreme. Above 60°C or below −10°C the fluid is treated as Group 1 (Highly Dangerous) regardless of its base group. Between 50–60°C or −10 to 0°C it is treated as Group 3. The tool always uses whichever is more onerous.',
    },
    duration: {
        title: 'Containment broken duration',
        content: 'This is not the total task duration — it is the exposure window if the isolation were to fail. If the work crosses a shift change or the pipework could be left open overnight, choose “More than one shift”.',
    },
    posIsoRisk: {
        title: 'Positive isolation risk',
        content: '<strong>No</strong> — a spade or disconnection can be safely achieved. The tool auto-applies Category I (positive isolation) and skips the isolation type picker in Stage 2.<br><br><strong>Yes</strong> — fitting or removing the spade is itself a greater risk than valve isolation (e.g. high-pressure service). Stage 2 will ask you to select the best valve isolation available.',
        html: true,
    },
    hotWork: {
        title: 'Hot work',
        content: 'Any activity with spark potential or naked flame — grinding, cutting, welding, or nearby engines. Escalates Groups 1 and 2 to Category I only; has no effect on Groups 3 and 4.',
    },
    cse: {
        title: 'Confined space entry (CSE)',
        content: 'CSE always requires positive isolation (Category I) regardless of fluid group or duration. No other factor can reduce this requirement.',
    },
    flareVentDrains: {
        title: 'Flare, LP vent or closed drains',
        content: 'Where work is against a single valve on an LP flare, vent or closed drains system, a Category III isolation may be acceptable subject to additional controls. A Production Supervisor must confirm no abnormal plant conditions are expected.',
    },
    sbt: {
        title: 'Instrument small-bore tubing (SBT)',
        content: 'For instrument impulse line personal isolations only. Applies a reduced minimum — Category IIB for Fluid Groups 1 & 2, Category III for Groups 3 & 4. Double block valves should be used on impulse lines where available.',
    },
    boundary: {
        title: 'Boundary isolation',
        content: 'Where a boundary isolation is already in place around the work area, a single local valve (Category III) is sufficient for the personal isolation. The boundary isolation provides the primary protection.',
    },
};

function init() {
    // Help page loads this script too but has none of these elements.
    const fluidSelect = document.getElementById('fluidSelect');
    if (!fluidSelect) return;

    // Populate the fluid dropdown from FLUIDS, grouped by fluid group.
    [1, 2, 3, 4].forEach(g => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = `Group ${g} — ${GROUP_NAMES[g]}`;
        FLUIDS.forEach((f, idx) => {
            if (f.group !== g) return;
            const opt = document.createElement('option');
            opt.value = String(idx);
            opt.textContent = f.name;
            optgroup.appendChild(opt);
        });
        fluidSelect.appendChild(optgroup);
    });
    const other = document.createElement('option');
    other.value = 'other';
    other.textContent = 'Other (enter manually)…';
    fluidSelect.appendChild(other);
    fluidSelect.selectedIndex = 0;

    fluidSelect.addEventListener('change', toggleOtherFluid);
    toggleOtherFluid();

    // Progressive disclosure wiring — title / planning checks
    document.getElementById('isoTitle').addEventListener('input', updateProgress);
    document.querySelectorAll('input[name="majorAccident"], input[name="waitShutdown"]')
        .forEach(radio => radio.addEventListener('change', updateProgress));
    updateProgress();

    // Progressive reveal of the additional yes/no questions
    const QUESTION_CHAIN = {
        positiveIsoRisk: 'qHotWork',
        hotWork:         'qCse',
        cse:             'qFlareVentDrains',
        flareVentDrains: 'qSbt',
        sbt:             'qBoundary',
        boundary:        'iccBlock',
    };
    Object.keys(QUESTION_CHAIN).forEach(name => {
        document.querySelectorAll(`input[name="${name}"]`).forEach(radio => {
            radio.addEventListener('change', () => {
                radio.closest('tr')?.classList.remove('q-error');
                const next = document.getElementById(QUESTION_CHAIN[name]);
                next.style.display = next.tagName === 'TR' ? 'table-row' : 'block';
                next.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                updateProgress();
                if (name === 'boundary') {
                    setTimeout(() => {
                        document.getElementById('nextBtn').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }, 400);
                }
            });
        });
    });

    // Clear isolation type section error when user makes a selection.
    document.querySelectorAll('input[name="isoTypeSelected"]').forEach(radio => {
        radio.addEventListener('change', () => {
            document.getElementById('isoTypeSection').classList.remove('section-error');
        });
    });

    // Auto-clear red borders on text/select fields when user edits them.
    ['isoTitle', 'operatingTemp', 'otherFluidName', 'lineDesc'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', function () { this.style.borderColor = ''; });
    });
    ['fluidSelect', 'period'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', function () { this.style.borderColor = ''; });
    });

    document.getElementById('helpBtn').addEventListener('click', () => popitup('help.html'));
    document.getElementById('nextBtn').addEventListener('click', showSpec);
    document.getElementById('calcBtn').addEventListener('click', getInputData);
    document.getElementById('backBtn').addEventListener('click', goBack);
    document.getElementById('printBtn').addEventListener('click', printPDF);

    // Popovers need Bootstrap to be fully loaded first. DOMContentLoaded fires
    // after all deferred scripts (including Bootstrap) have executed.
    window.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('[data-help-key]').forEach(el => {
            const help = HELP_CONTENT[el.getAttribute('data-help-key')];
            if (!help) return;
            new bootstrap.Popover(el, {
                title: help.title,
                content: help.content,
                html: !!help.html,
                trigger: 'hover focus',
                placement: 'auto',
            });
        });
    });
}

init();
