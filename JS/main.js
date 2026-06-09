// Isolation type scores
const ISO_SCORES = { spade: 1000, dbb: 450, sbb: 89, single: 29 };

// Purpose overrides — bypasses the release × substance × duration matrix
const PURPOSE_SCORES = { sbt: 80, motion: 80, cse: 900 };

// Thresholds that determine the minimum required isolation
const ISO_THRESHOLDS = { spade: 450, dbb: 89, sbb: 29 };

const MEETS_TEXT = "The isolation selected meets the minimum standards required and can be used.";
const NOT_MEETS_TEXT = "The isolation selected does not meet the minimum standard required. A Level 2 risk assessment MUST be carried out if this is to be used.";

// Breaking of containment controls
const control1 = "Pressure build-up test to ensure valve integrity.";
const control2 = "Regular monitoring of the isolation integrity.";
const control3 = "Continuous gas monitoring to be present when breaching.";
const control4 = "Contingency plan to be detailed in the ICC or TBT (for personal isolations) in case of isolation failure.";
const control5 = "Radio link to control room when containment is being broken.";

// Small bore tubing controls
const sbtControl1 = "Where available double block valves should be used on impulse lines.";
const sbtControl2 = "Pressure build-up test to ensure valve integrity.";
const sbtControl3 = "Regular monitoring of the isolation integrity.";
const sbtControl4 = "Radio link to control room when containment is being broken.";
const sbtControl5 = "Contingency plan to be detailed on ICC or TBT (for personal isolations) in case of isolation failure.";
const sbtControl6 = "Continuous gas monitoring to be present when breaching hydrocarbon systems.";

// Non-invasive controls
const nonInvasiveControl1 = "Regular monitoring of the isolation integrity.";
const nonInvasiveControl2 = "Contingency plan to be detailed on ICC or TBT (for personal isolations) in case of isolation failure.";

// CSE controls
const CSEControl1 = "Complete separation of the plant / equipment to be worked on from other parts of the system.";
const CSEControl2 = "Controls required as per TUK-17-C-004 section 8";

// Preparation controls
const prepControl1 = "Depressurised to nominal zero";
const prepControl2 = "Drain vessels and pipework";
const prepControl3 = "Water flush vessels and pipework";
const prepControl4 = "Nitrogen Purge vessels and pipework";

// Release potential matrix: rows = pipe size bands, cols = pressure bands
const releaseMatrix = [
    [null, 150,  100, 50, 20, 10,  0],
    [24,    10,   10, 10,  9,  7,  6],
    [12,    10,   10,  9,  7,  6,  6],
    [6,     10,    9,  6,  6,  6,  6],
    [1,     10,    6,  6,  3,  2,  1],
    [0,     10,    4,  3,  3,  1,  1],
];

function getReleaseScore(pipeSize, pressure) {
    let col;
    if      (pressure >= 150) col = 1;
    else if (pressure >= 100) col = 2;
    else if (pressure >= 50)  col = 3;
    else if (pressure >= 20)  col = 4;
    else if (pressure >= 10)  col = 5;
    else                      col = 6;

    let row;
    if      (pipeSize >= 24) row = 1;
    else if (pipeSize >= 12) row = 2;
    else if (pipeSize >= 6)  row = 3;
    else if (pipeSize >  1)  row = 4;
    else                     row = 5;

    return releaseMatrix[row][col];
}

function getMinimumIsolation(totalScore) {
    if      (totalScore > ISO_THRESHOLDS.spade) return { img: 'imgs/spade.png', text: 'Positive isolation - Spade or disconnection' };
    else if (totalScore > ISO_THRESHOLDS.dbb)   return { img: 'imgs/dbb.png',   text: 'Proven isolation - Double Block and Bleed (DBB) or double seal valve with body bleed.' };
    else if (totalScore > ISO_THRESHOLDS.sbb)   return { img: 'imgs/sbb.png',   text: 'Proven isolation - Leak tight Single Block and Bleed (SBB).' };
    else                                         return { img: 'imgs/single.png', text: 'Non-proven isolation - Single or double valve - Double valve should be used rather than single, if available.' };
}

function getSelectedIso() {
    const checked = document.querySelector('input[name="isoTypeSelected"]:checked');
    const value = checked ? checked.value : '';
    const map = {
        spade:  { score: ISO_SCORES.spade,  img: 'imgs/spade.png',  text: 'Positive isolation - Spade or disconnection' },
        dbb:    { score: ISO_SCORES.dbb,    img: 'imgs/dbb.png',    text: 'Proven isolation - Double Block and Bleed (DBB) or double seal valve with body bleed.' },
        sbb:    { score: ISO_SCORES.sbb,    img: 'imgs/sbb.png',    text: 'Proven isolation - Leak tight Single Block and Bleed (SBB).' },
        single: { score: ISO_SCORES.single, img: 'imgs/single.png', text: 'Non-proven isolation - Single or double valve - Double valve should be used rather than single, if available.' },
    };
    return map[value] || map.single;
}

