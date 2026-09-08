# Mission Companion Architecture

This document is the engineering contract for Mission Companion. It defines the boundaries that protect reliable drawing use while allowing construction intelligence to evolve around it.

## Design Principles

### The Drawing Workspace is the foundation

The Drawing Workspace is the stable center of Mission Companion. Chief, Engineering Locator, specifications, inspections, photos, RFIs, reports, risks, and knowledge connect **to** the Drawing Workspace.

Nothing required for manual drawing use depends on Chief. Chief is a client of drawing services, not their owner.

### The PDF Viewer is always usable

When a retained PDF is available, users must be able to open it, browse every page, zoom, pan, rotate, fit the page, and restore the viewport.

Failure of AI, the drawing registry, a parser, analysis, retrieval, context providers, or Engineering Locator must never disable manual drawing viewing. Missing intelligence reduces capability, not usability.

### One source of truth per concern

Each concern has one owner:

- Viewer Engine owns PDF rendering, the current PDF page, viewport, zoom, pan, rotation, render cancellation, and render-generation protection.
- Page Model owns ordered page metadata, sidebar-card data, filter facets, and searchable page data.
- Navigation owns exact drawing resolution, page selection, and opening drawings.
- Context owns linked specifications, inspections, rooms, equipment, photos, documents, risks, questions, issues, history, and related drawings.
- Chief owns conversation, orchestration, and analysis requests. Chief never owns PDF rendering.
- Registry owns optional construction intelligence and authoritative drawing identity. Registry completeness never gates PDF rendering.

## Dependency Direction

Dependencies point downward toward the retained PDF:

```text
                 Chief
                   |
              Engineering
                   |
        Construction Intelligence
                   |
             Drawing Context
                   |
           Drawing Navigation
                   |
            Drawing Page Model
                   |
           Drawing Viewer Engine
                   |
                  PDF
```

Higher layers may request services from lower layers. Lower layers must not import, call, or require higher layers. In particular, the Viewer Engine has no dependency on Chief, AI, retrieval, registry quality, or construction context.

## Drawing Workspace Contract

### `drawing-viewer-engine`

Owns:

- Opening an already-resolved retained PDF document.
- PDF page count and current page state.
- Selecting, rendering, and moving between PDF pages.
- Render-task cancellation and generation checks.
- Zoom bounds and cursor-centered zoom calculations.
- Fit Page, Fit Width, rotation, pan, and scroll state.
- Viewport persistence by document and PDF page.

Must never own:

- Sheet-number parsing or drawing identity.
- Sidebar metadata, filters, or search semantics.
- Chief, conversation, retrieval, or AI behavior.
- Registry rebuilding or analysis-quality decisions.
- Specifications, inspections, rooms, or other construction links.

Only the Viewer Engine may directly manage PDF rendering and render-task state.

### `drawing-page-model`

Owns:

- One ordered presentation record for every retained PDF page.
- Per-page metadata used by sidebar cards.
- Metadata precedence: authoritative registry, partial analysis, stored page metadata, then runtime Page N fallback.
- Searchable page text and filter facets such as discipline and drawing type.
- Honest identity status: authoritative, partial, or fallback.

Must never own:

- PDF rendering, canvas state, zoom, pan, or rotation.
- Page navigation side effects.
- Registry creation, parsing, or persistence.
- AI conclusions or inferred construction relationships.
- Fabricated sheet numbers, titles, or authoritative identities.

No feature may construct an alternative sidebar-card model outside the Page Model.

### `drawing-navigation`

Owns:

- Resolving a drawing target to a PDF page.
- Resolution priority: stable drawing ID, exact normalized sheet number, then exact PDF page number.
- Creating and reducing drawing targets while preserving valid higher-level context.
- Selecting the resolved page through the Viewer Engine or Drawing Workspace boundary.
- Returning an honest unresolved result without clearing a usable manual viewer.

Must never own:

- PDF painting or canvas manipulation.
- Parser, registry, or analysis rebuilding.
- Retrieval or AI answering.
- Page-card construction or metadata mutation.

No feature may change the selected PDF page except through Drawing Navigation or the Viewer Engine.

### `drawing-context`

Owns:

- Structured, page-scoped linked data.
- Specifications, inspections, rooms, equipment, photos, documents, risks, questions, issues, history, and related drawings.
- Transient link operations and context-provider composition.
- Failure isolation for optional context providers.
- Honest empty collections when no exact link exists.

