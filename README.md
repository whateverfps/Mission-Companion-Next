# Mission Companion Master Web 2.0

Mission Companion is a browser-based, source-grounded subject-matter workspace. This repository is the master application.

## Core capabilities

- Project-based knowledge libraries
- PDF, DOCX, XLS/XLSX, text, Markdown, CSV, JSON, HTML, XML, and log ingestion
- Heading- and section-aware indexing
- Source-only, SME-assisted, and general assistant modes
- Evidence panel showing every retrieved section
- Source inspector for verifying extraction
- Known-answer SME evaluation cases
- Project export/import
- GitHub Pages deployment

## Deploy

1. Upload all repository files to the root of a new GitHub repository.
2. Open **Settings → Pages**.
3. Select **GitHub Actions** under Build and deployment.
4. Push or commit to `main`.
5. Open the Actions tab and wait for **Deploy Mission Companion**.

## Important security note

The public static site stores an API key only in the visitor's browser. Do not publish an API key in this repository. A shared organizational key requires a secure server-side API proxy.

## Recommended accuracy workflow

1. Create one project per knowledge domain or engagement.
2. Add governing documents.
3. Inspect extracted sections in Source Inspector.
4. Use Source-only mode for project-specific answers.
5. Create evaluation cases for known questions.
6. Run those cases after every meaningful engine change.

## Current limitation

Browser parsing depends on third-party browser libraries for PDF, Word, and Excel files. Scanned/image-only PDFs require OCR and are not reliably parsed by this static edition.