function getPurpose() {
    const checked = document.querySelector('input[name="purpose"]:checked');
    return checked ? checked.value : '';
}

function isDetailRequired() {
    const purpose = getPurpose();
    return purpose === 'boc' || purpose === 'sbt';
}

function updateFieldVisibility() {
    const show = isDetailRequired();
    ['subHide', 'durHide', 'boundHide', 'lineHide', 'pipeHide', 'pressHide'].forEach(id => {
        document.getElementById(id).style.display = show ? 'block' : 'none';
    });
}

function showSpec() {
    const isoTitle = document.getElementById('isoTitle').value;
    if (!isoTitle) {
        document.getElementById('isoTitle').style.borderColor = 'red';
        alert('Please enter a title for the isolation');
        return;
    }
    document.getElementById('isoTitle').style.borderColor = 'black';

    const purpose = getPurpose();
    if (!purpose) {
        alert('Please select the purpose of the isolation');
        return;
    }

    if (isDetailRequired()) {
        if (!document.querySelector('input[name="substance"]:checked')) {
            alert('Please select the substance');
            return;
        }
        if (!document.getElementById('period').value) {
            alert('Please select how long containment will be broken for');
            return;
        }
    }

    document.getElementById('lineSpecificationDiv').style.display = 'block';
    document.getElementById('calcBtn').style.display = 'block';
    document.getElementById('nextBtn').style.visibility = 'hidden';

    if (purpose === 'sbt') {
        document.getElementById('pipeSizeNum').value = 0.5;
    }
    if (document.getElementById('boundary').checked) {
        document.getElementById('pressure').value = 0;
    }
}

function getBoCControls(substance, pressure, selIsoScore) {
    const controls = [];
    if (substance === 'flammable') {
        controls.push(control1, control2, control3);
        if (pressure >= 10) controls.push(control4, control5);
    } else {
        if (selIsoScore >= ISO_SCORES.sbb) controls.push(control1);
        controls.push(control2);
        if (pressure >= 10) controls.push(control4);
    }
    return controls;
}

function setControls(purpose, substance, pressure, selIsoScore) {
    const controlSets = {
        sbt:    [sbtControl1, sbtControl2, sbtControl3, sbtControl4, sbtControl5, sbtControl6],
        motion: [nonInvasiveControl1, nonInvasiveControl2],
        cse:    [CSEControl1, CSEControl2],
    };
    const controls = controlSets[purpose] || getBoCControls(substance, pressure, selIsoScore);
    for (let i = 1; i <= 6; i++) {
        document.getElementById(`listControl${i}`).textContent = controls[i - 1] || '';
    }
}

