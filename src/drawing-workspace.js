import { resolveDrawingPageNavigation } from './drawing-navigation.js';

const text = value => value === null || value === undefined ? '' : String(value).trim();
const list = value => Array.isArray(value) ? value : [];

export function classifyDrawingWorkspaceCommand(value = '') {
  const command = text(value);
  if (/^(?:open|show|go\s+to|focus)\b/i.test(command)) return 'navigation';
  if (/^(?:analyze|explain|summarize|compare|inspect)\b/i.test(command)) return 'analysis';
  return 'conversation';
}

export function createDrawingWorkspace({ viewerEngine, contextService } = {}) {
  const hooks = { overlays: new Map(), sidebarSections: new Map(), toolbarActions: new Map() };
  let pages = [];
  let highlight = null;
  const register = (collection, id, extension) => {
    const key = text(id);
    if (!key || !extension) return false;
    collection.set(key, extension);
    return true;
  };
  return {
    setPages(nextPages = []) { pages = [...list(nextPages)]; return pages.length; },
    getPages: () => [...pages],
    open(target = {}, currentPageNumber = viewerEngine?.snapshot?.().selectedPage || null) {
      const resolution = resolveDrawingPageNavigation(target, pages, currentPageNumber);
      if (resolution.resolved) viewerEngine?.selectPage?.(resolution.pageNumber);
      return resolution;
    },
    getContext(pageOrNumber) {
      const page = typeof pageOrNumber === 'object' ? pageOrNumber : pages.find(item => Number(item.pdfPageNumber || item.pageNumber) === Number(pageOrNumber));
      return contextService?.getContext?.(page || {}) || null;
    },
    search(query = '') {
      const needle = text(query).toLowerCase();
      return needle ? pages.filter(page => text(page.searchableText || [page.sheetNumber, page.sheetTitle, page.discipline, page.drawingType, page.primarySheetType, page.pageNumber].join(' ')).toLowerCase().includes(needle)) : [...pages];
    },
    highlight(value = null) { highlight = value ? structuredClone(value) : null; return highlight; },
    getHighlight: () => highlight ? structuredClone(highlight) : null,
    registerOverlay: (id, extension) => register(hooks.overlays, id, extension),
    registerSidebarSection: (id, extension) => register(hooks.sidebarSections, id, extension),
    registerContextProvider: provider => contextService?.registerProvider?.(provider) || false,
    registerToolbarAction: (id, extension) => register(hooks.toolbarActions, id, extension),
    extensions: () => ({ overlays: [...hooks.overlays.keys()], sidebarSections: [...hooks.sidebarSections.keys()], toolbarActions: [...hooks.toolbarActions.keys()] })
  };
}