Must never own:

- PDF rendering or viewport state.
- Page selection or drawing identity resolution.
- UI rendering.
- Inferred or fabricated project relationships.
- Conversation or AI execution.

A failed context provider must be reported as reduced context and must not interrupt drawing rendering.

### `drawing-workspace`

Owns:

- The stable coordination API used by Chief and other clients.
- The current ordered page collection supplied by the Page Model.
- Delegating target resolution to Drawing Navigation.
- Delegating page selection to the Viewer Engine.
- Exposing page context, search, highlights, and registered extension points.
- Keeping intelligence optional around the retained-PDF viewer.

Must never own:

- Low-level PDF painting or a second viewport implementation.
- A duplicate page model or drawing target.
- Parser, registry, retrieval, or AI internals.
- Persisted conversation memory.
- Fabricated context or construction conclusions.

The workspace must operate with zero context providers, zero overlays, no registry, no analysis, and no AI.

## Chief Contract

Chief consumes Drawing Workspace services:

- `Workspace.open()` for exact drawing navigation.
- `Workspace.getContext()` for validated page context.
- `Workspace.highlight()` for a resolved region or object.
- `Workspace.search()` for the shared page model.

Chief owns conversation and orchestration. It may request analysis, but it never manipulates the PDF canvas, creates a second viewer state, or becomes the authority for the selected page.

## Command Contract

### Navigation commands

Commands beginning with navigation verbs such as `OPEN`, `SHOW`, `GO TO`, or `FOCUS` must:

1. Classify as navigation.
2. Resolve the exact registered target or return an honest unresolved result.
3. Navigate through the Drawing Workspace and Viewer Engine.
4. Stop processing after successful navigation.

Successful exact navigation must not call `engine.ask()`, produce an AI narrative, or fall through to retrieval.

### Analysis commands

Commands beginning with `EXPLAIN`, `ANALYZE`, `COMPARE`, `SUMMARIZE`, or `INSPECT` may invoke AI after the relevant drawing and context have been resolved.

### Conversation

Ordinary conversation behavior remains unchanged. Conversation state must not own or duplicate drawing rendering state.

## Failure Policy

The required degradation path is:

```text
Missing or failed intelligence
            |
            v
     Reduced capability
```

It must never become:

```text
Missing or failed intelligence
            |
            v
      Reduced usability
```

Examples:

- Missing registry: show runtime Page 1 through Page N labels and preserve manual browsing.
- Partial analysis: merge known metadata per page and use fallback only for missing fields.
- Failed parser: retain the PDF and existing valid page state.
- Failed context provider: show empty or reduced context while keeping the canvas available.
- Failed exact navigation: preserve the currently selected page and viewport.
- Failed AI or retrieval: preserve all drawing functions.

Fallback page labels are runtime presentation data. They must never be persisted as drawing identities or treated as authoritative construction intelligence.

## Architectural Rules

1. No feature may directly manipulate PDF rendering except through the Viewer Engine.
2. No feature may construct sidebar cards except through the Page Model.
3. No feature may change the selected page except through Drawing Navigation or the Viewer Engine.
4. No feature may call `engine.ask()` after successful exact navigation.
5. Registry completeness and analysis quality may enhance the viewer but may not gate it.
6. Intelligence upgrades must not reset the selected page or its viewport.
7. Stale render tasks must never overwrite a newer page selection.
8. The retained PDF is the rendering source; fallback metadata must never become authoritative identity.
9. Optional providers and extensions must fail independently of the viewer.
10. New integrations must use the existing Drawing Workspace API instead of creating duplicate viewer, target, context, or viewport state.

## Extension Model

Future features attach through these Drawing Workspace extension points:

- `registerOverlay()` for optional visual evidence layers.
- `registerSidebarSection()` for optional browser or supporting panels.
- `registerContextProvider()` for exact page-linked construction records.
- `registerToolbarAction()` for target-valid drawing actions.

Extensions must be optional. Registration must not alter the base viewer contract, and extension failure must not prevent retained-PDF rendering or manual page navigation.

No plugin implementation is part of this contract.

## Non-Goals

This architecture contract does not:

- Redesign the interface.
- Replace or rename existing modules.
- Change drawing parsing or registry rules.
- Change retrieval, prompts, conversation persistence, or AI providers.
- Change the PDF storage architecture or IndexedDB schema.
- Require optional intelligence for manual drawing use.
- Authorize inferred or fabricated construction data.

