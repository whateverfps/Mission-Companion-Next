# Release Notes

## v1.2.4 GitHub Long-Haul Stack

Purpose: prepare Mission PMIS for GitHub Pages, long-term versioning, and stable release management.

### Added
- GitHub Pages deployment workflow.
- `.nojekyll` for static asset compatibility.
- `.gitignore` to prevent accidental workbook/private data commits.
- `docs/DEPLOYMENT.md`.
- `docs/ROADMAP.md`.
- `docs/CONTRIBUTING.md`.
- `docs/ARCHITECTURE.md`.
- `VERSION` file.
- `CHANGELOG.md`.

### Preserved
- Existing Mission PMIS front end.
- Excel workbook loading model.
- Campus map.
- Engineering mode.
- Reports center.
- Meeting mode.
- Local launcher scripts.

### Rule
Excel remains the source of truth. The web application remains the presentation layer.
