// ════════════════════════════════════════════════════════════════════════════
// Isolation Selector Tool — main.js
// ════════════════════════════════════════════════════════════════════════════
//
// PURPOSE
// -------
// This file contains ALL of the tool's logic. There is no framework — it is
// plain JavaScript that runs directly in the browser when index.html is opened.
//
// HOW THE TOOL WORKS (overview)
// ------------------------------
// The user fills in two stages:
//
//   Stage 1 — "System Properties" form (left column of the page):
//     • Isolation title
//     • Two front-end planning checks (major accident risk / can we wait for shutdown?)
//       — if either is "Yes" the tool short-circuits to a shutdown record; no
//         isolation selection is needed.
//     • Fluid type, operating temperature, duration
//     • Six Yes/No questions revealed one at a time (see QUESTION_CHAIN below)
//     • Optional ICC number
//
//   Stage 2 — "Line Specification" form (right column, revealed by "Next"):
//     • Description of the line / isolation point
//     • The best valve isolation available (spade is never user-selectable here;
//       it is either auto-applied by the logic or not applicable)
//
// Pressing "Calculate" runs the decision logic and shows the output card.
//
// HOW THE DECISION LOGIC WORKS
// ------------------------------
// The tool follows the HSG253 decision tree. The key inputs are:
//   • Fluid Group (1 = most hazardous, 4 = least), which can be escalated by
//     operating temperature
//   • Whether containment will be broken for more than one shift (long duration)
//   • The six Yes/No question answers (hot work, CSE, etc.)
//
// These are fed into getRequiredCategory() which returns the MINIMUM isolation
// category that must be used (I, IIA, IIB, or III — I is the strongest).
// The user's chosen isolation is then compared to this minimum.
//
// ════════════════════════════════════════════════════════════════════════════


// ── ISOLATION CATEGORIES ─────────────────────────────────────────────────────
//
// There are four isolation categories (I, IIA, IIB, III). Category I is the
// most stringent (a physical spade or disconnection). Category III is the
// weakest (a single non-proven valve).
//
// CATEGORY_RANK maps each category to a number so they can be compared:
//   higher number = stronger isolation.
//   e.g. IIA (rank 3) is stronger than IIB (rank 2).
//
// You should not need to change this unless TAQA introduces a new category.
const CATEGORY_RANK = { I: 4, IIA: 3, IIB: 2, III: 1 };

// CATEGORY_INFO is used to display the MINIMUM REQUIRED side of the output card.
// Each entry gives the label, the image file, and the descriptive text shown.
//
// To update the display text for a category, change the "text" field below.
// Image files are in the imgs/ folder.
const CATEGORY_INFO = {
    I:   { label: 'Category I',   iso: 'spade',  img: 'imgs/spade.png',  text: 'Positive isolation - Spade or disconnection.' },
    IIA: { label: 'Category IIA', iso: 'dbb',    img: 'imgs/dbb.png',    text: 'Proven isolation - Double Block and Bleed (DBB) or double seal valve with body bleed.' },
    IIB: { label: 'Category IIB', iso: 'sbb',    img: 'imgs/sbb.png',    text: 'Proven isolation - Leak-tight Single Block and Bleed (SBB).' },
    III: { label: 'Category III', iso: 'single', img: 'imgs/single.png', text: 'Non-proven isolation - Single or double valve (double preferred over single, if available).' },
};

// ISO_TO_CATEGORY maps each user-selectable isolation option to the category it
// satisfies. Note that both "dbb" and "twin_seal" satisfy category IIA.
const ISO_TO_CATEGORY = { spade: 'I', dbb: 'IIA', twin_seal: 'IIA', sbb: 'IIB', single: 'III' };

// ISO_INFO is used to display the SELECTED ISOLATION side of the output card.
// Twin Seal Valve gets its own entry here (with its own image) even though it
// maps to the same category (IIA) as DBB.
//
// To update display text for a selected isolation type, change the "text" field.
// Image files are in the imgs/ folder.
const ISO_INFO = {
    spade:     { label: 'Category I',   img: 'imgs/spade.png',     text: 'Positive isolation - Spade or disconnection.' },
    dbb:       { label: 'Category IIA', img: 'imgs/dbb.png',       text: 'Proven isolation - Double Block and Bleed (DBB).' },
    twin_seal: { label: 'Category IIA', img: 'imgs/twin_seal.png', text: 'Proven isolation - Twin Seal Valve.' },
    sbb:       { label: 'Category IIB', img: 'imgs/sbb.png',       text: 'Proven isolation - Leak-tight Single Block and Bleed (SBB).' },
    single:    { label: 'Category III', img: 'imgs/single.png',    text: 'Non-proven isolation - Single or double valve (double preferred over single, if available).' },
};


