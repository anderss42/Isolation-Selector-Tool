# Isolation Selector Tool (IST)

A client-side web tool used at **TAQA** to determine the correct isolation standard before carrying out maintenance work on pipework and equipment. Outputs a minimum isolation **category** recommendation and a downloadable PDF record.

## Project structure

```
index.html          — main application (single page, all UI)
help.html           — help guide, opens in a popup window
JS/main.js          — all application logic (no framework, vanilla JS)
CSS/stlyes.css      — stylesheet (note: filename has a typo — do not rename, both HTML files reference it)
imgs/               — P&ID-style PNG diagrams used for isolation type selection and output
```

## How the tool works

The tool follows the **HSG253-aligned decision tree**. It no longer uses a multiplicative risk score.

The user fills in two forms in sequence:

1. **System Properties** (`systemProperties` form) — isolation title, the two front-end planning checks (Yes/No), fluid (dropdown → inferred Fluid Group), operating temperature, duration, then six Yes/No questions revealed one at a time (progressive disclosure), optional ICC number
2. **Line Specification** (`spec` form) — line/point description, highest isolation type available (valve options only — spade is never selectable here)

**Progressive disclosure** has two layers:
- `updateProgress()` reveals the form in steps — title first, then the planning checks, then `#restBlock` once both checks are answered **No**.
- Within `#restBlock`, the six Yes/No questions are revealed **one at a time** as each is answered (`QUESTION_CHAIN` in `init()`). Each newly revealed question is smoothly scrolled into view. The ICC field (`#iccBlock`) and **Next** button only appear after all six are answered.

**Question layout** — both the two front-end planning checks and the six progressive questions are rendered as `<table class="q-table">` elements. Each question is a `<tr>` row; Yes and No radios each occupy a fixed-width `<td class="q-radio-cell">`. Because the question containers are `<tr>` elements (not `<div>`s), the `QUESTION_CHAIN` change handler sets `style.display = 'table-row'` (not `'block'`) when revealing the next question, and `iccBlock` (a `<div>`) still uses `'block'`. The handler uses `next.tagName === 'TR' ? 'table-row' : 'block'` to distinguish.

The six Yes/No questions (in order of appearance):
1. **positiveIsoRisk** — Is the risk from installation/removal of positive isolation greater than using valve isolation?
2. **hotWork** — Hot work involved?
3. **cse** — Confined space entry?
4. **flareVentDrains** — Flare, LP vent or closed drains?
5. **sbt** — Instrument small-bore tubing (SBT) personal isolation?
6. **boundary** — Within a boundary isolation?

On **Next**, `showSpec()`:
- Short-circuits to a **shutdown record** if either planning check is Yes.
- If `positiveIsoRisk === 'no'`: hides the isolation type picker (`#isoTypeSection`), shows `#posIsoNotice`, and auto-checks the spade radio — the user only needs to enter a line description. Stage 2 proceeds to Calculate with spade forced.
- If `positiveIsoRisk === 'yes'`: shows the isolation type picker but keeps `#spadeOption` hidden — only the four valve options are available.

On **Calculate**, `getInputData()`:
- Resolves the **Fluid Group** (1–4) from the selected fluid, escalated by operating temperature via `finalGroup()`.
- Derives the **minimum required category** via `getRequiredCategory()` — now returns `{ cat, driver }` where `driver` is the ID of the output table cell that caused the required category. The driver cell is highlighted **red and bold** in the output table.
- Precedence: `positiveIsoRisk=no` → I, CSE → I, boundary → III, flare/vent/drains → III, SBT → IIB/III, otherwise group × duration table (hot work escalates Groups 1&2 only).
- Compares the selected isolation's category against the required one using `CATEGORY_RANK`. If it does not meet, shows the Level 2 / deviation message plus approvers from `getAuthorisers()`.

## Isolation categories (in order of strength)
| Category | Label | Selection value | Rank |
|----------|-------|-----------------|------|
| I | Positive isolation — spade or disconnection | `spade` | 4 |
| IIA | Proven Double Block and Bleed (DBB) | `dbb` | 3 |
| IIA | Proven Twin Seal Valve | `twin_seal` | 3 |
| IIB | Proven Single Block and Bleed (SBB) | `sbb` | 2 |
| III | Non-proven single or double valve | `single` | 1 |

**Two separate lookup tables** exist for category display:
- `CATEGORY_INFO` — used for the **minimum required** side of the output (keyed by category string: I / IIA / IIB / III)
- `ISO_INFO` — used for the **isolation selected** side of the output (keyed by selection value: spade / dbb / twin_seal / sbb / single). Twin Seal Valve has its own image (`imgs/twin_seal.png`) and label here even though it maps to category IIA.

All isolation images are P&ID-style pipeline diagrams (LIVE SYSTEM → valves/spade → ISOLATED SYSTEM). The spade image is `imgs/spade.png`. Stage 2 picker images are sized via CSS (`#isoTypeSection input[type=radio] + label > img`) at 320×120px with `object-fit:contain`. Output card images use `height:120px; width:auto`.

