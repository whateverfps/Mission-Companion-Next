# Bedford Drawing-Set Ingestion

This document describes the proven Bedford ingestion path currently used by Mission Companion.
It reflects the implemented B61, B62, and MCR drawing-set workflow as accepted in browser testing.

## What Bedford ingestion is

Bedford is a single project with:

- one shared specification index
- multiple drawing sets
- one workspace registry
- one Chief / Workspace runtime

Each drawing set contributes:

- a durable PDF
- a drawing catalog
- a per-building specification relationship file

The application does not create separate project architectures for each building.
Instead, it loads each Bedford drawing set through the same bootstrap path and merges the results into the shared Bedford workspace model.

## Proven drawing sets

The current Bedford project contains these drawing sets:

- Building 61
- Building 62
- New Main Computer Room building

Each set is registered in [`src/bedford-project.js`](../src/bedford-project.js) and exposed through the shared registry in [`src/workspace-registry.js`](../src/workspace-registry.js).

## Canonical files for each drawing set

Each Bedford drawing set is expected to have all of the following:

- a PDF under `project-documents/bedford/drawings/`
- a drawing catalog under `project-data/bedford/drawing-catalogs/`
- a spec relationship file under `project-data/bedford/relationships/`

For the currently proven sets:

- Building 61
  - PDF: `project-documents/bedford/drawings/518-22-700.Bedford.EHRM.IFC.B61.20260316.pdf`
  - catalog: `project-data/bedford/drawing-catalogs/building-61.json`
  - relationships: `project-data/bedford/relationships/building-61-spec-links.json`
- Building 62
  - PDF: `project-documents/bedford/drawings/518-22-700.Bedford.EHRM.IFC.B62.20260316.pdf`
  - catalog: `project-data/bedford/drawing-catalogs/building-62.json`
  - relationships: `project-data/bedford/relationships/building-62-spec-links.json`
- New Main Computer Room building
  - PDF: `project-documents/bedford/drawings/518-22-700.Bedford.EHRM.IFC.MCR.20260316.pdf`
  - catalog: `project-data/bedford/drawing-catalogs/building-MCR.json`
  - relationships: `project-data/bedford/relationships/building-MCR-spec-links.json`

## Bootstrap sequence

The Bedford runtime bootstrap follows this order in [`src/app.js`](../src/app.js):

1. load the Bedford specification index
2. load each Bedford drawing catalog
3. load each Bedford relationship file
4. reconcile the catalogs into the shared drawing catalog service
5. load the relationship graph into the drawing-specification link service
6. mark the Bedford landing state as ready when the required assets have loaded

The important implementation detail is that the bootstrap is iterated over `bedfordDrawingSets`.
It is not hardcoded to a single building.

## How drawing sets are resolved

The resolver in [`src/bedford-project.js`](../src/bedford-project.js) maps a drawing reference to the correct Bedford set by checking, in order:

1. document id
2. page id / drawing page id
3. sheet number / sheet prefix

That allows a sheet like `61E-702`, `62E-702`, or `MCRA-101` to resolve back to the correct drawing-set identity before catalog lookup.

## How the workspace model is built

[`src/workspace-registry.js`](../src/workspace-registry.js) is the source of the workspace records shown in Mission Companion.

It uses:

- the Bedford drawing catalogs
- the Bedford relationship graph
- the shared specification index
- the Bedford milestone context

to build:

- room/workspace records
- drawing categories
- sheet-to-specification applicability
- Chief insight text
- selected-sheet-aware context

The registry is the layer that turns Bedford data into the Workspace experience.

## How Chief uses the same Bedford data

Chief does not use a separate Bedford model.
It reads the same shared drawing and specification services as the Workspace.

That means explicit building intent and active sheet context must resolve against the correct Bedford drawing set before Chief produces drawing cards or specification answers.

## What was proven in browser acceptance

Browser acceptance confirmed that:

- MCR loads through the same Bedford bootstrap path as the other drawing sets
- MCR opens its durable PDF correctly
- the 120-sheet MCR catalog is available
- trade and discipline grouping works
- selecting MCR sheets opens the correct PDF/page
- applicable specifications change with selected sheet context
- Chief switches to MCR context
- MCR coexists with B61 in the same workspace
- the persistent Workspace navigation remains intact
- no B61 fallback occurs when MCR is the active set

## How to add another Bedford drawing set

To add another Bedford building, follow the same proven pattern:

1. add the drawing PDF under `project-documents/bedford/drawings/`
2. generate the drawing catalog JSON
3. generate the per-building relationship JSON
4. register the drawing set in `src/bedford-project.js`
5. add catalog wiring in `src/workspace-registry.js`
6. verify the set is included in the Bedford bootstrap paths in `src/app.js`
7. add or update regression tests for bootstrap, registry, and browser-facing sheet/spec behavior

Do not create a separate ingestion architecture for a single new building unless the project requirements change.

## Related tests

Relevant coverage currently lives in:

- [`test/bedford-bootstrap.test.js`](../test/bedford-bootstrap.test.js)
- [`test/workspace-registry.test.js`](../test/workspace-registry.test.js)

Those tests confirm that the Bedford bootstrap and registry stay deterministic as drawing sets are added.