// ── FLUID GROUPS ──────────────────────────────────────────────────────────────
//
// Fluids are assigned to one of four groups based on hazard level:
//   Group 1 — Highly Dangerous (e.g. Natural Gas, Crude Oil)
//   Group 2 — Dangerous       (e.g. Methanol, chemical injection fluids)
//   Group 3 — Hazardous       (e.g. Diesel, MEG, refrigerants)
//   Group 4 — Non-hazardous   (e.g. Seawater, TEG)
//
// Lower group number = more hazardous = more stringent isolation required.
//
// GROUP_NAMES is used to display the group label in the output.
// To rename a group label, change it here.
const GROUP_NAMES = { 1: 'Highly Dangerous', 2: 'Dangerous', 3: 'Hazardous', 4: 'Non-hazardous' };

// FLUIDS is the master list of fluids shown in the dropdown on Stage 1.
// Each entry has:
//   name  — displayed in the dropdown and in the output
//   group — the base fluid group (1–4, see above)
//
// TO ADD A NEW FLUID: add a new line in the correct group block, e.g.:
//   { name: 'Your Fluid Name', group: 2 },
//
// TO REMOVE A FLUID: delete its line. Be careful not to leave a trailing comma
//   on the last item in a block.
//
// TO CHANGE A FLUID'S GROUP: update the group number.
//
// The dropdown is built automatically from this list by the init() function —
// you do NOT need to touch index.html to add or remove fluids.
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

// tempGroup() works out what fluid group the operating temperature alone would
// imply, based on HSG253 thresholds. This is used to escalate a fluid's group
// if the temperature makes it more hazardous than its base classification.
//
// Rules (as per HSG253):
//   Above 60°C or below −10°C → treat as Group 1 (most hazardous)
//   50–60°C or −10 to 0°C    → treat as Group 3
//   0–50°C                   → no escalation (returns Group 4, no effect)
//
// NOTE: Temperature escalation can only make things MORE hazardous, never less.
// NOTE: Temperature never implies Group 2 — it jumps straight from 3 to 1.
function tempGroup(temp) {
    if (temp > 60 || temp < -10) return 1;
    if ((temp > 50 && temp <= 60) || (temp < 0 && temp >= -10)) return 3;
    return 4; // 0–50 °C: no temperature escalation
}

// finalGroup() combines the fluid's base group with the temperature group and
// returns whichever is more hazardous (i.e. the lower number).
//
// Example: Diesel is Group 3. If the operating temperature is 65°C,
// tempGroup returns 1. Math.min(3, 1) = 1, so the tool treats it as Group 1.
//
// If the temperature field was left blank (NaN), the base group is used as-is.
function finalGroup(baseGroup, temp) {
    if (Number.isNaN(temp)) return baseGroup;
    return Math.min(baseGroup, tempGroup(temp));
}


// ── DECISION LOGIC ───────────────────────────────────────────────────────────
//
// getRequiredCategory() is the core of the tool. It takes all the user's
// answers and returns:
//   cat    — the minimum isolation category required (I, IIA, IIB, or III)
//   driver — the ID of the output table cell that caused this requirement
//            (used to highlight that cell red in the output)
//
// PRECEDENCE (highest priority first — first match wins):
//   1. positiveIsoRisk = 'no' → Category I (spade/disconnection is safe to fit)
//   2. CSE (confined space entry) → Category I (always)
//   3. Boundary isolation → Category III (the boundary provides the main protection)
//   4. Flare / LP vent / closed drains → Category III (with extra controls)
//   5. Instrument SBT → IIB for Groups 1 & 2; III for Groups 3 & 4
//   6. Standard group × duration table (with hot work escalation for Groups 1 & 2):
//        Group 1 or 2, long duration or hot work → I
//        Group 1 or 2, short duration, no hot work → IIA
//        Group 3, long duration → IIA; short → IIB
//        Group 4, long duration → IIB; short → III
//
// TO CHANGE THE DECISION LOGIC: edit the conditions and return values below.
// Make sure to keep the precedence order correct — earlier rules override later ones.
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

// getAuthorisers() returns who must authorise a deviation (i.e. when the user's
// best available isolation does not meet the required category).
//
// The returned object has:
//   offshore — job title of the approver who is physically offshore
//   onshore  — job title of the approver onshore (null if none required)
//
// Returns null if no specific approver rule applies (catch-all site deviation process).
//
// TO CHANGE APPROVERS: update the job titles in the return statements below.
// "Offshore" and "onshore" describe where the approving person is based,
// NOT where the work is done (all work is offshore).
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


// ── ISOLATION CONTROLS TEXT ──────────────────────────────────────────────────
//
// These are the bulleted control statements shown at the bottom of the output
// card under "Isolation Controls required are:" / "Suggested controls to
// consider in the Level 2 risk assessment:".
//
// TO CHANGE THE WORDING of any control, edit the string below.
// The controls shown for a given job are selected by setControls() further down.

// Standard isolation controls (used for most jobs)
const control1 = "Pressure build-up test to ensure valve integrity.";
const control2 = "Regular monitoring of the isolation integrity.";
const control3 = "Continuous gas monitoring to be present when breaching.";
const control4 = "Contingency plan to be detailed in the ICC or TBT (for personal isolations) in case of isolation failure.";
const control5 = "Radio link to control room when containment is being broken.";
const hotWorkControl = "Hot work permit and dedicated fire watch required throughout the activity.";

