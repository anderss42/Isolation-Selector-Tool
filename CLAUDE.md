# Isolation Selector Tool (IST)

A client-side web tool used at **TAQA** to determine the correct isolation standard before carrying out maintenance work on pipework and equipment. Outputs a risk-scored recommendation and a downloadable PDF record.

## Project structure

```
index.html          — main application (single page, all UI)
help.html           — help guide, opens in a popup window
JS/main.js          — all application logic (no framework, vanilla JS)
CSS/stlyes.css      — stylesheet (note: filename has a typo — do not rename, both HTML files reference it)
imgs/               — icon images used for radio button selections and output
```

## How the tool works

The user fills in two forms in sequence:

1. **System Properties** (`systemProperties` form) — isolation title, purpose, substance type, duration, boundary flag, optional ICC number
2. **Line Specification** (`spec` form) — line description, pipe size (inches), max pressure (bar), highest isolation type available

On **Calculate**, `getInputData()` in [JS/main.js](JS/main.js) scores three risk factors using lookup matrices:
- `releaseMatrix` — pipe size × pressure → score 1–10
- `effectMatrix` — substance hazard → score 1–10
- `timeMatrix` — duration → score 3–10

`totalScore = releaseScore × substanceScore × timeScore` (range 1–1000). Specific purposes override the score:
- SBT → 80, Motion → 80, CSE → 900

The selected isolation type is assigned a fixed score (spade=1000, DBB=450, SBB=89, single=29). If `selIsoScore > totalScore` the isolation is acceptable; otherwise a Level 2 risk assessment is required.

## Isolation types (in order of strength)
| ID | Label | Score |
|----|-------|-------|
| `spade` | Positive isolation — spade or disconnection | 1000 |
| `dbb` | Proven double block and bleed (DBB) | 450 |
| `sbb` | Proven single block and bleed (SBB) | 89 |
| `single` | Unproven single or double valve | 29 |

## Key known issues / gotchas

- **CSS filename typo**: the stylesheet is `CSS/stlyes.css` (not `styles`). Both `index.html` and `help.html` reference this name — do not correct it without updating both files simultaneously.
- `help.html` loads `JS/main.js` unnecessarily; it doesn't use any of the JS logic.
- The `nonInvasiveControl3` variable is referenced in `getInputData()` (line ~366) but never declared — this will throw a ReferenceError if the Motion purpose path is exercised.
- The multi-line feature (`numOfLines`, `nextLine()`, `backLine()`) is commented out and incomplete — don't revive it without understanding the full intended flow.
- Bootstrap is loaded twice in both HTML files (once via `<script src>` and once via the bundle). The duplicate can cause conflicts.

## No build step

Open `index.html` directly in a browser. There is no package manager, bundler, or local server required.

## PDF export

`printPDF()` uses **html2pdf.js** (wrapping html2canvas + jsPDF). It prompts for a name, appends a confirmation line to the output card, then renders `#outCard` to an A4 portrait PDF. The filename is `IST_Outcome.pdf` or `ICC <number> IST_Outcome.pdf` if an ICC number was entered.

## Reference documents

- `Isolation seclector tool flow chart.pdf` — logic flow diagram for the scoring algorithm
- `TUK-17-C-004_001 - Copy.pdf` — TAQA procedure document referenced in CSE controls
- `Text used in isolation selector tool.docx` — source text for UI labels and control strings
