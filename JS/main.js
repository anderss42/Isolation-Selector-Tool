
//* Long text gets declared here so that it can be changed easily. 
//*Statement used on output card depending on if it meets the standard or not
const meets = "The isolation selected meets the minimum standards required and can be used.";
const notMeets = "The isolation selected does not meet the minimum standard required. A Level 2 risk assessment MUST be carried out if this is to be used.";

//* Controls required for breaking of containment, different selection of these will be used depending on pressure and substance
const control1 = "Pressure build-up test to ensure valve integrity.";
const control2 = "Regular monitoring of the isolation integrity.";
const control3 = "Continuous gas monitoring to be present when breaching.";
const control4 = "Contingency plan to be detailed in the ICC or TBT (for personal isolations) in case of isolation failure.";
const control5 = "Radio link to control room when containment is being broken.";
const control6 = "";

//* Small bore tubing
const sbtControl1 = "Where available double block valves should be used on impulse lines.";
const sbtControl2 = "Pressure build-up test to ensure valve integrity.";
const sbtControl3 = "Regular monitoring of the isolation integrity.";
const sbtControl4 = "Radio link to control room when containment is being broken.";
const sbtControl5 = "Contingency plan to be detailed on ICC or TBT (for personal isolations) in case of isolation failure.";
const sbtControl6 = "Continuous gas monitoring to be present when breaching hydrocarbon systems.";

//* Non-invasive
const nonInvasiveControl1 = "Regular monitoring of the isolation integrity.";
const nonInvasiveControl2 = "Contingency plan to be detailed on ICC or TBT (for personal isolations) in case of isolation failure.";

//* CSE
const CSEControl1 = "Complete separation of the plant / equipment to be worked on from other parts of the system. ";
const CSEControl2 = "Controls required as per TUK-17-C-004 section 8";
const CSEControl3 = "";
const CSEControl4 = "";
const CSEControl5 = "";
const CSEControl6 = "";


//* Preparation of equipment controls
const prepControl1 = "Depressurised to nominal zero";
const prepControl2 = "Drain vessels and pipework";
const prepControl3 = "Water flush vessels and pipework"; //boc flam or toxic only
const prepControl4 = "Nitrogen Purge vessels and pipework"; //boc flam or toxic only

var infoReq = true;  //Global variable used for tracking if some of the inputs are required depending on purpose

//let lineNo = 1;  // Not used at present was going to bve used to have more than one line spec on each outcome

//document.ready(function () { $('[data-toggle="tooltip"]').tooltip() });



//*These functions are used to hide the inputs that are not required 
function hideStuff(src) {
    //alert(src.value);
    document.getElementById('subHide').style.display = "none";
    document.getElementById('durHide').style.display = "none";
    document.getElementById('boundHide').style.display = "none";
    document.getElementById('lineHide').style.display = "none";
    document.getElementById('pipeHide').style.display = "none";
    document.getElementById('pressHide').style.display = "none";
    infoReq = false;

}

function showStuff(src) {
    //alert(src.value);
    document.getElementById('subHide').style.display = "block";
    document.getElementById('durHide').style.display = "block";
    document.getElementById('boundHide').style.display = "block";
    infoReq = true;



}

//* This function is called when the next button is pushed once the system parameters are entered. It will firstly check that the required info has been entered or it will exit the function
function showSpec() {




    var isoTitle = document.forms["systemProperties"]["isoTitle"].value;
    var boundary = document.getElementById("boundary");

    if (isoTitle == "") {
        document.getElementById('isoTitle').style.borderColor = "red";
        alert("Please enter a tittle for the isolation");
        return false;
    }
    else {
        document.getElementById('isoTitle').style.borderColor = "black";
    }
    var purpose = document.forms["systemProperties"]["purpose"].value;
    if (purpose == "") {
        alert("Please select the purpose of the isolation");
        return false;
    }

    if (infoReq) {
        var substance = document.forms["systemProperties"]["substance"].value;
        if (substance == "") {
            alert("Please select the substance");
            return false;
        }
        var period = document.forms["systemProperties"]["period"].value;
        if (period == "") {
            alert("Please select how long containment will be broken for");
            return false;
        }
    }
    //lineNo = 1;
    //document.getElementById('specNo').innerHTML = "Line Specification No. " + lineNo;

    // This section will make the line spec appear and hide the next button and display the calc button
    document.getElementById('lineSpecificationDiv').style.display = "block";
    document.getElementById('calcBtn').style.display = "block";
    document.getElementById('nextBtn').style.visibility = 'hidden';

    // Sets the pipesize automatically if SBT is selected
    var purpose = document.forms["systemProperties"]["purpose"].value;
    if (purpose == 'sbt') {
        document.getElementById('pipeSizeNum').value = 0.5;
    }
    // sets the pressure to zero if the boundary check box is selected
    if (boundary.checked == true) {
        document.getElementById('pressure').value = 0;
    }
}