// Small bore tubing (SBT) controls — used when the job is an instrument
// impulse line personal isolation
const sbtControl1 = "Where available double block valves should be used on impulse lines.";
const sbtControl2 = "Pressure build-up test to ensure valve integrity.";
const sbtControl3 = "Regular monitoring of the isolation integrity.";
const sbtControl4 = "Radio link to control room when containment is being broken.";
const sbtControl5 = "Contingency plan to be detailed on ICC or TBT (for personal isolations) in case of isolation failure.";
const sbtControl6 = "Continuous gas monitoring to be present when breaching hydrocarbon systems.";

// Flare / LP vent / closed drains controls — used when the single-valve
// exception applies for work against a flare, vent or drain system
const fvdControl1 = "Production Supervisor confirms no abnormal/increased flaring, venting, leak testing, compressor changes, well switches, deluge/F&G testing or other plant instability expected.";
const fvdControl2 = "Work party formally briefed that work is against a single valve on flare/vent/drain.";
const fvdControl3 = "Additional controls for toxic service.";
const fvdControl4 = "Rated blanks/bolts/gaskets verified and at worksite.";
const fvdControl5 = "AA/PA confirm valve position indicator shows fully closed.";
const fvdControl6 = "AA attends TBT.";

// Confined Space Entry (CSE) controls
const CSEControl1 = "Complete separation of the plant / equipment to be worked on from other parts of the system.";
const CSEControl2 = "Controls required as per TUK-17-C-016 Confined Space Entry procedure.";

// ── EQUIPMENT PREPARATION TEXT ───────────────────────────────────────────────
//
// These appear under "Preparation of equipment requirements:" in the output.
// prepControl3 and prepControl4 are only shown for Groups 1–3 (not Group 4).
//
// TO CHANGE THE WORDING: edit the strings below.
const prepControl1 = "Depressurised to nominal zero";
const prepControl2 = "Drain vessels and pipework";
const prepControl3 = "Water flush vessels and pipework";
const prepControl4 = "Nitrogen Purge vessels and pipework";


// ── OUTCOME MESSAGES ─────────────────────────────────────────────────────────
//
// These are the main outcome sentences shown prominently on the output card.
// TO CHANGE WORDING: edit the strings below.
const MEETS_TEXT = "The isolation selected meets the minimum standard required and can be used.";
const SHUTDOWN_HIGHRISK_TEXT = "A failure of this isolation could lead to a major accident event. Isolation selection is not appropriate — the plant must be shut down for this work.";
const SHUTDOWN_PRACTICABLE_TEXT = "It is reasonably practicable to wait for a shutdown. The plant should be shut down rather than relying on an in-service isolation for this work.";


// ── MODAL DIALOGS ────────────────────────────────────────────────────────────
//
// The tool uses Bootstrap modals (pop-up dialogs) instead of the browser's
// built-in alert() and prompt() functions, because Bootstrap modals look
// consistent with the rest of the page and can be styled.
//
// showAlert() shows a simple information message box with an OK button.
// It is used for validation error messages.
function showAlert(message, title = 'Information') {
    document.getElementById('alertModalTitle').textContent = title;
    document.getElementById('alertModalBody').textContent = message;
    bootstrap.Modal.getOrCreateInstance(document.getElementById('alertModal')).show();
}

