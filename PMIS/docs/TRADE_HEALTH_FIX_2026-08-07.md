# Trade Health source-of-truth fix — 2026-08-07

## Finding
The Building Workspace Trade Health widget was not displaying an Excel percentage. It converted qualitative PMIS_Data trade states into hard-coded pseudo-percentages:

- PASS -> 100%
- FAIL -> 15%
- N/A -> 50%
- every other state (including Verify / Watch) -> 55%

For Building 61, PMIS_Data reports HVAC, Electrical, Telecom, Fire Protection, Fire Alarm, and Security as `Verify`. The B61_Assessment Owner Readiness Score section has 0 in the Fire, HVAC, Electrical, and Telecom score columns for all listed rooms. Therefore the front end's 55% was synthetic and did not represent workbook completion.

## Correction
Trade Health now follows source-of-truth completion semantics:

- Numeric Excel values are preserved (0-1 is displayed as 0-100%; 0-100 is displayed directly).
- Percent strings are preserved.
- PASS / completed = 100%.
- Verify / Watch / Pending / Fail / N/A / blank / missing = 0% until a real completion value exists.
- Missing trade data no longer defaults to PASS.

This makes Building 61 display 0% across the currently unverified trade-health rows instead of 55%.

## Files changed
- `js/app-main.js`
- `index.html` (cache-bust version)
- `VERSION`
- `CHANGELOG.md`
- mirrored legacy stack `js/app-main.js` and `index.html`
