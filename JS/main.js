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
const ISO_TO_CATEGORY = { spade: 'I', dbb: 'IIA', sbb: 'IIB', single: 'III' };

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
function getRequiredCategory({ cse, boundary, flareVentDrains, sbt, group, longDuration, hotWork }) {
    if (cse)             return 'I';
    if (boundary)        return 'III';   // single valve locally inside a boundary isolation
    if (flareVentDrains) return 'III';   // single unproven valve on the LP side
    if (sbt)             return group <= 2 ? 'IIB' : 'III';

    if (group <= 2) return (longDuration || hotWork) ? 'I' : 'IIA';
    if (group === 3) return longDuration ? 'IIA' : 'IIB';
    return longDuration ? 'IIB' : 'III'; // group 4
}

// Authorisation approvers for a non-compliant deviation (slide 17). Both the
// offshore and onshore approver are shown. OIM approval is not required for
// non-hazardous (group 4) deviations (which never reach an OIM row anyway).
function getAuthorisers(group, requiredCat) {
    if (group <= 2) {
        if (requiredCat === 'I')   return { offshore: 'OIM', onshore: 'Process TA / Operations Manager' };
        if (requiredCat === 'IIA') return { offshore: 'OIM', onshore: 'Process Engineer' };
    } else { // groups 3 & 4
        if (requiredCat === 'I')   return { offshore: 'OIM', onshore: 'Process TA / Operations Manager' };
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
function getStandardControls(group) {
    const controls = [control1, control2];
    if (group <= 2) controls.push(control3, control4, control5);
    else            controls.push(control4);
    return controls;
}

function setControls({ cse, sbt, group, hotWork }) {
    let controls;
    if      (cse) controls = [CSEControl1, CSEControl2];
    else if (sbt) controls = [sbtControl1, sbtControl2, sbtControl3, sbtControl4, sbtControl5, sbtControl6];
    else          controls = getStandardControls(group);

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

    // Next is available either to proceed, or to record a shutdown outcome.
    document.getElementById('nextBtn').style.display =
        (titleFilled && (proceed || defersToShutdown)) ? 'block' : 'none';
}

// ── Stage navigation ─────────────────────────────────────────────────────
function showSpec() {
    const isoTitle = document.getElementById('isoTitle').value;
    if (!isoTitle) {
        document.getElementById('isoTitle').style.borderColor = 'red';
        showAlert('Please enter a title for the isolation');
        return;
    }
    document.getElementById('isoTitle').style.borderColor = 'black';

    // Front-end gating (slide 14) — short-circuits to a shutdown record.
    if (getRadio('majorAccident') === 'yes') {
        showShutdownOutcome(SHUTDOWN_HIGHRISK_TEXT);
        return;
    }
    if (getRadio('waitShutdown') === 'yes') {
        showShutdownOutcome(SHUTDOWN_PRACTICABLE_TEXT);
        return;
    }

    const fluid = getFluidInfo();
    if (!fluid || !fluid.name) { showAlert('Please select the fluid being isolated'); return; }
    if (Number.isNaN(fluid.baseGroup)) { showAlert('Please select the fluid group for the substance entered'); return; }

    if (document.getElementById('operatingTemp').value === '') {
        showAlert('Please enter the operating temperature of the medium');
        return;
    }
    if (!document.getElementById('period').value) {
        showAlert('Please select how long containment will be broken for');
        return;
    }

    document.getElementById('lineSpecificationDiv').style.display = 'block';
    document.getElementById('calcBtn').style.display = 'block';
    document.getElementById('nextBtn').style.visibility = 'hidden';
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
    const lineDesc = document.getElementById('lineDesc').value;
    if (!lineDesc) {
        document.getElementById('lineDesc').style.borderColor = 'red';
        showAlert('Please enter a description of the line');
        return;
    }
    document.getElementById('lineDesc').style.borderColor = 'black';

    if (!document.querySelector('input[name="isoTypeSelected"]:checked')) {
        showAlert('Please select the highest standard of isolation that can reasonably be applied');
        return;
    }

    const fluid = getFluidInfo();
    const temp  = parseFloat(document.getElementById('operatingTemp').value);
    const group = finalGroup(fluid.baseGroup, temp);

    const cse             = document.getElementById('cse').checked;
    const hotWork         = document.getElementById('hotWork').checked;
    const flareVentDrains = document.getElementById('flareVentDrains').checked;
    const sbt             = document.getElementById('sbt').checked;
    const boundary        = document.getElementById('boundary').checked;
    const longDuration    = document.getElementById('period').value === 'moreThanShift';

    const requiredCat = getRequiredCategory({ cse, boundary, flareVentDrains, sbt, group, longDuration, hotWork });
    const required    = CATEGORY_INFO[requiredCat];

    const selValue = document.querySelector('input[name="isoTypeSelected"]:checked').value;
    const selCat   = ISO_TO_CATEGORY[selValue];
    const selected = CATEGORY_INFO[selCat];

    const meets = CATEGORY_RANK[selCat] >= CATEGORY_RANK[requiredCat];

    // ── Populate output (textContent used throughout to prevent XSS) ──
    document.getElementById('outTitle').textContent = document.getElementById('isoTitle').value;

    const escalated = group < fluid.baseGroup;
    document.getElementById('outSub').textContent =
        `${fluid.name} — Group ${group} (${GROUP_NAMES[group]})` +
        (escalated ? ` [escalated from Group ${fluid.baseGroup} by operating temperature]` : '');
    document.getElementById('outTemp').textContent = `${temp} °C`;

    document.getElementById('outDur').textContent = longDuration ? 'More than one shift' : 'One shift or less';
    document.getElementById('outLineDesc').textContent = lineDesc;
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
            const onshore = authorisers.onshore || 'follow the site deviation process';
            authEl.textContent =
                `Authorisation for this deviation is required from: Offshore — ${authorisers.offshore}; Onshore — ${onshore}.`;
        } else {
            authEl.textContent = 'Authorisation for this deviation must be obtained through the site deviation process.';
        }
    }

    setControls({ cse, sbt, group, hotWork });

    document.getElementById('prepControl1').textContent = prepControl1;
    document.getElementById('prepControl2').textContent = prepControl2;
    document.getElementById('prepControl3').textContent = group <= 3 ? prepControl3 : '';
    document.getElementById('prepControl4').textContent = group <= 3 ? prepControl4 : '';

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
        const imgW = pageW - margin * 2;    // render at full content width (no squashing)
        const imgH = imgW * (canvas.height / canvas.width);
        const usableH = pageH - margin * 2; // content height available per page

        // Render at full width, flowing across as many pages as needed.
        let heightRendered = 0;
        let pageIndex = 0;
        while (heightRendered < imgH - 0.1) {
            if (pageIndex > 0) pdf.addPage();
            pdf.addImage(imgData, 'JPEG', margin, margin - heightRendered, imgW, imgH);

            // Mask the margins so any slice overlap doesn't bleed into them.
            pdf.setFillColor(255, 255, 255);
            pdf.rect(0, 0, pageW, margin, 'F');
            pdf.rect(0, pageH - margin, pageW, margin, 'F');
            pdf.rect(0, 0, margin, pageH, 'F');
            pdf.rect(pageW - margin, 0, margin, pageH, 'F');

            heightRendered += usableH;
            pageIndex++;
        }
        pdf.save(filename);
    } finally {
        element.classList.remove('pdf-render');
    }
}

function popitup(url) {
    const newwindow = window.open(url, 'name', 'height=900,width=800');
    if (window.focus) newwindow.focus();
}

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

    fluidSelect.addEventListener('change', toggleOtherFluid);
    toggleOtherFluid();

    // Progressive disclosure wiring
    document.getElementById('isoTitle').addEventListener('input', updateProgress);
    document.querySelectorAll('input[name="majorAccident"], input[name="waitShutdown"]')
        .forEach(radio => radio.addEventListener('change', updateProgress));
    updateProgress();

    document.getElementById('helpBtn').addEventListener('click', () => popitup('help.html'));
    document.getElementById('nextBtn').addEventListener('click', showSpec);
    document.getElementById('calcBtn').addEventListener('click', getInputData);
    document.getElementById('backBtn').addEventListener('click', goBack);
    document.getElementById('printBtn').addEventListener('click', printPDF);
}

init();
