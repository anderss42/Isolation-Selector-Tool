# Isolation Selector Tool (IST)

A client-side web tool used at **TAQA** to determine the correct isolation standard before carrying out maintenance work on pipework and equipment. Outputs a minimum isolation **category** recommendation and a downloadable PDF record.

## Project structure

```
index.html          — main application (single page, all UI)
help.html           — help guide, opens in a popup window
JS/main.js          — all application logic (no framework, vanilla JS)
CSS/stlyes.css      — stylesheet (note: filename has a typo — do not rename, both HTML files reference it)
imgs/               — icon images used for radio button selections and output
```

## How the tool works

The tool follows the **HSG253-aligned decision tree** (see `HSE-CHANGE-REQUIREMENTS.md` for the full requirements and rationale). It no longer uses a multiplicative risk score.

The user fills in two forms in sequence:

1. **System Properties** (`systemProperties` form) — isolation title, the two front-end planning checks (Yes/No), fluid (dropdown → inferred Fluid Group), operating temperature, duration, hot work / CSE / exemption / boundary switches, optional ICC number
2. **Line Specification** (`spec` form) — line/point description, highest isolation type available

**Progressive disclosure:** `updateProgress()` reveals the form in steps — title first, then the planning checks once a title is entered, then the rest (`#restBlock`) once both checks are answered **No**. The **Next** button (`#nextBtn`) is hidden until it is usable. Bound to the title `input` event and the planning-check `change` events.

On **Next**, front-end gating (`showSpec()`) short-circuits to a **shutdown record** if a failure could cause a major accident event, or if it is reasonably practicable to wait for a shutdown (the two `majorAccident` / `waitShutdown` radio groups).

On **Calculate**, `getInputData()` in [JS/main.js](JS/main.js):
- Resolves the **Fluid Group** (1–4) from the selected fluid, then escalates it by **operating temperature** via `finalGroup()` (more onerous of base group and `tempGroup()`).
- Derives the **minimum required category** via `getRequiredCategory()` with precedence: CSE → I, boundary → III, flare/vent/drains → III, SBT → IIB (Groups 1&2) / III (Groups 3&4), otherwise the group × duration table (hot work escalates Groups 1&2 only).
- Compares the selected isolation's category against the required one using `CATEGORY_RANK`. If it does not meet, it shows the Level 2 / deviation message plus the approvers from `getAuthorisers()` (slide 17). There is **no location input** — both the offshore and onshore approver are shown; no OIM is required for non-hazardous Group 4.

## Isolation categories (in order of strength)
| Category | Label | Maps to ID / image | Rank |
|----------|-------|--------------------|------|
| I | Positive isolation — spade or disconnection | `spade` | 4 |
| IIA | Proven Double Block and Bleed (DBB) | `dbb` | 3 |
| IIB | Proven leak-tight Single Block and Bleed (SBB) | `sbb` | 2 |
| III | Non-proven single or double valve | `single` | 1 |

The four isolation images (`spade/dbb/sbb/single.png`) are reused to represent categories I/IIA/IIB/III.

## Fluid groups
Defined in the `FLUIDS` array (name → base group) plus `GROUP_NAMES`. The dropdown is populated by JS, grouped by Fluid Group, with an "Other" option that reveals a manual name + group selector. Temperature thresholds (slide 9) live in `tempGroup()`.

## Modals

Validation messages and the PDF name confirmation use **Bootstrap modals**, not browser `alert()`/`prompt()`. `showAlert(message)` drives `#alertModal`; `showNamePrompt(message)` drives `#nameModal` and returns a Promise resolving to the entered name (or `null` if cancelled). Both rely on the global `bootstrap` object, which is available by the time of user interaction even though `main.js` runs before the Bootstrap bundle.

## Key known issues / gotchas

- **CSS filename typo**: the stylesheet is `CSS/stlyes.css` (not `styles`). Both `index.html` and `help.html` reference this name — do not correct it without updating both files simultaneously.
- `help.html` loads `JS/main.js` unnecessarily; `init()` early-returns when `#fluidSelect` is absent, so it is harmless there.
- The multi-line feature (`numOfLines`, `nextLine()`, `backLine()`) was removed/commented out — don't revive it without understanding the full intended flow.
- `index.html` loads the Bootstrap **bundle** once (the modals depend on it). `help.html` still loads Bootstrap twice (bundle + `bootstrap.min.js` + popper) — the duplicate can cause conflicts there.
- The old multiplicative-score model (`releaseMatrix`, purpose overrides, `nonInvasiveControl3`, Motion purpose) has been removed.

## No build step

Open `index.html` directly in a browser. There is no package manager, bundler, or local server required.

## PDF export

`printPDF()` uses **html2canvas + jsPDF** directly. It asks for a name via the `#nameModal` modal, appends a confirmation line to the output card, then renders `#outCard` to canvas and places it on A4 portrait pages at **full content width**, flowing across multiple pages if the content is taller than one page (margins are masked white so slice overlap doesn't bleed in). The filename is `IST_Outcome.pdf` or `ICC <number> IST_Outcome.pdf` if an ICC number was entered.

## Tests

Playwright suite in `tests/` (run `npx playwright test`; config in `playwright.config.js` serves the folder on port 3000). `tests/helpers.js` holds an independent re-derivation of the decision model plus page-interaction helpers (`fillStage1` respects the progressive reveal). Specs cover the decision table, exemptions, temperature escalation, gating/shutdown, authorisation, navigation, and modal-based validation.

## Reference documents

- `Isolation seclector tool flow chart.pdf` — logic flow diagram for the scoring algorithm
- `TUK-17-C-004_001 - Copy.pdf` — TAQA procedure document referenced in CSE controls
- `Text used in isolation selector tool.docx` — source text for UI labels and control strings