// showNamePrompt() shows a dialog asking the user to type their name before
// the PDF is saved. It returns a Promise — meaning the rest of the code waits
// for the user to respond before continuing. Resolves with:
//   the name they typed (if they clicked Confirm)
//   null (if they clicked Cancel or closed the dialog)
function showNamePrompt(message) {
    return new Promise(resolve => {
        const modalEl    = document.getElementById('nameModal');
        const input      = document.getElementById('nameModalInput');
        const confirmBtn = document.getElementById('nameModalConfirm');
        document.getElementById('nameModalBody').textContent = message;
        input.value = '';

        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

        // cleanup removes the event listeners once the dialog is done, so
        // they don't accumulate if the dialog is opened more than once.
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


// ── INPUT HELPER FUNCTIONS ───────────────────────────────────────────────────

// getRadio() reads the currently selected value of a group of radio buttons
// (the Yes/No questions). Pass the radio button group name (the "name"
// attribute in the HTML). Returns '' if nothing is selected yet.
function getRadio(name) {
    const checked = document.querySelector(`input[name="${name}"]:checked`);
    return checked ? checked.value : '';
}

// getFluidInfo() reads the fluid dropdown and returns the selected fluid's
// name and base group number. If "Other" is selected, it reads the manually
// entered name and group from the extra fields that appear. Returns null if
// nothing has been selected.
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


// ── CONTROL SELECTION ────────────────────────────────────────────────────────
//
// setControls() chooses which isolation control statements to display in the
// output, based on the job characteristics, and writes them into the numbered
// list items (listControl1 … listControl6) in the output card.
//
// Selection priority:
//   1. CSE → show CSE controls only
//   2. SBT → show SBT controls (with or without pressure test depending on valve type)
//   3. Flare/vent/drains → show FVD controls (single valve gets all 6; proven valve drops
//      the 'single valve briefing' control as it is not applicable)
//   4. Otherwise → standard controls (vary by group and whether valve is proven)
//   5. Hot work (except when CSE applies) → add hot work control at the end
//
// PROVEN_VALVE_ISOS lists the isolation types that count as "proven" valves
// (DBB, Twin Seal, SBB). These get an additional pressure build-up test control.
// A single non-proven valve (Category III) does not.
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
    } else if (flareVentDrains) {
        controls = selValue === 'single'
            ? [fvdControl1, fvdControl2, fvdControl3, fvdControl4, fvdControl5, fvdControl6]
            : [fvdControl1, fvdControl3, fvdControl4, fvdControl5, fvdControl6];
    } else {
        controls = getStandardControls(group, isProvenValve);
    }

    // Hot work adds one extra control at the end (unless CSE already applies).
    if (hotWork && !cse) controls = [...controls, hotWorkControl];

    // Write the controls into the output card list items (7 slots available).
    for (let i = 1; i <= 7; i++) {
        document.getElementById(`listControl${i}`).textContent = controls[i - 1] || '';
    }
}


// ── FIELD VISIBILITY ─────────────────────────────────────────────────────────

// toggleOtherFluid() shows or hides the manual fluid name + group fields
// that appear when the user selects "Other" in the fluid dropdown.
function toggleOtherFluid() {
    const isOther = document.getElementById('fluidSelect').value === 'other';
    document.getElementById('otherFluidWrap').style.display = isOther ? 'block' : 'none';
}

// updateProgress() controls the progressive reveal of Stage 1:
//
//   Step 1 — The "Front-end planning checks" section (#gatingBlock) only
//             appears once the user has typed something in the title field.
//
//   Step 2 — The rest of the form (#restBlock, with all the other questions)
//             only appears once BOTH planning checks are answered "No".
//             If either is "Yes", a red warning message appears instead and
//             the tool waits for the user to click Next to record the
//             shutdown outcome.
//
//   Step 3 — The "Next" button only appears once everything is complete:
//             either all six Yes/No questions are answered (normal path),
//             or a planning check was "Yes" (shutdown path).
//
// This function is called every time the title changes or a radio is clicked.
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


// ── STAGE 1 → STAGE 2 (NEXT BUTTON) ─────────────────────────────────────────
//
// showSpec() runs when the user clicks "Next". It:
//   1. Validates Stage 1 (highlights any missing fields in red)
//   2. Short-circuits to showShutdownOutcome() if a planning check was "Yes"
//   3. Otherwise reveals the Stage 2 form (line description + isolation picker)
//
// KEY BEHAVIOUR regarding positive isolation risk:
//   If positiveIsoRisk = 'no' (safe to fit a spade):
//     → The isolation type picker is HIDDEN
//     → A note is shown instead
//     → The spade radio is selected automatically in the background
//     → The user only needs to enter a line description, then Calculate
//
//   If positiveIsoRisk = 'yes' (safer to use valves):
//     → The isolation type picker IS shown
//     → The spade option is ALWAYS hidden — users never select spade manually
//       (it is only ever auto-selected by the logic above)
//     → The user picks the best valve isolation available
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

    // Shutdown short-circuit — output is recorded without going to Stage 2.
    if (getRadio('majorAccident') === 'yes') { showShutdownOutcome(SHUTDOWN_HIGHRISK_TEXT); return; }
    if (getRadio('waitShutdown') === 'yes')  { showShutdownOutcome(SHUTDOWN_PRACTICABLE_TEXT); return; }

    // Validate remaining Stage 1 fields.
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

    // Highlight any Yes/No question rows that are visible but unanswered.
    // The array maps each radio button group name to the ID of its table row.
    [['positiveIsoRisk', 'qPosIsoRisk'], ['hotWork', 'qHotWork'], ['cse', 'qCse'],
     ['flareVentDrains', 'qFlareVentDrains'], ['sbt', 'qSbt'], ['boundary', 'qBoundary']]
        .forEach(([name, rowId]) => {
            const rowEl = document.getElementById(rowId);
            if (!rowEl) return;
            if (rowEl.style.display !== 'none' && getRadio(name) === '') {
                rowEl.classList.add('q-error'); // adds red background (defined in CSS)
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

    // The spade option in Stage 2 is always hidden from the user — it is only
    // ever set automatically. This line ensures it stays hidden even if the
    // user navigates back and forward.
    document.getElementById('spadeOption').style.display = 'none';

    const cseRisk = getRadio('cse');

    if (posRisk === 'no') {
        // Positive isolation is safe — no picker needed, auto-select spade.
        document.getElementById('isoTypeSection').style.display = 'none';
        document.getElementById('posIsoNotice').style.display = 'block';
        document.getElementById('cseNotice').style.display = 'none';
        document.getElementById('spade').checked = true;
    } else if (cseRisk === 'yes') {
        // CSE forces Category I — no picker needed, auto-select spade.
        document.getElementById('isoTypeSection').style.display = 'none';
        document.getElementById('cseNotice').style.display = 'block';
        document.getElementById('posIsoNotice').style.display = 'none';
        document.getElementById('spade').checked = true;
    } else {
        // User must choose from valve options.
        document.getElementById('isoTypeSection').style.display = 'block';
        document.getElementById('posIsoNotice').style.display = 'none';
        document.getElementById('cseNotice').style.display = 'none';
        // Clear spade if it was previously auto-selected on a prior visit.
        if (document.getElementById('spade').checked) document.getElementById('spade').checked = false;
    }

    document.getElementById('lineSpecificationDiv').style.display = 'block';
    document.getElementById('calcBtn').style.display = 'block';
    document.getElementById('nextBtn').style.visibility = 'hidden';

    window.scrollTo({ top: 0, behavior: 'smooth' });
}


// ── SHUTDOWN OUTCOME ─────────────────────────────────────────────────────────
//
// showShutdownOutcome() is called when either planning check is "Yes".
// It populates the output card with "N/A" for all fields that weren't
// filled in (since the tool short-circuited), shows a red stop message,
// and reveals the output card.
//
// The "message" parameter is either SHUTDOWN_HIGHRISK_TEXT or
// SHUTDOWN_PRACTICABLE_TEXT (defined near the top of this file).
function showShutdownOutcome(message) {
    document.getElementById('outTitle').textContent = document.getElementById('isoTitle').value;

    ['outLineDescLeft', 'outSub', 'outTemp', 'outDur', 'outHotWork', 'outCSE', 'outExempt', 'outBound']
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


// ── MAIN CALCULATION (CALCULATE BUTTON) ──────────────────────────────────────
//
// getInputData() runs when the user clicks "Calculate". It:
//   1. Validates Stage 2 (line description must be filled; isolation must be selected)
//   2. Reads all Stage 1 and Stage 2 answers
//   3. Calculates the final fluid group (with temperature escalation)
//   4. Calls getRequiredCategory() to get the minimum required isolation
//   5. Compares it to the user's selected isolation
//   6. Populates all the output card fields
//   7. Highlights the "driving" output field (the factor that set the requirement) in red
//   8. Sets the controls list via setControls()
//   9. Reveals the output card via revealOutput()
function getInputData() {
    let hasError = false;

    const lineDescEl = document.getElementById('lineDesc');
    if (!lineDescEl.value.trim()) {
        lineDescEl.style.borderColor = 'red';
        hasError = true;
    } else {
        lineDescEl.style.borderColor = '';
    }

    // The isolation type section is only shown when positiveIsoRisk = 'yes'.
    // If it is visible but nothing is selected, highlight it with a red border.
    const isoSectionEl = document.getElementById('isoTypeSection');
    if (isoSectionEl.style.display !== 'none' && !document.querySelector('input[name="isoTypeSelected"]:checked')) {
        isoSectionEl.classList.add('section-error'); // red border (defined in CSS)
        hasError = true;
    } else {
        isoSectionEl.classList.remove('section-error');
    }

    if (hasError) {
        showAlert('Please complete the highlighted fields before continuing.');
        return;
    }

    // Gather all inputs
    const fluid = getFluidInfo();
    const temp  = parseFloat(document.getElementById('operatingTemp').value);
    const group = finalGroup(fluid.baseGroup, temp); // may be escalated by temperature

    const positiveIsoRisk = getRadio('positiveIsoRisk');
    const cse             = getRadio('cse') === 'yes';
    const hotWork         = getRadio('hotWork') === 'yes';
    const flareVentDrains = getRadio('flareVentDrains') === 'yes';
    const sbt             = getRadio('sbt') === 'yes';
    const boundary        = getRadio('boundary') === 'yes';
    const longDuration    = document.getElementById('period').value === 'moreThanShift';

    // Run the decision logic
    const { cat: requiredCat, driver: drivingField } = getRequiredCategory({ cse, boundary, flareVentDrains, sbt, group, longDuration, hotWork, positiveIsoRisk });
    const required    = CATEGORY_INFO[requiredCat];

    const selValue = document.querySelector('input[name="isoTypeSelected"]:checked').value;
    const selCat   = ISO_TO_CATEGORY[selValue];
    const selected = ISO_INFO[selValue];

    // Does the selected isolation meet or exceed the required category?
    const meets = CATEGORY_RANK[selCat] >= CATEGORY_RANK[requiredCat];

    // ── Populate the output card ──────────────────────────────────────────
    // textContent is used (not innerHTML) to prevent any risk of HTML injection.
    document.getElementById('outTitle').textContent = document.getElementById('isoTitle').value;

    const escalated = group < fluid.baseGroup;
    document.getElementById('outSub').textContent =
        `${fluid.name} — Group ${group} (${GROUP_NAMES[group]})` +
        (escalated ? ` [escalated from Group ${fluid.baseGroup} by operating temperature]` : '');
    document.getElementById('outTemp').textContent = `${temp} °C`;

    document.getElementById('outDur').textContent = longDuration ? 'More than one shift' : 'One shift or less';
    document.getElementById('outLineDescLeft').textContent = lineDescEl.value;
    document.getElementById('outPosIsoRisk').textContent = positiveIsoRisk === 'yes' ? 'Yes' : 'No';
    document.getElementById('outHotWork').textContent  = hotWork ? 'Yes' : 'No';
    document.getElementById('outCSE').textContent      = cse ? 'Yes' : 'No';

    const exemptions = [];
    if (flareVentDrains) exemptions.push('Flare / LP vent / closed drains');
    if (sbt)             exemptions.push('Instrument small-bore tubing (SBT)');
    document.getElementById('outExempt').textContent = exemptions.length ? exemptions.join('; ') : 'None';

    document.getElementById('outBound').textContent  = boundary ? 'Yes' : 'No';

    // Minimum required isolation (left side of comparison)
    document.getElementById('outIsoImg').src           = required.img;
    document.getElementById('outIsoText').textContent  = `${required.label} — ${required.text}`;
    // Selected isolation (right side of comparison)
    document.getElementById('outSelIsoImg').src        = selected.img;
    document.getElementById('outIsoSelText').textContent = `${selected.label} — ${selected.text}`;

    const outcomeEl = document.getElementById('isoOutcome');
    const authEl    = document.getElementById('authGuidance');
    document.getElementById('comparisonSection').style.display = '';
    document.getElementById('controlsFooter').style.display = '';

    if (meets) {
        // Green-light outcome — isolation is sufficient
        document.getElementById('outImg').src = 'imgs/caution.png';
        outcomeEl.textContent = MEETS_TEXT;
        outcomeEl.style.color = 'black';
        outcomeEl.style.fontSize = '';
        authEl.textContent = '';
    } else {
        // Red outcome — deviation required
        document.getElementById('outImg').src = 'imgs/stop.png';
        outcomeEl.textContent =
            `The isolation selected (${selected.label}) does not meet the minimum standard required (${required.label}). ` +
            `A Level 2 risk assessment / deviation MUST be carried out before this isolation is used.`;
        outcomeEl.style.color = 'red';
        outcomeEl.style.fontSize = '18px';

        // Show who needs to authorise the deviation
        const authorisers = getAuthorisers(group, requiredCat);
        if (authorisers) {
            let who = `${authorisers.offshore} (offshore)`;
            if (authorisers.onshore) who += ` and ${authorisers.onshore} (onshore)`;
            authEl.textContent = `Authorisation for this deviation is required from: ${who}.`;
        } else {
            authEl.textContent = 'Authorisation for this deviation must be obtained through the site deviation process.';
        }
    }

    // Highlight the output table cell that determined the required category.
    // First clear all highlights, then apply red+bold to just the driving cell.
    ['outPosIsoRisk', 'outHotWork', 'outCSE', 'outExempt', 'outBound', 'outDur', 'outSub']
        .forEach(id => document.getElementById(id).removeAttribute('style'));
    const driverEl = document.getElementById(drivingField);
    if (driverEl) { driverEl.style.color = 'red'; driverEl.style.fontWeight = 'bold'; }

    // Populate controls and preparation requirements
    setControls({ cse, sbt, flareVentDrains, group, hotWork, selValue });

    document.getElementById('prepControl1').textContent = prepControl1;
    document.getElementById('prepControl2').textContent = prepControl2;
    // Water flush and nitrogen purge only apply to Groups 1–3, not Group 4 (non-hazardous)
    document.getElementById('prepControl3').textContent = group <= 3 ? prepControl3 : '';
    document.getElementById('prepControl4').textContent = group <= 3 ? prepControl4 : '';

    // The headings change depending on whether the isolation meets the standard
    if (meets) {
        document.getElementById('controlsHeading').textContent = 'Isolation Controls required are:';
        document.getElementById('prepHeading').textContent = 'Preparation of equipment requirements:';
    } else {
        document.getElementById('controlsHeading').textContent = 'Suggested controls to consider in the Level 2 risk assessment:';
        document.getElementById('prepHeading').textContent = 'Suggested preparation controls to consider in the Level 2 risk assessment:';
    }

    revealOutput();
}

// revealOutput() hides the input forms and header, and shows the output card
// and the Back / Save as PDF buttons. Called by both getInputData() and
// showShutdownOutcome().
function revealOutput() {
    document.getElementById('outCard').style.display      = 'block';
    document.getElementById('inputSection').style.display = 'none';
    document.getElementById('header').style.display       = 'none';
    document.getElementById('backBtn').style.display      = 'block';
    document.getElementById('calcBtn').style.display      = 'none';
    document.getElementById('printBtn').style.display     = 'block';
    document.getElementById('backBtn').scrollIntoView();
}

// goBack() hides the output card and restores the input form, putting the tool
// back into whichever stage the user was at. The progressive-reveal state is
// restored from the current radio button answers (via updateProgress).
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

    // If Stage 2 is already showing (user got this far), keep the Calculate button.
    if (document.getElementById('lineSpecificationDiv').style.display === 'block') {
        document.getElementById('calcBtn').style.display = 'flex';
    }
}


// ── PDF EXPORT ───────────────────────────────────────────────────────────────
//
// printPDF() saves the output card as a PDF file. It uses two external
// libraries loaded in index.html:
//   html2canvas — takes a "screenshot" of the output card as an image
//   jsPDF       — places that image onto an A4 PDF page and saves it
//
// Process:
//   1. Determines the filename (includes ICC number if one was entered)
//   2. Shows the name prompt modal and waits for the user to confirm
//   3. Adds a "prepared by" line to the output card
//   4. Renders the card to an image (scale: 2 = higher resolution)
//   5. Fits the image onto an A4 page with equal margins
//   6. Saves the PDF
//   7. Removes the "pdf-render" class (which may adjust styling for print)
async function printPDF() {
    let filename = document.getElementById('iccNo').value;
    filename = filename ? `ICC ${filename} IST_Outcome.pdf` : 'IST_Outcome.pdf';

    const person = await showNamePrompt('Please confirm that you have read the outcome and comply with the controls stipulated, then enter your name to confirm.');
    if (!person) return; // user cancelled

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

        // Scale the image to fill the page width, then shrink uniformly if it
        // would be taller than the page — guaranteeing a single-page output.
        // A 10 mm margin is applied; when height-scaling kicks in the image is
        // centred so L/R margins remain symmetric (though slightly wider than
        // the top margin for very tall outputs).
        const margin = 10;
        const usableW = pageW - margin * 2;
        const usableH = pageH - margin * 2;

        let imgW = usableW;
        let imgH = imgW * (canvas.height / canvas.width);
        if (imgH > usableH) {
            const scale = usableH / imgH;
            imgW *= scale;
            imgH  = usableH;
        }

        const x = (pageW - imgW) / 2;
        const y = (pageH - imgH) / 2;   // centre vertically too, so all margins balance
        pdf.addImage(imgData, 'JPEG', x, y, imgW, imgH);
        pdf.save(filename);
    } finally {
        element.classList.remove('pdf-render');
    }
}

// popitup() opens the help page in a small popup browser window.
// Called by the Help button in index.html.
function popitup(url) {
    const newwindow = window.open(url, 'name', 'height=900,width=800');
    if (window.focus) newwindow.focus();
}


// ── CONTEXTUAL HELP POPOVER CONTENT ─────────────────────────────────────────
//
// Each field with a blue "?" button has a popover (tooltip-style popup) that
// explains what the field means and how it affects the result.
//
// HELP_CONTENT maps a key to the popover title and content.
// The key matches the data-help-key attribute on the "?" button in index.html.
//
// TO EDIT EXISTING HELP TEXT: change "title" or "content" for the relevant key.
//
// TO ADD A NEW HELP POPOVER:
//   1. Add an entry here (set html: true if the content uses <br>, <strong>, etc.)
//   2. Add a <button type="button" class="help-tip" data-help-key="yourKey">?</button>
//      in the relevant place in index.html
//   No other changes needed — the popovers are initialised automatically in init().
const HELP_CONTENT = {
    temp: {
        title: 'Temperature escalation',
        content: 'Escalates the fluid group if the temperature is extreme. Above 60°C or below −10°C the fluid is treated as Group 1 (Highly Dangerous) regardless of its base group. Between 50–60°C or −10 to 0°C it is treated as Group 3. The tool always uses whichever is more onerous.',
    },
    duration: {
        title: 'Containment broken duration',
        content: 'This is not the total task duration — it is the exposure window if the isolation were to fail. If the work crosses a shift change or the pipework could be left open overnight, choose "More than one shift".',
    },
    posIsoRisk: {
        title: 'Positive isolation risk',
        content: '<strong>No</strong> — a spade or disconnection can be safely achieved. The tool auto-applies Category I (positive isolation) and skips the isolation type picker in Stage 2.<br><br><strong>Yes</strong> — fitting or removing the spade is itself a greater risk than valve isolation (e.g. high-pressure service). Stage 2 will ask you to select the best valve isolation available.',
        html: true,
    },
    hotWork: {
        title: 'Hot work',
        content: 'Any activity with spark potential or naked flame — grinding, cutting, welding, or nearby engines. Escalates Groups 1 and 2 to Category I only; has no effect on Groups 3 and 4.',
    },
    cse: {
        title: 'Confined space entry (CSE)',
        content: 'CSE always requires positive isolation (Category I) regardless of fluid group or duration. No other factor can reduce this requirement.',
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


// ── INITIALISATION ───────────────────────────────────────────────────────────
//
// init() sets up everything when the page loads. It:
//   1. Checks we are on index.html (not help.html — which also loads this file)
//   2. Builds the fluid dropdown from the FLUIDS array
//   3. Wires up all the event listeners (field changes, button clicks)
//   4. Sets the initial visibility state of progressive fields
//   5. Initialises the help popovers
//
// NOTE ON POPOVERS: Bootstrap must be fully loaded before we can create
// popovers. main.js loads with "defer", meaning it runs after the HTML is
// parsed but potentially before Bootstrap finishes. By listening for
// DOMContentLoaded (which fires after ALL deferred scripts), we ensure
// Bootstrap is available when we call new bootstrap.Popover().
function init() {
    // help.html also loads this script but has no fluid dropdown — exit early.
    const fluidSelect = document.getElementById('fluidSelect');
    if (!fluidSelect) return;

    // Build the fluid dropdown, grouped by fluid group (Group 1 first).
    // Options come from the FLUIDS array defined at the top of this file.
    // To add/remove/rename fluids, edit the FLUIDS array — not this code.
    [1, 2, 3, 4].forEach(g => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = `Group ${g} — ${GROUP_NAMES[g]}`;
        FLUIDS.forEach((f, idx) => {
            if (f.group !== g) return;
            const opt = document.createElement('option');
            opt.value = String(idx);   // value is the index into FLUIDS[]
            opt.textContent = f.name;
            optgroup.appendChild(opt);
        });
        fluidSelect.appendChild(optgroup);
    });
    // Add the "Other" option at the bottom
    const other = document.createElement('option');
    other.value = 'other';
    other.textContent = 'Other (enter manually)…';
    fluidSelect.appendChild(other);
    fluidSelect.selectedIndex = 0; // start with the blank placeholder selected

    fluidSelect.addEventListener('change', toggleOtherFluid);
    toggleOtherFluid(); // run once to set initial state

    // Progressive reveal — title field and planning check radios
    document.getElementById('isoTitle').addEventListener('input', updateProgress);
    document.querySelectorAll('input[name="majorAccident"], input[name="waitShutdown"]')
        .forEach(radio => radio.addEventListener('change', updateProgress));
    updateProgress(); // set the initial state on page load

    // Progressive reveal of the six Yes/No questions.
    // QUESTION_CHAIN maps each question's radio name to the ID of the next
    // element to reveal when that question is answered.
    // The last question ("boundary") reveals "iccBlock" (the ICC number field),
    // which is a <div> not a <tr>, so the display value differs — the code
    // below handles this with a check on the element's tag name.
    //
    // TO CHANGE THE QUESTION ORDER: reorder the entries here AND reorder the
    // <tr> rows in index.html to match. Both must stay in sync.
    //
    // TO ADD A NEW QUESTION: add a <tr> in index.html, add a name→nextId entry
    // here, and add the name to the allQuestionsAnswered check in updateProgress().
    const QUESTION_CHAIN = {
        positiveIsoRisk: 'qHotWork',
        hotWork:         'qCse',
        cse:             'qFlareVentDrains',
        flareVentDrains: 'qSbt',
        sbt:             'qBoundary',
        boundary:        'iccBlock',  // last question → reveals ICC field
    };
    Object.keys(QUESTION_CHAIN).forEach(name => {
        document.querySelectorAll(`input[name="${name}"]`).forEach(radio => {
            radio.addEventListener('change', () => {
                // Remove the red error highlight if this row was previously flagged.
                radio.closest('tr')?.classList.remove('q-error');
                // Reveal the next element in the chain.
                const next = document.getElementById(QUESTION_CHAIN[name]);
                // Question rows are <tr> elements — they need 'table-row', not 'block'.
                next.style.display = next.tagName === 'TR' ? 'table-row' : 'block';
                next.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                updateProgress();
                // After the last question, also scroll to the Next button.
                if (name === 'boundary') {
                    setTimeout(() => {
                        document.getElementById('nextBtn').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }, 400); // short delay so the ICC field finishes appearing first
                }
            });
        });
    });

    // Clear the red border around the isolation type section when user picks one.
    document.querySelectorAll('input[name="isoTypeSelected"]').forEach(radio => {
        radio.addEventListener('change', () => {
            document.getElementById('isoTypeSection').classList.remove('section-error');
        });
    });

    // Auto-clear red borders on text/number inputs when the user starts typing.
    ['isoTitle', 'operatingTemp', 'otherFluidName', 'lineDesc'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', function () { this.style.borderColor = ''; });
    });
    // Auto-clear red borders on dropdowns when the user changes the selection.
    ['fluidSelect', 'period'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', function () { this.style.borderColor = ''; });
    });

    // Wire up the main navigation and action buttons.
    document.getElementById('helpBtn').addEventListener('click', () => popitup('help.html'));
    document.getElementById('nextBtn').addEventListener('click', showSpec);
    document.getElementById('calcBtn').addEventListener('click', getInputData);
    document.getElementById('backBtn').addEventListener('click', goBack);
    document.getElementById('printBtn').addEventListener('click', printPDF);

    // Initialise help popovers after Bootstrap has fully loaded.
    // (main.js and Bootstrap both use "defer" — DOMContentLoaded fires after both.)
    window.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('[data-help-key]').forEach(el => {
            const help = HELP_CONTENT[el.getAttribute('data-help-key')];
            if (!help) return;
            new bootstrap.Popover(el, {
                title: help.title,
                content: help.content,
                html: !!help.html,       // true only when content contains HTML tags
                trigger: 'hover focus',  // show on mouse hover or keyboard focus
                placement: 'auto',       // Bootstrap picks best position automatically
            });
        });
    });
}

init();