function getInputData() {
    const purpose   = getPurpose();
    const detailReq = isDetailRequired();

    let pipeSize, pressure, lineDesc, substance, period;

    if (detailReq) {
        lineDesc  = document.getElementById('lineDesc').value;
        pipeSize  = document.getElementById('pipeSizeNum').value;
        pressure  = document.getElementById('pressure').value;
        substance = document.querySelector('input[name="substance"]:checked')?.value || '';
        period    = document.getElementById('period').value;

        if (!lineDesc) {
            document.getElementById('lineDesc').style.borderColor = 'red';
            alert('Please enter a description of the line');
            return;
        }
        document.getElementById('lineDesc').style.borderColor = 'black';
        if (!pipeSize)  { alert('Please enter the size of the pipe'); return; }
        if (!pressure)  { alert('Please enter the expected pressure'); return; }
        if (!document.querySelector('input[name="isoTypeSelected"]:checked')) {
            alert('Please select the highest level of isolation that can practically be applied');
            return;
        }
    } else {
        pipeSize  = 'N/A';
        pressure  = 'N/A';
        lineDesc  = 'N/A';
        substance = 'N/A';
        period    = 'N/A';
    }

    const pipeSizeNum = parseFloat(pipeSize);
    const pressureNum = parseFloat(pressure);

    // Calculate total risk score
    const releaseScore   = detailReq ? getReleaseScore(pipeSizeNum, pressureNum) : 1;
    const substanceScore = { flammable: 10, haz: 3, nonHaz: 1 }[substance] || 1;
    const timeScore      = { oneOrLess: 3, upToWeek: 7, moreWeek: 10 }[period] || 3;

    let totalScore = releaseScore * substanceScore * timeScore;
    if (PURPOSE_SCORES[purpose] !== undefined) totalScore = PURPOSE_SCORES[purpose];

    const selIso  = getSelectedIso();
    const required = getMinimumIsolation(totalScore);
    const meets    = selIso.score >= totalScore;

    // Populate output — textContent used throughout to prevent XSS
    document.getElementById('outTitle').textContent    = document.getElementById('isoTitle').value;
    document.getElementById('outLineDesc').textContent = lineDesc;
    document.getElementById('outPipe').textContent     = detailReq ? `${pipeSize} inches` : 'N/A';
    document.getElementById('outBar').textContent      = detailReq ? `${pressure} bar` : 'N/A';
    document.getElementById('outBound').textContent    = document.getElementById('boundary').checked ? 'Yes' : 'No';

    const substanceLabels = { flammable: 'Flammable or Toxic liquid or gas', haz: 'Hazardous utilities or Chemicals', nonHaz: 'Non-Hazardous Substances' };
    document.getElementById('outSub').textContent = detailReq ? (substanceLabels[substance] || '') : 'N/A';

    const durationLabels = { oneOrLess: 'Less than one shift', upToWeek: 'More than one shift, less than one week', moreWeek: 'More than one week' };
    document.getElementById('outDur').textContent = detailReq ? (durationLabels[period] || '') : 'N/A';

    const purposeLabels = { boc: 'Breaking of Containment', sbt: 'Small Bore Tubing 1/2 inch or less.', motion: 'To prevent motion in equipment for non-invasive work', cse: 'For confined space entry' };
    document.getElementById('outPur').textContent = purposeLabels[purpose] || '';

    document.getElementById('outIsoSel').textContent     = selIso.text;
    document.getElementById('outSelIsoImg').src          = selIso.img;
    document.getElementById('outIsoSelText').textContent = selIso.text;

    document.getElementById('outIsoImg').src          = required.img;
    document.getElementById('outIsoText').textContent = required.text;

    document.getElementById('outImg').src = meets ? 'imgs/caution.png' : 'imgs/stop.png';
    const outcomeEl = document.getElementById('isoOutcome');
    outcomeEl.textContent    = meets ? MEETS_TEXT : NOT_MEETS_TEXT;
    outcomeEl.style.color    = meets ? 'black' : 'red';
    outcomeEl.style.fontSize = meets ? '' : '24px';

    setControls(purpose, substance, pressureNum, selIso.score);

    document.getElementById('prepControl1').textContent = prepControl1;
    document.getElementById('prepControl2').textContent = prepControl2;
    document.getElementById('prepControl3').textContent = substance !== 'nonHaz' ? prepControl3 : '';
    document.getElementById('prepControl4').textContent = substance !== 'nonHaz' ? prepControl4 : '';

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
    document.getElementById('calcBtn').style.display      = 'flex';
    document.getElementById('printBtn').style.display     = 'none';
    document.getElementById('header').style.display       = 'block';
}

async function printPDF() {
    let filename = document.getElementById('iccNo').value;
    filename = filename ? `ICC ${filename} IST_Outcome.pdf` : 'IST_Outcome.pdf';

    const person = prompt('Please confirm that you have read the outcome and comply with the controls stipulated.\nPlease enter your name to confirm', '');
    if (!person) return;

    const date = new Date();
    document.getElementById('preparedBy').textContent = `Isolation Selector outcome prepared by: ${person} ${date}`;

    const element = document.getElementById('outCard');
    element.classList.add('pdf-render');

    try {
        const canvas = await html2canvas(element, { scale: 2, useCORS: true });

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

        const margin = 10;
        const maxW = 210 - margin * 2;  // A4 width minus equal left/right margins
        const maxH = 297 - margin * 2;  // A4 height minus equal top/bottom margins

        // Scale canvas to fit within the A4 content area, preserving aspect ratio
        const canvasRatio = canvas.height / canvas.width;
        let imgW = maxW;
        let imgH = imgW * canvasRatio;
        if (imgH > maxH) {
            imgH = maxH;
            imgW = imgH / canvasRatio;
        }

        pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', margin, margin, imgW, imgH);
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
    updateFieldVisibility();  // set initial state — no purpose selected yet
    document.querySelectorAll('input[name="purpose"]').forEach(radio => {
        radio.addEventListener('change', updateFieldVisibility);
    });
    document.getElementById('helpBtn').addEventListener('click', () => popitup('help.html'));
    document.getElementById('nextBtn').addEventListener('click', showSpec);
    document.getElementById('calcBtn').addEventListener('click', getInputData);
    document.getElementById('backBtn').addEventListener('click', goBack);
    document.getElementById('printBtn').addEventListener('click', printPDF);
}

init();
