# Contributing to Mission PMIS

## Release discipline

Before releasing:

1. Extract the ZIP or clone the repo.
2. Open `index.html` or run `START_MISSION_PMIS.cmd`.
3. Verify Campus loads.
4. Verify Excel workbook upload still works.
5. Verify Building Browser works.
6. Verify Meeting Mode works.
7. Verify Engineering Mode works.
8. Verify Reports Center works.
9. Verify Print Current and Print All Buildings.
10. Confirm no asset loads from `C:\Users`, `%TEMP%`, or absolute paths.

## Commit style

Use short, clear commits:

- `Fix engineering mode selected building drivers`
- `Improve reports center print layout`
- `Polish campus map presentation`

## Do not commit

- VA-sensitive workbooks.
- Private spreadsheets.
- Temporary files.
- Local machine paths.
