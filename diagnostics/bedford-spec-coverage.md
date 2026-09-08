# Bedford Specification Coverage Audit

Generated from the current checked-in Bedford drawing catalog and the current Bedford specification vocabulary. No PDFs were loaded. I also could not find a checked-in Bedford specification index export, so exact PDF source-page destinations are not verifiable from repository artifacts alone.

## Summary

- Sheets audited: 70
- Supported sheets: 6
- Unsupported / unresolved sheets: 64

### Failure breakdown

- Intentional reference / no-governance sheets: 21
- Missing vocabulary / applicability rule: 6
- Missing drawing evidence: 37
- Resolver / provider failures: 0

## Verified Supported Sheets

These are the only Building 61 sheets the current title-based vocabulary probe could confirm from checked-in artifacts.

- 61IN101 - INTERIOR FINISH PLAN, SIGNAGE & SCHEDULES -> 09 91 00, 10 14 00
- 61E-100 - ELECTRICAL PLAN - BASEMENT LEVEL -> 26 05 00
- 61E-101 - ELECTRICAL PLAN - FIRST LEVEL -> 26 05 00
- 61E-102 - ELECTRICAL PLAN - SECOND LEVEL -> 26 05 00
- 61FX100 - FIRE PROTECTION PLAN - FIRST LEVEL -> 21 13 13
- 61P-100 - PLUMBING PLAN - BASEMENT LEVEL -> 22 05 00

## Definitive No-Governance Sheets

These sheets are intentionally non-technical or reference-only in the current audit.

- 61G-000
- 61G-001
- 61G-010
- 61G-011
- 61G-012
- 61A-001
- 61FX001
- 61FX901
- 61P-001
- 61M-001
- 61M-801
- 61M-901
- 61M-902
- 61E-001
- 61E-901
- 61T-001
- 61T-402
- 61T-901
- 61T-902
- 61T-903
- 61R-900

## Missing Vocabulary / Applicability Rule

These sheets are technical, but the current checked-in Bedford vocabulary does not supply a governing rule for their discipline/title pattern.

- 61H-101
- 61H-102
- 61FX101
- 61FX102
- 61FX401
- 61FX501

## Missing Drawing Evidence

These sheets are technical and likely governed in the workspace, but the checked-in catalog only exposes sheet metadata, not the page text needed to confirm a governing requirement match.

- 61A-400
- 61A-401
- 61A-511
- 61A-512
- 61A-531
- 61M-100
- 61M-101
- 61M-102
- 61M-401
- 61M-501
- 61M-701
- 61M-802
- 61E-401
- 61E-402
- 61E-501
- 61E-601
- 61E-701
- 61E-702
- 61E-703
- 61T-100
- 61T-101
- 61T-102
- 61T-401
- 61T-501
- 61T-502
- 61T-503
- 61T-504
- 61T-601
- 61T-602
- 61T-603A
- 61T-603B
- 61T-604
- 61T-605
- 61T-606
- 61T-607
- 61T-701
- 61T-702

## Unsupported Sheets by Discipline

- General: 5
- Architectural: 6
- Fire Protection: 7
- Plumbing: 2
- Mechanical: 11
- Electrical: 9
- Telecommunication: 23
- Hazardous: 2
- Reference: 1

## Representative Sheet Checks

- 61IN101: supported; matched 09 91 00 and 10 14 00.
- 61FX001: intentional reference / no-governance.
- 61FX100: supported; matched 21 13 13.
- 61P-100: supported; matched 22 05 00.
- 61M-101: missing drawing evidence.
- 61M-501: missing drawing evidence.
- 61E-401: missing drawing evidence.
- 61E-601: missing drawing evidence.
- 61T-401: missing drawing evidence.
- 61T-402: intentional reference / no-governance.
- 61A-401: missing drawing evidence.

## Leakage Findings

- No cross-discipline leakage showed up in the current title-based probe.
- The only confirmed matches were interiors -> 09 91 00 / 10 14 00 and electrical -> 26 05 00.

## Open Source Destination Failures

- 5 matched requirement rows could not be verified to an exact PDF source page from checked-in Bedford artifacts.
- The repository currently proves section support, but not the exact source-page mapping for those matches.

## Files Created Or Changed

- diagnostics/bedford-spec-coverage.md

## Tests

- Ran a local title-based Bedford coverage probe against the current vocabulary.
- No node test suite rerun was needed because this audit did not change production code.

## Next Repair Recommendation

Add a checked-in Bedford specification index export or page-text extraction for the remaining 37 technical sheets, then review the 8 vocabulary-gap sheets separately. The highest-value follow-up is the mechanical, electrical, and telecommunication plan/detail set, because those are the largest unresolved groups after the current vocabulary pass.
