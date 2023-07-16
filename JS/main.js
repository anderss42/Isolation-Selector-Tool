

// Long text gets declared here so that it can be changed easily. 
//Statement used on output card depending on if it meets the standard or not
const meets = "The isolation selected meets the minimum standards required and can be used.";
const notMeets = "The isolation selected does not meet the minimum standard required. A Level 2 risk assessment MUST be carried out if this is to be used.";
// Controls required 
const control1 = "Pressure build-up test to ensure valve integrity.";
const control2 = "Regular monitoring of the isolation integrity.";
const control3 = "Continuous gas monitoring to be present when breaching.";
const control4 = "Contingency plan to be detailed in the ICC or TBT (for personal isolations) in case of isolation failure.";
const control5 = "Radio link to control room when containment is being broken.";
//const control6 = "Continuous gas monitoring to be present when breaching.";

// Small bore tubing
const sbtControl1 = "Where available double block valves should be used on impulse lines.";
const sbtControl2 = "Pressure build-up test to ensure valve integrity.";
const sbtControl3 = "Regular monitoring of the isolation integrity.";
const sbtControl4 = "Radio link to control room when containment is being broken.";
const sbtControl5 = "Contingency plan to be detailed on ICC or TBT (for personal isolations) in case of isolation failure.";
const sbtControl6 = "Continuous gas monitoring to be present when breaching hydrocarbon systems.";

// Non-invasive
const nonInvasiveControl1 = "Pressure build-up test to ensure valve integrity.";
const nonInvasiveControl2 = "Regular monitoring of the isolation integrity.";
const nonInvasiveControl3 = "Contingency plan to be detailed on ICC or TBT (for personal isolations) in case of isolation failure.";

// Preparation of equipment controls
const prepControl1 = "Depressurised to nominal zero";
const prepControl2 = "Drain vessels and pipework";
const prepControl3 = "Water flush vessels and pipework"; //boc flam or toxic only
const prepControl4 = "Nitrogen Purge vessels and pipework"; //boc flam or toxic only

$(document).ready(function () { $('[data-toggle="tooltip"]').tooltip() });

