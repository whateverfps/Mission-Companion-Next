const text = value => value === null || value === undefined ? '' : String(value).trim();

export const DRAWING_TRADE_CHANNELS = Object.freeze([
  { key: 'general', label: 'General', disciplines: ['General'], objectClasses: ['note', 'keynote'], divisions: ['00', '01'], relationshipTypes: ['requires', 'references', 'governed-by'] },
  { key: 'architectural', label: 'Architectural', disciplines: ['Architectural'], objectClasses: ['door', 'wall', 'finish', 'signage', 'wall-protection', 'fire-extinguisher-cabinet'], divisions: ['06', '07', '08', '09', '10', '12'], relationshipTypes: ['governed-by', 'references', 'related-to'] },
  { key: 'interiors', label: 'Interiors', disciplines: ['Interiors'], objectClasses: ['finish', 'signage', 'resilient-base', 'resilient-tile', 'paint-finish', 'wall-protection', 'fire-extinguisher-cabinet'], divisions: ['09', '10', '12'], relationshipTypes: ['governed-by', 'references'] },
  { key: 'hazardous-materials', label: 'Hazardous Materials', disciplines: ['Hazardous Materials', 'Hazardous'], objectClasses: ['hazardous-material'], divisions: ['02'], relationshipTypes: ['governed-by', 'affected-by'] },
  { key: 'fire-protection', label: 'Fire Protection', disciplines: ['Fire Protection'], objectClasses: ['sprinkler', 'fire-protection-equipment'], divisions: ['21'], relationshipTypes: ['governed-by', 'serves'] },
  { key: 'plumbing', label: 'Plumbing', disciplines: ['Plumbing'], objectClasses: ['plumbing-fixture', 'pipe', 'equipment'], divisions: ['22'], relationshipTypes: ['governed-by', 'serves'] },
  { key: 'mechanical', label: 'Mechanical', disciplines: ['Mechanical'], objectClasses: ['equipment', 'equipment-tag', 'ductwork', 'diffuser', 'damper', 'control'], divisions: ['23'], relationshipTypes: ['governed-by', 'serves', 'commissioned-by'] },
  { key: 'electrical', label: 'Electrical', disciplines: ['Electrical'], objectClasses: ['panel', 'transformer', 'receptacle', 'lighting', 'grounding', 'raceway'], divisions: ['26'], relationshipTypes: ['governed-by', 'serves', 'commissioned-by'] },
  { key: 'communications', label: 'Communications', disciplines: ['Telecommunications', 'Communications'], objectClasses: ['rack', 'cable-tray', 'copper-cabling', 'fiber-cabling', 'labeling', 'grounding'], divisions: ['27'], relationshipTypes: ['governed-by', 'serves', 'commissioned-by'] },
  { key: 'electronic-safety-security', label: 'Electronic Safety and Security', disciplines: ['Electronic Safety and Security'], objectClasses: ['security-device', 'access-control'], divisions: ['28'], relationshipTypes: ['governed-by', 'serves'] },
  { key: 'site', label: 'Site', disciplines: ['Civil', 'Landscape', 'Site'], objectClasses: ['site-object'], divisions: ['31', '32', '33'], relationshipTypes: ['governed-by', 'located-in'] },
  { key: 'all-trades', label: 'All Trades', disciplines: [], objectClasses: [], divisions: [], relationshipTypes: [] }
]);

export function tradeChannel(key) { return DRAWING_TRADE_CHANNELS.find(item => item.key === text(key)) || DRAWING_TRADE_CHANNELS.at(-1); }

export function suggestDrawingTrade({ discipline = '', objectType = '', sectionNumber = '', title = '' } = {}) {
  const division = text(sectionNumber).replace(/\D/g, '').slice(0, 2);
  const candidates = DRAWING_TRADE_CHANNELS.filter(item => item.key !== 'all-trades').map(item => ({ channel: item,
    score: (item.disciplines.some(value => value.toLowerCase() === text(discipline).toLowerCase()) ? 8 : 0) + (item.objectClasses.includes(text(objectType).toLowerCase()) ? 5 : 0) + (division && item.divisions.includes(division) ? 4 : 0) + (item.disciplines.some(value => text(title).toLowerCase().includes(value.toLowerCase())) ? 2 : 0) })).filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.channel.key.localeCompare(b.channel.key));
  return candidates.length && (candidates.length === 1 || candidates[0].score > candidates[1].score) ? { key: candidates[0].channel.key, label: candidates[0].channel.label, status: 'suggested', reason: 'Suggested from exact drawing discipline, object class, section division, or title.' } : null;
}

export function createDrawingTradeContext({ storage = globalThis.localStorage, storageKey = 'mission-companion:drawing-trade-context:v1' } = {}) {
  let explicitKey = ''; try { explicitKey = text(storage?.getItem?.(storageKey)); } catch { /* optional */ }
  return {
    select(key) { const channel = tradeChannel(key); explicitKey = channel.key; try { storage?.setItem?.(storageKey, explicitKey); } catch { /* optional */ } return { ...channel, status: 'selected' }; },
    clear() { explicitKey = ''; try { storage?.removeItem?.(storageKey); } catch { /* optional */ } },
    current(context = {}) { if (explicitKey) return { ...tradeChannel(explicitKey), status: 'selected' }; return suggestDrawingTrade(context) || { ...tradeChannel('all-trades'), status: 'default' }; },
    filterRequirements(requirements = [], key = explicitKey || 'all-trades') { const channel = tradeChannel(key); if (channel.key === 'all-trades') return [...requirements]; return requirements.filter(item => !item.sectionNumber || channel.divisions.includes(text(item.sectionNumber).replace(/\D/g, '').slice(0, 2)) || item.tradeChannels?.includes(channel.key)); },
    isExplicit: () => Boolean(explicitKey)
  };
}