//* This function is called when the calculate button is pressed.
function getInputData() {
    // Resets the variables to zero
    let releaseH = 0;
    let releaseV = 0;
    let releaseScore = 0;
    let substanceScore = 0;
    let timeScore = 0;
    let totalScore = 0;
    let selIsoScore = 0;

    // 3 arrays which are then used to provide a number from 1 to 10 depending on the user inputs. 
    const releaseMatrix = [
        ['size/pressure', '>150bar', '>100bar', '>50bar', '>20bar', '>10bar', '<10bar'],
        ['>24', 10, 10, 10, 9, 7, 6],
        ['>=12', 10, 10, 9, 7, 6, 6],
        ['>=6', 10, 9, 6, 6, 6, 6],
        ['>=1', 10, 6, 6, 3, 2, 1],
        ['<1', 10, 4, 3, 3, 1, 1],
    ];

    const effectMatrix = [
        ['Flammable', 10],
        ['Hazadous', 3],
        ['Non-Hazardour', 1],
    ];

    const timeMatrix = [
        ['Freq', 'Less than a shift', 'More than one, less than 7', 'More than 7'],
        ['Daily', 10, 10, 'N/A'],
        ['Weekly', 4, 7, 'N/A'],
        ['Monthly or Less', 3, 7, 10],
    ];


    // Gets the data from the Forms
    var isoTitle = document.forms["systemProperties"]["isoTitle"].value;
    var pipeSize = document.forms["spec"]["pipeSizeNum"].value;
    var pressure = document.forms["spec"]["pressure"].value;
    var lineDesc = document.forms["spec"]["lineDesc"].value;
    var selIso = document.forms["spec"]["isoTypeSelected"].value;
    var substance = document.forms["systemProperties"]["substance"].value;
    var period = document.forms["systemProperties"]["period"].value;
    var purpose = document.forms["systemProperties"]["purpose"].value;
    var boundary = document.getElementById("boundary");


    // section checks if the required information has been entered. If not you will get an error message
    if (infoReq) { //if motion or CSE are defined then there is no need to enter this information
        if (lineDesc == "") {
            alert("Please enter a descripion of the line");
            document.getElementById('lineDesc').style.borderColor = "red";
            return false;
        } else {
            document.getElementById('lineDesc').style.borderColor = "black";
        }

        if (pipeSize == "") {
            alert("Please enter the size of the pipe");
            return false;
        }

        if (pressure == "") {
            alert("Please enter the expected pressure");
            return false;
        }

        if (selIso == "") {
            alert("Please select the highest level of isolation that can be practicable be applied");
            return;
        }

    } else {
        // if info is not required the following will be set to N/A
        pipeSize = "N/A";
        pressure = "N/A";
        lineDesc = "N/A";
        period = "N/A";
        substance = "N/A";
    }

    //This section will take the pressure and pipesize and then give an array address to give a score outcome
    if (pressure >= 150) { releaseH = 1; }
    else if (pressure >= 100) { releaseH = 2; }
    else if (pressure >= 50) { releaseH = 3; }
    else if (pressure >= 20) { releaseH = 4; }
    else if (pressure >= 10) { releaseH = 5; }
    else releaseH = 6;

    if (pipeSize >= 24) { releaseV = 1 }
    else if (pipeSize >= 12) { releaseV = 2 }
    else if (pipeSize >= 6) { releaseV = 3 }
    else if (pipeSize > 1) { releaseV = 4 }
    else releaseV = 5;
    releaseScore = (releaseMatrix[releaseV][releaseH]);

    //This section will take the substance and then give an array address to give a score outcome
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

        document.getElementById('outSub').innerHTML = "Non-Hazardous Substances";
    }

    //This section will take the duration of BoC and then give an array address to give a score outcome
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

    // If CSE or Motion then the substance and duration do not matter
    if (!(infoReq)) {
        document.getElementById('outSub').innerHTML = "N/A";
        document.getElementById('outDur').innerHTML = "N/A";
    }

    // total score will multiply the 3 scores from the arrays and then proveide a total risk factor which will be between 1 and 1000
    totalScore = (substanceScore * releaseScore * timeScore);


    //this section will overide the calculated score if the job is SBT, Motion or CSE
    if (purpose == 'sbt') { totalScore = 80 };//nominal value that will give it a score for proven single
    if (purpose == 'cse') { totalScore = 900 };//nominal value that will give it a score for spade
    if (purpose == 'motion') { totalScore = 80 }; //nominal value that will give it a score for proven single

    //This section is used to firstly give a score to the selected isolation, it will then change the picture and text on the output form. 
    if (selIso === 'spade') {
        selIsoScore = 1000;
        document.getElementById('outIsoSel').innerHTML = "Positve isolation - Spade or disconnection";
        document.getElementById('outSelIsoImg').src = "imgs/spade.png";
        document.getElementById('outIsoSelText').innerHTML = "Positve isolation - Spade or disconnection";
    }
    else if (selIso === 'dbb') {
        selIsoScore = 450;
        document.getElementById('outIsoSel').innerHTML = "Proven isolation - Double Block and Bleed (DBB) or double seal valve with body bleed.";
        document.getElementById('outSelIsoImg').src = "imgs/dbb.png";
        document.getElementById('outIsoSelText').innerHTML = "Proven isolation - Double Block and Bleed (DBB) or double seal valve with body bleed.";
    }
    else if (selIso === 'sbb') {
        selIsoScore = 89;
        document.getElementById('outIsoSel').innerHTML = "Proven isolation - Leak tight Single Block and Bleed (SBB).";
        document.getElementById('outSelIsoImg').src = "imgs/sbb.png";
        document.getElementById('outIsoSelText').innerHTML = "Proven isolation - Leak tight Single Block and Bleed (SBB).";
    }
    else {
        selIsoScore = 29;
        document.getElementById('outIsoSel').innerHTML = "Non-proven isolation - Single or double valve - Double valve should be used rather than single, if available.";
        document.getElementById('outSelIsoImg').src = "imgs/single.png";
        document.getElementById('outIsoSelText').innerHTML = "Non-proven isolation - Single or double valve - Double valve should be used rather than single, if available.";
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
        document.getElementById("isoOutcome").style.fontSize = "24px";
    }

    if (boundary.checked == true) {
        document.getElementById('outBound').innerHTML = 'Yes';

    } else {
        document.getElementById('outBound').innerHTML = 'No';
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

    //Enters data onto the output form.
    document.getElementById('outTitle').innerHTML = isoTitle;
    document.getElementById('outPipe').innerHTML = (pipeSize + ' inches');
    document.getElementById('outBar').innerHTML = (pressure + ' bar');
    //document.getElementById('outNum').innerHTML = numOfLines;
    document.getElementById('outLineDesc').innerHTML = lineDesc;
    document.getElementById('outCard').style.display = "block";
    document.getElementById('backBtn').scrollIntoView();

    document.getElementById('printBtn').style.display = "block"; //makes the print button visible

    //This section will determine what goes in the output controls depending on the following
    //is it SBT is it it non invasive if what is the pressure is it flamable
    if (purpose == 'sbt') {
        console.log("Small bore tubing controls");
        document.getElementById('outPur').innerHTML = "Small Bore Tubing 1/2 inch or less.";
        document.getElementById('listControl1').innerHTML = sbtControl1;
        document.getElementById('listControl2').innerHTML = sbtControl2;
        document.getElementById('listControl3').innerHTML = sbtControl3;
        document.getElementById('listControl4').innerHTML = sbtControl4;
        document.getElementById('listControl5').innerHTML = sbtControl5;
        document.getElementById('listControl6').innerHTML = sbtControl6;
    } else if (purpose == 'motion') {
        document.getElementById('outPur').innerHTML = "To prevent motion in equipment for non-invasive work";
        document.getElementById('listControl1').innerHTML = nonInvasiveControl1;
        document.getElementById('listControl2').innerHTML = nonInvasiveControl2;
        document.getElementById('listControl3').innerHTML = nonInvasiveControl3;
        document.getElementById('listControl4').innerHTML = "";
        document.getElementById('listControl5').innerHTML = "";
        document.getElementById('listControl6').innerHTML = "";
    } else if (purpose == 'cse') {
        document.getElementById('outPur').innerHTML = "For confined space entry";
        document.getElementById('listControl1').innerHTML = CSEControl1;
        document.getElementById('listControl2').innerHTML = CSEControl2;
        document.getElementById('listControl3').innerHTML = CSEControl3;
        document.getElementById('listControl4').innerHTML = CSEControl4;
        document.getElementById('listControl5').innerHTML = CSEControl5;
        document.getElementById('listControl6').innerHTML = CSEControl6;
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
                document.getElementById('listControl6').innerHTML = control6;
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
            // This is a bit of a bodge that removes the control for non proven isolations to have a PBU done
            if (selIsoScore < 30) {
                document.getElementById('listControl1').innerHTML = "";
            }
        };
    };


    // THis section will copy over the preparation of worksite requirements
    document.getElementById('prepControl1').innerHTML = prepControl1;
    document.getElementById('prepControl2').innerHTML = prepControl2;
    document.getElementById('prepControl3').innerHTML = prepControl3;
    document.getElementById('prepControl4').innerHTML = prepControl4;

    if (substance == 'nonHaz') {//Removes the last two if it is non hazardous
        document.getElementById('prepControl3').innerHTML = "";
        document.getElementById('prepControl4').innerHTML = "";
    }

    // Used for testing comment out when putting into service, gives and alert when the calc button is pressed which will show the scores
    //var alertMess = 
    //"Duration score is- " + timeScore + ".\n" + 
    //"Substance score is- " + substanceScore + ".\n" +
    //"Release score is- " + releaseScore + ".\n" + 
    //"Total score is- " + totalScore + " .";
    //alert(alertMess);

    //Hides the input section once the calc is done
    document.getElementById('inputSection').style.display = "none";
    document.getElementById('header').style.display = "none";
    document.getElementById('backBtn').style.display = "block";
    document.getElementById('calcBtn').style.display = "none";



}//end of function