function getInputData() {
    let releaseH = 0;
    let releaseV = 0;
    let releaseScore = 0;
    let substanceScore = 0;
    let timeScore = 0;
    let totalScore = 0;
    let selIsoScore = 0;

    console.log("Get input called calculate");
    var isoTitle = document.forms["systemProperties"]["isoTitle"].value;
    var pipeSize = document.forms["spec"]["pipeSizeNum"].value;
    var pressure = document.forms["spec"]["pressure"].value;
    var lineDesc = document.forms["spec"]["lineDesc"].value;
    var selIso = document.forms["spec"]["isoTypeSelected"].value;
    var substance = document.forms["systemProperties"]["substance"].value;
    var period = document.forms["systemProperties"]["period"].value;
    //let numOfLines = document.forms["systemProperties"]["numOfLines"].value;
    var purpose = document.forms["systemProperties"]["purpose"].value;


    //const boundary = document.querySelector('#boundary').value;


    // 3 arrays which are then used to provide a number from 1 to 10 depending on the user inputs. 
    let releaseMatrix = [
        ['size/pressure', '>150bar', '>100bar', '>50bar', '>20bar', '>10bar', '<10bar'],
        ['>24', 10, 10, 10, 9, 7, 6],
        ['>=12', 10, 10, 9, 7, 6, 6],
        ['>=6', 10, 9, 6, 6, 6, 6],
        ['>=1', 10, 6, 6, 3, 2, 1],
        ['<1', 10, 4, 3, 3, 1, 1],
    ];

    let effectMatrix = [
        ['Flammable', 10],
        ['Hazadous', 3],
        ['Non-Hazardour', 1],
    ];

    let timeMatrix = [
        ['Freq', 'Less than a shift', 'More than one, less than 7', 'More than 7'],
        ['Daily', 10, 10, 'N/A'],
        ['Weekly', 4, 7, 'N/A'],
        ['Monthly or Less', 3, 7, 10],
    ];

    console.table(releaseMatrix);
    console.table(effectMatrix);
    console.table(timeMatrix);

    if (pressure >= 150) { releaseH = 1; }
    else if (pressure >= 100) { releaseH = 2; }
    else if (pressure >= 50) { releaseH = 3; }
    else if (pressure >= 20) { releaseH = 4; }
    else if (pressure >= 10) { releaseH = 5; }
    else releaseH = 6;

    if (pipeSize >= 24) { releaseV = 1 }
    else if (pipeSize >= 12) { releaseV = 2 }
    else if (pipeSize >= 6) { releaseV = 3 }
    else if (pipeSize >= 1) { releaseV = 4 }
    else releaseV = 5;
    releaseScore = (releaseMatrix[releaseV][releaseH]);

    if (substance === 'flammable') {
        substanceScore = (effectMatrix[0][1]);
        document.getElementById('outSub').innerHTML = "Flammable or Toxic liquid or gas"
    }
    else if (substance === 'haz') {
        substanceScore = (effectMatrix[1][1]);
        document.getElementById('outSub').innerHTML = "Hazardous utilities or Chemicals"
    }
    else {
        substanceScore = (effectMatrix[2][1]);
        console.log("Substance score");
        console.log(substanceScore);
        document.getElementById('outSub').innerHTML = "Non-Hazardous Substances";
    }
    console.log('Substance score is ' + substanceScore);

    if (period === 'oneOrLess') {
        timeScore = (timeMatrix[3][1]);
        document.getElementById('outDur').innerHTML = "Less than one shift";
    }
    else if (period === 'upToWeek') {
        timeScore = (timeMatrix[3][2]);
        document.getElementById('outDur').innerHTML = "More than one shift, less than one week";
    }
    else {
        timeScore = (timeMatrix[3][3]);
        document.getElementById('outDur').innerHTML = "More than one week";
    }


    // total score will multiply the 3 scores from the arrays and then proveide a total risk factor which will be between 1 and 1000
    totalScore = (substanceScore * releaseScore * timeScore);

//this section will overide the calculated score if the job is SBT, Motion or CSE
if(purpose == 'sbt'){totalScore = 80};//nominal value that will give it a score for proven single
if(purpose == 'cse'){totalScore = 900};//nominal value that will give it a score for spade
if(purpose == 'motion'){totalScore = 80}; //nominal value that will give it a score for proven single

    if (selIso === 'spade') {
        selIsoScore = 1000;
        document.getElementById('outIsoSel').innerHTML = "Positve isolation - Spade or disconnection";
    }
    else if (selIso === 'dbb') {
        selIsoScore = 450;
        document.getElementById('outIsoSel').innerHTML = "Proven isolation - Double Block and Bleed (DBB) or double seal valve with body bleed.";
    }
    else if (selIso === 'sbb') {
        selIsoScore = 89;
        document.getElementById('outIsoSel').innerHTML = "Proven isolation - Leak tight Single Block and Bleed (SBB).";
    }
    else {
        selIsoScore = 29;
        document.getElementById('outIsoSel').innerHTML = "Non-proven isolation - Single or double valve - Double valve should be used rather than single, if available.";
    }


    //this section will give a stop or caution icon if the planned isolation meets the total score or not
    //also uses text from const seciton as meets or nomeets to change the text
    if (selIsoScore > totalScore) {
        document.getElementById("outImg").src = "imgs/caution.png";
        document.getElementById("isoOutcome").innerHTML = meets;
        document.getElementById("isoOutcome").style.color = "black";
    }
    else {
        document.getElementById("outImg").src = "imgs/stop.png";
        document.getElementById("isoOutcome").innerHTML = notMeets;
        document.getElementById("isoOutcome").style.color = "red";
    }


    //Enters data onto the output form.
    document.getElementById('outTitle').innerHTML = isoTitle;
    document.getElementById('outPipe').innerHTML = pipeSize;
    document.getElementById('outBar').innerHTML = pressure;
    //document.getElementById('outNum').innerHTML = numOfLines;
    // document.getElementById('outBound').innerHTML = boundary.checked;
    document.getElementById('outLineDesc').innerHTML = lineDesc;
    document.getElementById('outCard').style.display = "block";
    document.getElementById('outCard').scrollIntoView();
    document.getElementById('printBtn').style.display = "block"; //makes the print button visible

    //This section will determine what goes in the output controls depending on the following
    //is it SBT is it it non invasive if what is the pressure is it flamable

    if (purpose == 'sbt') {
        console.log("Small bore tubing controls");
        console.log(purpose);
        document.getElementById('outPur').innerHTML = "Small Bore Tubing 1/2 inch or less.";
        document.getElementById('listControl1').innerHTML = sbtControl1;
        document.getElementById('listControl2').innerHTML = sbtControl2;
        document.getElementById('listControl3').innerHTML = sbtControl3;
        document.getElementById('listControl4').innerHTML = sbtControl4;
        document.getElementById('listControl5').innerHTML = sbtControl5;
        document.getElementById('listControl6').innerHTML = sbtControl6;
    } else if (purpose == 'motion') {
        console.log("Non invasive controls");
        document.getElementById('outPur').innerHTML = "To prevent motion in equipment for non-invasive work";
        document.getElementById('listControl1').innerHTML = nonInvasiveControl1;
        document.getElementById('listControl2').innerHTML = nonInvasiveControl2;
        document.getElementById('listControl3').innerHTML = nonInvasiveControl3;
        document.getElementById('listControl4').innerHTML = "";
        document.getElementById('listControl5').innerHTML = "";
        document.getElementById('listControl6').innerHTML = "";


    } else {
        console.log("breaking of containment controls");
        document.getElementById('outPur').innerHTML = "Breaking of Containment";
        if (substance == 'flammable') {
            if (pressure >= 10) {
                document.getElementById('listControl1').innerHTML = control1;
                document.getElementById('listControl2').innerHTML = control2;
                document.getElementById('listControl3').innerHTML = control3;
                document.getElementById('listControl4').innerHTML = control4;
                document.getElementById('listControl5').innerHTML = control5;
                document.getElementById('listControl6').innerHTML = "";
            } else {
                document.getElementById('listControl1').innerHTML = control1;
                document.getElementById('listControl2').innerHTML = control2;
                document.getElementById('listControl3').innerHTML = control3;
                document.getElementById('listControl4').innerHTML = "";
                document.getElementById('listControl5').innerHTML = "";
                document.getElementById('listControl6').innerHTML = "";
            };
        } else {
            if (pressure >= 10) {
                document.getElementById('listControl1').innerHTML = control1;
                document.getElementById('listControl2').innerHTML = control2;
                document.getElementById('listControl3').innerHTML = control4;
                document.getElementById('listControl4').innerHTML = "";
                document.getElementById('listControl5').innerHTML = "";
                document.getElementById('listControl6').innerHTML = "";
            } else {
                document.getElementById('listControl1').innerHTML = control1;
                document.getElementById('listControl2').innerHTML = control2;
                document.getElementById('listControl3').innerHTML = "";
                document.getElementById('listControl4').innerHTML = "";
                document.getElementById('listControl5').innerHTML = "";
                document.getElementById('listControl6').innerHTML = "";

            };
        };


    };


    // THis section will copy over the preparation of worksite requirements
    document.getElementById('prepControl1').innerHTML = prepControl1;
    document.getElementById('prepControl2').innerHTML = prepControl2;   
    document.getElementById('prepControl3').innerHTML = prepControl3;
    document.getElementById('prepControl4').innerHTML = prepControl4;
    
    if (substance =='nonHaz'){//Removes the last two if it is non hazardous
        document.getElementById('prepControl3').innerHTML ="";
        document.getElementById('prepControl4').innerHTML ="";
    }


    //This section will use the total score to determine the min standard
    if (totalScore >= 450) {
        //score for sapde
        document.getElementById("outIsoImg").src = "imgs/spade.png";
        document.getElementById('outIsoText').innerHTML = "Positve isolation - Spade or disconnection";
    } else if (totalScore >= 89) {
        //secore for DBB
        document.getElementById("outIsoImg").src = "imgs/dbb.png";
        document.getElementById('outIsoText').innerHTML = "Proven isolation - Double Block and Bleed (DBB) or double seal valve with body bleed.";
    } else if (totalScore >= 29) {
        //score for SBB
        document.getElementById("outIsoImg").src = "imgs/sbb.png";
        document.getElementById('outIsoText').innerHTML = "Proven isolation - Leak tight Single Block and Bleed (SBB).";
    } else {
        //score for non proven single
        document.getElementById("outIsoImg").src = "imgs/single.png";
        document.getElementById('outIsoText').innerHTML = "Non-proven isolation - Single or double valve - Double valve should be used rather than single, if available.";
    };

    //for testing only ----     document.getElementById('totalScore').innerHTML = totalScore;


    //Hides the input section once the calc is done
    document.getElementById('inputSection').style.display =  "none";
    document.getElementById('backBtn').style.display =  "block";
    document.getElementById('calcBtn').style.display = "none";

}//end of function



//Action to take when one of the icons is pressed
$(".image-radio img").click(function () {
    $(this).prev().attr('checked', true);
})


//Action to take when the next button is pushed
function showSpec() {
    document.getElementById('lineSpecificationDiv').style.display = "block";
    document.getElementById('calcBtn').style.display = "block";
    document.getElementById('nextBtn').style.visibility = 'hidden';
}


//Action to take when the save as PDF button is pressed
function printPDF() {
    var element = document.getElementById("outCard");
    html2pdf(element, {
        margin: 10,
        filename: "IST_Outcome.pdf",
        image:        { type: 'jpeg', quality: 0.95 },
        html2canvas:  { scale: 2},
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape'  }
    });
    alert("Outcome is being saved to download folder");
}


function goBack(){
    document.getElementById('inputSection').style.display =  "block";
    document.getElementById('outCard').style.display =  "none";
    document.getElementById('backBtn').style.display =  "none";
    document.getElementById('calcBtn').style.display = "block";
    document.getElementById('printBtn').style.display = "none";
}