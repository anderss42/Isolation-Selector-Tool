# HSE Review — Required Changes to the Isolation Selector Tool

Source: TAQA presentation *"Safe Isolation and Reinstatement of Plant — Isolation Selection Tool Update"* (HSE review of the SIRP procedure against HSG253).
Status: **Requirements confirmed with stakeholders — ready to plan implementation. No code changes made yet.**

All open questions have been answered (see §8). Decisions are reflected throughout this document.

---

## 1. Why the tool is changing

The HSE review (slides 5–7) found the current tool deviates from HSG253 guidance:

- The fluid categories "Flammable or Toxic", "Hazardous Utility" and "Non-hazardous" are poorly defined.
- A proven single valve is currently allowed for hazardous substances in some circumstances (<6", <20 barg), contrary to HSG253 ¶120.
- A ">7 days" duration option is inappropriate — a positive isolation could be installed and removed in that timeframe (HSG253 ¶113/116 expects positive isolation for extended work).
- Line size criteria only break at 2" and 8" (12" and 24" are not real decision points).
- Pressure criteria only break at 10 and 50 barg (100 and 150 barg are not real decision points).

## 2. The fundamental change

The tool moves from a **multiplicative risk score** to a **simple decision tree**.

| | Current | New |
|---|---|---|
| Model | `releaseScore × substanceScore × timeScore` (1–1000) compared against a fixed score per isolation type | Fluid Group + duration (+ hot work / CSE) → minimum isolation **category** |
| Inputs that drive the result | Substance type, duration, pipe size, pressure, purpose | Fluid Group (1–4, inferred from fluid + operating temperature), ≤1 shift vs >1 shift, hot work (Groups 1 & 2), confined space entry, plus front-end risk/shutdown gating and exemption flags |
| Output | "Acceptable / Level 2 RA required" based on score comparison | Minimum isolation category (I, IIA, IIB, III); compare against the best available isolation |

**Removed entirely as decision inputs:**
- Line size (>8" criterion removed — pipe size no longer asked at all per new flowchart)
- Pressure (>50 barg criterion removed — pressure no longer asked at all per new flowchart)
- ">7 days" / "More than one week" duration option
- Motion purpose (removed — tool is focused on breaking of containment; see §5)

**New inputs being added:**
- **Operating temperature** of the medium — relevant to hazard and can bump a fluid up a group (e.g. a non-hazardous fluid >50 °C becomes Group 3). See §3.
- **Hot work** yes/no (Groups 1 & 2).
- **Front-end gating questions** (high-risk-event / reasonably practicable to shut down) — slide 14. See §4.
- **Exemption flags** (flare/vent/closed drains; instrument small-bore tubing) as yes/no questions. See §6.

## 3. New fluid groups (replaces "substance type") — slides 8–10

Substance selection changes from 3 options (Flammable or Toxic / Hazardous Utility / Non-hazardous) to **4 GHS-based Fluid Groups**:

| Fluid Group | Class | Temperature trigger | GHS hazard classes (category) | Examples |
|---|---|---|---|---|
| 1 | Highly Dangerous | >60 °C or < −10 °C | Flammable gases (1A, 1B); Flammable liquids (1); Acute toxicity (1, 2) | NGL, Natural Gas, Crude Oil |
| 2 | Dangerous | — | Flammable gases (2); Flammable liquids (2); Acute toxicity (3); Skin corrosion/irritation (1A, 1B, 1C); Serious eye damage (1) | Methanol, CRW85733, Proxel XL2, GT-7511, Corrtreat 15340, Biotreat 4632 |
| 3 | Hazardous | >50 °C–≤60 °C, or <0 °C–≥ −10 °C | Flammable liquids (3); Acute toxicity (4); Skin corrosion/irritation (2); Serious eye damage (2); Gases under pressure (compressed/liquefied); Aspiration toxicity (1) | Diesel, Aviation Fuel, MEG, R410A, Scaletreat 8019, Phasetreat 13647, CRW85689, RBW85165, HW 443 ND, Brayco Micronic SV/3, Foamtreat SOC313 |
| 4 | Non-hazardous | ≥0 °C and ≤50 °C | Not classified | Seawater, TEG |

Supporting reference (slide 10), GHS flammable-liquid categories: Cat 1 = flash <23 °C & IBP ≤35 °C; Cat 2 = flash <23 °C & IBP >35 °C; Cat 3 = flash ≥23 °C–≤60 °C; Cat 4 = flash >60 °C–≤93 °C.

**Selection UX (confirmed):** the user picks the fluid from a **dropdown of standard items** (e.g. crude, natural gas, methanol, diesel, MEG, seawater, TEG, plus the named chemicals on slide 9). The tool **infers the fluid group** from that selection. An **"Other"** option lets the user type a substance name and pick the group manually.

**Operating temperature (confirmed):** temperature is now captured and can **escalate the group**. The temperature triggers in the table above apply on top of the fluid's base group. Confirmed example: a **non-hazardous fluid (Group 4) running >50 °C escalates to Group 3**. The tool must therefore ask the operating temperature (or temperature band) and apply the slide-9 thresholds (Group 1: >60 °C or < −10 °C; Group 3: >50–≤60 °C or <0–≥ −10 °C). The final group used is the **more onerous** of the fluid's base group and the temperature-derived group.

## 4. New decision logic — slides 11–13 and 15 (new tool flowchart)

Isolation categories (replace the numeric scores):

| Category | Minimum isolation method | Maps to current ID |
|---|---|---|
| I | Positive isolation: spade | `spade` |
| IIA | Proven isolation: Double Block and Bleed (DBB) or double seal valve with body bleed | `dbb` |
| IIB | Proven isolation: leak-tight Single Block and Bleed (SBB) | `sbb` |
| III | Non-proven isolation: single or double valve (double preferred over single, if available) | `single` |

**Overall flow (combining slide 14 planning flowchart + slide 15 selector flowchart, per confirmed answers):**

1. **Front-end gating (slide 14, confirmed enhancement):**
   - **Could failure lead to a high-risk event?** → Yes → **defer to shutdown** (stop; isolation selection not appropriate).
   - **Reasonably practicable to shut down?** → Yes → shut down (stop).
   - Otherwise continue into the selector.
2. **Confined Space Entry?** → Yes → **Category I** (regardless of fluid group/duration). No → continue.
3. **Exemptions (yes/no, see §6)** — flare/vent/closed drains, or instrument small-bore tubing — short-circuit to their own outcome.
4. **Determine fluid group** (§3) and apply the table below.

| Fluid Group | ≤1 shift (and no hot work) | >1 shift **or hot work** |
|---|---|---|
| 1 & 2 | IIA | I |
| 3 | IIB | IIA |
| 4 | III | IIB |

Notes:
- The **hot work** escalation applies to Fluid Groups 1 and 2 only (slide 15 flowchart: "Hot Work or >1 shift"). For Groups 3 and 4 the only branch is ">1 shift". Hot work is a new yes/no input. **Definition (confirmed):** hot work encompasses both spark potential and naked flame, whether directly involved in the task or in the vicinity — no change from the previous SIRPs revision.
- Duration is now binary: ≤1 shift / >1 shift. The current `moreWeek` option must be removed; `upToWeek` becomes simply ">1 shift".

**Isolation selection & result evaluation (confirmed, Q9):**
- The user must always select the **best possible isolation** they can apply.
- Per the flowchart, **positive isolation is assessed first**; if positive isolation is not being used, the user then selects the best **available valved isolation**.
- The selected isolation is compared against the minimum required category (ranking I > IIA > IIB > III). The tool outputs a clear "suitable / not suitable" message. If not suitable → non-compliant isolation → authorisation guidance (§7).

**Boundary isolations (confirmed, Q10): no change.** Where the item being worked on sits **inside an existing boundary isolation** (i.e. shutdown conditions), only **single valve isolation locally** is required. The current boundary flag logic is retained and overrides the category requirement for the local isolation.

## 5. Effect on current purpose overrides

Current code overrides `totalScore` by purpose: SBT → 80, Motion → 80, CSE → 900. Under the new model (all confirmed):

- **CSE**: becomes a hard **Category I** outcome (no scoring).
- **Motion**: **removed.** It added no value (it only ever advised the minimum possible isolation) and the tool is now focused on breaking of containment. Removing it also eliminates the known `nonInvasiveControl3` ReferenceError.
- **SBT (instrument tubing)**: no longer a "purpose"; becomes a yes/no **exemption** alongside flare/vent/drains (see §6).
- **BOC (breaking of containment)**: becomes the main/default path. With Motion and SBT-as-purpose gone, explicit purpose selection effectively disappears — the tool assumes breaking of containment unless an exemption/CSE applies.

## 6. Exceptions to minimum isolation standard — slide 16

**Confirmed: exemptions are built into the tool as yes/no questions, each giving a different minimum-isolation outcome.**

- **Flare, Low Pressure Vent, and Closed Drains systems** (yes/no): Category III — single unproven block valve on the downstream (low-pressure) side.
- **Instrument small-bore tubing (SBT) personal isolations** (yes/no): outcome depends on fluid group —
  - Fluid Groups 1 & 2 → Category IIB (proven single block valve)
  - Fluid Groups 3 & 4 → Category III (unproven single block valve)

These exemptions take precedence over the standard group/duration table once selected.

## 7. Non-compliant isolation authorisation — slide 17

**Confirmed:** the tool should **advise the authorisation requirement** (i.e. who needs to approve the Level 2 risk assessment / deviation) but **does not need to model the full approval workflow** — the exact mechanism (e.g. TCOW vs Maximo deviation) is out of scope for the tool. Display the relevant approver as guidance alongside the "not suitable" outcome.

When the minimum category cannot be achieved, the tool's output should state the required authorisation (replaces/augments the current generic "Level 2 risk assessment required" message):

| Fluid Group | Minimum category that was required | Offshore approver | Onshore approver |
|---|---|---|---|
| 1 & 2 | I — Positive Isolation | OIM | Process TA / Operations Manager |
| 1 & 2 | IIA — Proven DBB | OIM | Process Engineer |
| 3 & 4 | I — Positive Isolation | OIM | Process TA / Operations Manager |
| 3 & 4 | IIA — Proven DBB | Department Head | N/A |
| 3 & 4 | IIB — Proven SBB | Area Authority | N/A |

Also (slide 8 consideration): **remove OIM approval requirement for non-hazardous fluid deviations**.

## 8. Confirmed decisions (answers to clarification questions)

1. **Motion** — **Remove.** No value; tool focused on breaking of containment. (Also fixes `nonInvasiveControl3`.)
2. **Per-isolation-point entries** — **Retained where relevant.** Size/pressure no longer drive separate entries, but each isolation point may still need separate assessment if connected live systems carry **different fluid categories**, or where exemptions (flare/drains) apply. The tool should still support assessing each point.
3. **Front-end flowchart questions (high-risk-event / defer-to-shutdown)** — **Add them** as a good enhancement (slide 14). See §4.
4. **Fluid group selection** — **Dropdown of standard fluids** that infers the group, plus an "Other" manual option. See §3.
5. **Flare/vent/closed-drains exemptions** — **Build in** as a yes/no question with its own outcome (Category III). See §6.
6. **SBT** — **Build in as an exemption** (yes/no), group-dependent outcome (IIB for Groups 1 & 2, III for Groups 3 & 4), not a purpose. See §6.
7. **Hot work definition** — spark potential **and** naked flame, directly involved **or** in the vicinity; no change from previous SIRPs. Applies to Groups 1 & 2 only. See §4.
8. **Non-compliant authorisation** — **Advise** the authorisation requirement, but keep it light; the tool need not model TCOW vs Maximo deviation workflow. See §7.
9. **Isolation selection** — User always selects the **best possible** isolation; positive isolation assessed first, then best available valved isolation; tool outputs suitable / not suitable. See §4.
10. **Boundary isolations** — **No change**; single valve locally inside an existing boundary isolation. See §4.
11. **Operating temperature** — **Now relevant**; can escalate the fluid group (e.g. non-hazardous fluid >50 °C → Group 3). Capture it as an input. See §3.

### Minor items still to settle during implementation
- **Onshore vs offshore** — slide 17 authorisation differs by location. Since §7 is advisory-only, decide whether to add a simple onshore/offshore toggle to show the right approver, or just display both columns.
- **Exemption precedence** — confirm intended order when several conditions coincide (CSE vs flare/drains vs SBT). Current assumption: CSE (Category I) is the strongest and wins; otherwise the selected exemption applies.

## 9. Impact map on the codebase

| Area | File | Change |
|---|---|---|
| Purpose radios (`boc`/`motion`/`cse`/`sbt`) | index.html ~L63–85 | Remove Motion and SBT-as-purpose; keep CSE as a Category I shortcut; default path = breaking of containment |
| Substance radios (`flammable`/`haz`/`nonHaz`) | index.html ~L96–110 | Replace with a **fluid dropdown** (standard fluids → inferred Group 1–4) + "Other" manual entry |
| Operating temperature | index.html | New input (value or band); escalates fluid group per §3 |
| Duration select (`oneOrLess`/`upToWeek`/`moreWeek`) | index.html ~L120–124 | Binary: ≤1 shift / >1 shift; delete `moreWeek` |
| Hot work | index.html | New yes/no input (Groups 1 & 2) |
| Exemption flags (flare/vent/drains; SBT) | index.html | New yes/no questions with dedicated outcomes (§6) |
| Front-end gating (high-risk-event / shutdown) | index.html | New yes/no questions at the start (§4, slide 14) |
| Line spec form (pipe size, pressure) | index.html | Remove size/pressure inputs; keep line description for the record; retain ability to assess multiple isolation points |
| Boundary isolation flag | index.html / JS/main.js | Retain existing behaviour — single valve locally inside a boundary isolation |
| `releaseMatrix`, `effectMatrix`, `timeMatrix`, score multiplication | JS/main.js `getInputData()` | Replace with category decision logic (§4) |
| Isolation type scores (1000/450/89/29) | JS/main.js | Replace with category ranking I > IIA > IIB > III |
| Output card + PDF | JS/main.js `printPDF()`, index.html | Show minimum category, fluid group (and any temperature escalation), and authorisation guidance on non-compliance |
| Help content | help.html | Rewrite to describe fluid groups, categories, exemptions, and the new flow |
| Reference docs | CLAUDE.md | Update scoring/algorithm description once implemented |