//Action to take when one of the icons is pressed
$(".image-radio img").click(function () {
    $(this).prev().attr('checked', true);
})

//Action to take when the save as PDF button is pressed
function printPDF() {

    let ICCno = document.getElementById('iccNo').value
    if (ICCno === "") {
        ICCno = "IST_Outcome.pdf"
    }
    else {
        ICCno = "ICC " + ICCno + " IST_Outcome.pdf"
    }

let textA;
let person = prompt("Please confirm that you have read the outcome and comply with the controls stipulated.\n" +
    "Please enter your name to confirm", "");
if (person == null || person == "") {
    textA = "";
    return false;
} else {
    textA = person + " Confirmed isolation controls";
}
const date = new Date();
document.getElementById('preparedBy').innerHTML = "Isolation Selector outcome prepared by: " + person + " " + date;


var element = document.getElementById("outCard");
html2pdf(element, {
    margin: 10,
    filename: ICCno,
    image: { type: 'jpeg', quality: 0.95 },
    html2canvas: { scale: 2, width: 850, },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
});

}
//When the back button is pressed the output form will be hidden and the input forms will be displayed again. 
function goBack() {
    document.getElementById('inputSection').style.display = "flex";
    document.getElementById('outCard').style.display = "none";
    document.getElementById('backBtn').style.display = "none";
    document.getElementById('calcBtn').style.display = "flex";
    document.getElementById('printBtn').style.display = "none";
    document.getElementById('header').style.display = "block";
}


function nextLine() {
    // if the lineNo is equal to max no then do nothing
    let numOfLines = document.forms["systemProperties"]["numOfLines"].value;
    if (lineNo != numOfLines) {
        lineNo = lineNo + 1;
        document.getElementById('specNo').innerHTML = "Line Specification No. " + lineNo;
    }
}

function backLine() {

    if (lineNo > 1) {
        lineNo = lineNo - 1;
        document.getElementById('specNo').innerHTML = "Line Specification No. " + lineNo;
    }
}

function popitup(url) {
    newwindow = window.open(url, 'name', 'height=900,width=800');
    if (window.focus) { newwindow.focus() }
    return false;
}

