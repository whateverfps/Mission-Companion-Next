const text = value => value === null || value === undefined ? '' : String(value).trim();
const clamp = value => Math.max(0, Math.min(1, Number(value) || 0));
const validRegion = region => region && ['x', 'y', 'width', 'height'].every(key => Number.isFinite(Number(region[key]))) && Number(region.width) > 0 && Number(region.height) > 0;

export function normalizedViewportBounds({ scrollLeft = 0, scrollTop = 0, viewportWidth = 0, viewportHeight = 0, contentWidth = 0, contentHeight = 0, rotation = 0 } = {}) {
  if (!(contentWidth > 0) || !(contentHeight > 0)) return { x: 0, y: 0, width: 1, height: 1 };
  let region = { x: clamp(scrollLeft / contentWidth), y: clamp(scrollTop / contentHeight), width: clamp(viewportWidth / contentWidth), height: clamp(viewportHeight / contentHeight) };
  region.width = Math.min(region.width, 1 - region.x); region.height = Math.min(region.height, 1 - region.y);
  const angle = ((Number(rotation) % 360) + 360) % 360;
  if (angle === 90) region = { x: region.y, y: 1 - region.x - region.width, width: region.height, height: region.width };
  else if (angle === 180) region = { x: 1 - region.x - region.width, y: 1 - region.y - region.height, width: region.width, height: region.height };
  else if (angle === 270) region = { x: 1 - region.y - region.height, y: region.x, width: region.height, height: region.width };
  return Object.fromEntries(Object.entries(region).map(([key, value]) => [key, Math.max(0, Math.min(1, value))]));
}

export function regionsIntersect(a, b) {
  return validRegion(a) && validRegion(b) && a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function createDrawingViewportContextService({ storage = globalThis.localStorage, storageKey = 'mission-companion:drawing-viewport-context:v1', now = () => new Date().toISOString(), onChange = () => {}, throttleMs = 80 } = {}) {
  const contexts = new Map(); let generation = 0; let timer = null;
  try { for (const item of JSON.parse(storage?.getItem?.(storageKey) || '[]')) if (item?.documentId && item?.pageId) contexts.set(`${item.documentId}:${item.pageId}`, item); } catch { /* optional context starts empty */ }
  const persist = () => { try { storage?.setItem?.(storageKey, JSON.stringify([...contexts.values()])); } catch { /* viewer remains independent */ } };
  const key = value => `${text(value?.documentId)}:${text(value?.pageId)}`;
  const commit = context => { contexts.set(key(context), context); persist(); onChange(structuredClone(context)); return structuredClone(context); };
  return {
    get(documentId, pageId) { const value = contexts.get(`${text(documentId)}:${text(pageId)}`); return value ? structuredClone(value) : null; },
    update(input = {}, { immediate = false } = {}) {
      if (!text(input.projectId) || !text(input.documentId) || !text(input.pageId) || !(Number(input.pdfPageNumber) > 0)) return null;
      const previous = contexts.get(key(input)) || {};
      const context = { ...previous, projectId: text(input.projectId), documentId: text(input.documentId), pageId: text(input.pageId), pdfPageNumber: Number(input.pdfPageNumber),
        bounds: input.bounds ? { ...input.bounds } : previous.bounds || { x: 0, y: 0, width: 1, height: 1 }, zoom: Number.isFinite(Number(input.zoom)) ? Number(input.zoom) : previous.zoom ?? null,
        rotation: Number(input.rotation ?? previous.rotation) || 0, selectedRegion: input.selectedRegion === null ? null : validRegion(input.selectedRegion) ? { ...input.selectedRegion } : previous.selectedRegion || null,
        selectedRoomId: input.selectedRoomId === null ? null : text(input.selectedRoomId || previous.selectedRoomId) || null, selectedObjectId: input.selectedObjectId === null ? null : text(input.selectedObjectId || previous.selectedObjectId) || null,
        activeTradeChannel: text(input.activeTradeChannel || previous.activeTradeChannel || 'all-trades'), timestamp: now(), source: ['manual-selection', 'object-selection', 'room-selection', 'viewport-inference', 'page-context'].includes(input.source) ? input.source : previous.source || 'page-context' };
      generation += 1; const currentGeneration = generation;
      if (immediate || throttleMs <= 0) return commit(context);
      clearTimeout(timer); timer = setTimeout(() => { if (currentGeneration === generation) commit(context); }, throttleMs);
      return structuredClone(context);
    },
    selectRegion(identity, region, source = 'manual-selection') { return this.update({ ...identity, selectedRegion: validRegion(region) ? region : null, selectedRoomId: null, source }, { immediate: true }); },
    useRoom(identity, room) { if (!text(room?.roomId) || !validRegion(room?.region) || room.verificationState !== 'confirmed' || room.pageId !== identity.pageId) return null; return this.update({ ...identity, selectedRegion: room.region, selectedRoomId: room.roomId, source: 'room-selection' }, { immediate: true }); },
    clearSelection(identity) { return this.update({ ...identity, selectedRegion: null, selectedRoomId: null, selectedObjectId: null, source: 'page-context' }, { immediate: true }); },
    visibleRooms(context, rooms = []) { return rooms.filter(room => room.verificationState === 'confirmed' && room.pageId === context?.pageId && regionsIntersect(context.bounds, room.region)).map(room => structuredClone(room)); },
    async resolveLatest(resolver, context) { const requestGeneration = ++generation; const result = await resolver(structuredClone(context)); return requestGeneration === generation ? { committed: true, generation, result } : { committed: false, generation: requestGeneration, result: null }; },
    generation: () => generation,
    dispose() { clearTimeout(timer); }
  };
}
