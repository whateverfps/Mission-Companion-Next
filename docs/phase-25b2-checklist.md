# Phase 25B.2 Implementation Checklist

## Completed

- [x] Construction intent classification
- [x] Construction routing profiles
- [x] Routing scope reaches engine.ask()
- [x] Retrieval scope is applied before unchanged ranking
- [x] Shared action-target conversion
- [x] Return metadata preserved through source navigation
- [x] Action payload normalization preserves inspection IDs
- [x] Action payload normalization preserves drawing metadata
- [x] Exact specification section renders after navigation
- [x] Exact drawing sheet/page/region renders after navigation
- [x] Exact RFI document/section drill-down
- [x] Exact submittal document/section drill-down

## Remaining

- [ ] Exact first-class Inspection Record drill-down
- [ ] Exact deficiency source drill-down
- [ ] Room-centered transient package
- [ ] Building-centered transient package
- [ ] Equipment-centered transient package
- [ ] Location-specific Chief answer structure
- [ ] Method-specific Chief answer structure
- [ ] Mixed WHERE/HOW answer structure
- [ ] Four-item Mission Control navigation
- [ ] Grouped More Tools drawer
- [ ] Action availability validation
- [ ] Action deduplication
- [ ] Return navigation UI
- [ ] Focus movement and restoration
- [ ] Project/conversation isolation
- [ ] Full syntax, regression, and diff validation
- [ ] Browser acceptance review

## Working Rule

1. Read this checklist before every coding pass.
2. Complete only the first unchecked or in-progress item.
3. Add focused regression coverage.
4. Run the focused tests.
5. Run the full test suite.
6. Run git diff --check.
7. Mark the item complete only when every acceptance condition passes.
8. Never describe Phase 25B.2 as complete while unchecked items remain.