## Fluid groups
Defined in the `FLUIDS` array (name → base group) plus `GROUP_NAMES`. The dropdown is populated by JS, grouped by Fluid Group, with an "Other" option that reveals a manual name + group selector. Temperature thresholds live in `tempGroup()`.

## Validation / error highlighting

Both `showSpec()` (Next) and `getInputData()` (Calculate) validate **all fields before returning** — they do not early-return on the first missing field. Every missing or invalid field is highlighted simultaneously:

- **Text inputs and selects** — `style.borderColor = 'red'` applied; cleared to `''` via `input`/`change` listeners when the user corrects the field.
- **Unanswered question rows** — `.q-error` CSS class added to the `<tr>`; gives a light-red background and red left border. Cleared immediately when the radio is answered (via `radio.closest('tr')?.classList.remove('q-error')` in the change handler).
- **Isolation type picker** (Stage 2, when no option selected) — `.section-error` CSS class added to `#isoTypeSection`; gives a red border around the whole section. Cleared when any isolation radio is selected.

A single summary alert is shown after all highlights are applied. The shutdown short-circuit path (`majorAccident`/`waitShutdown` = yes) only requires the title to be filled; fluid/temp/duration are not checked in that path.

## Form field layout

The three data-entry fields in `#restBlock` (fluid, operating temperature, duration) use `d-flex align-items-center gap-2 flex-wrap` so the label and control sit on the same line. The `otherFluidWrap` (shown when "Other" is selected) sits in its own block below the flex row. The operating temperature uses a Bootstrap `input-group` (label → `?` button → input + °C addon) at a fixed `width: 150px`. The duration and fluid selects use Bootstrap `form-select` with a `max-width` set inline.

## Modals

Validation messages and the PDF name confirmation use **Bootstrap modals**, not browser `alert()`/`prompt()`. `showAlert(message)` drives `#alertModal`; `showNamePrompt(message)` drives `#nameModal` and returns a Promise resolving to the entered name (or `null` if cancelled).

## Contextual help popovers

Eight fields carry a small blue `?` button (`.help-tip`) that opens a Bootstrap popover on hover/focus. The buttons carry only a `data-help-key` attribute; all title and content strings live in the `HELP_CONTENT` map in `JS/main.js`. Popovers are initialised inside a `DOMContentLoaded` listener (not directly in `init()`) because `main.js` is deferred before the Bootstrap bundle — calling `new bootstrap.Popover()` directly in `init()` would run before Bootstrap is defined.

Fields with popovers: **operating temperature** (`temp`), **duration** (`duration`), **positiveIsoRisk** (`posIsoRisk`, HTML content), **hotWork** (`hotWork`), **cse** (`cse`), **flareVentDrains** (`flareVentDrains`), **sbt** (`sbt`), **boundary** (`boundary`).

To add a new popover: add an entry to `HELP_CONTENT` and add `<button type="button" class="help-tip" data-help-key="yourKey">?</button>` inline in the relevant label or table cell.

## Key known issues / gotchas

- **CSS filename typo**: the stylesheet is `CSS/stlyes.css` (not `styles`). Both `index.html` and `help.html` reference this name — do not correct it without updating both files simultaneously.
- `help.html` loads `JS/main.js` unnecessarily; `init()` early-returns when `#fluidSelect` is absent, so it is harmless there.
- The multi-line feature (`numOfLines`, `nextLine()`, `backLine()`) was removed/commented out — don't revive it without understanding the full intended flow.
- `index.html` loads the Bootstrap **bundle** once (the modals depend on it). `help.html` still loads Bootstrap twice — the duplicate can cause conflicts there.
- The old multiplicative-score model has been removed.
- **`#spadeOption`** is always hidden in Stage 2 (`showSpec()` sets `display:none` unconditionally). The spade radio is only ever selected programmatically (when `positiveIsoRisk === 'no'`), never by the user.
- **Playwright tests** in `tests/` reference the old checkbox IDs and `fillStage1` — these need updating to use the new radio names (`name="hotWork"` etc.), the `positiveIsoRisk` question, and the new table-row question structure.

## No build step

Open `index.html` directly in a browser. There is no package manager, bundler, or local server required.

## PDF export

`printPDF()` uses **html2canvas + jsPDF** directly. It asks for a name via the `#nameModal` modal, appends a confirmation line to the output card, then renders `#outCard` to canvas and places it on A4 portrait pages at **full content width**. The filename is `IST_Outcome.pdf` or `ICC <number> IST_Outcome.pdf` if an ICC number was entered.

## Tests

Playwright suite in `tests/` (run `npx playwright test`; config in `playwright.config.js` serves the folder on port 3000). **Note: tests are currently out of date** — they need updating for the radio-button questions, `positiveIsoRisk` logic, Twin Seal Valve option, and the skip-to-results flow when `positiveIsoRisk === 'no'`.

## Reference documents

- `Isolation seclector tool flow chart.pdf` — logic flow diagram for the scoring algorithm
- `TUK-17-C-004_001 - Copy.pdf` — TAQA procedure document referenced in CSE controls
- `Text used in isolation selector tool.docx` — source text for UI labels and control strings
