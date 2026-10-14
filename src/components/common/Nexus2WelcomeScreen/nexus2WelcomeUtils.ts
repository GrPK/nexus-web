// Pure helpers for Nexus2WelcomeScreen and Nexus2ImportSection, split out for
// direct testing (see elgatoImportUtils.ts for the pattern this follows).
import type {
  Nexus2ApplyResult, Nexus2ApplyStatus, Nexus2CategoryId, Nexus2FanCurvesCategory, Nexus2PreviewCategory,
  Nexus2PreviewResponse, Nexus3CoolingPreset,
} from '../../../api/migration';

const CATEGORY_LABEL_KEYS: Partial<Record<Nexus2CategoryId, string>> = {
  appearance: 'nexus2Welcome.import.category.appearance.label',
  y70Layout: 'nexus2Welcome.import.category.y70Layout.label',
  q60Face: 'nexus2Welcome.import.category.q60Face.label',
  wallpapers: 'nexus2Welcome.import.category.wallpapers.label',
  gallerySources: 'nexus2Welcome.import.category.gallerySources.label',
  rotation: 'nexus2Welcome.import.category.rotation.label',
  fanCurves: 'nexus2Welcome.import.category.fanCurves.label',
};

/** Falls back to a generic label (raw id) for a category id this build doesn't recognize. */
export function categoryLabelKey(id: string): string {
  return CATEGORY_LABEL_KEYS[id as Nexus2CategoryId] ?? 'nexus2Welcome.import.category.other.label';
}

export interface CategoryDetail {
  key: string;
  params: Record<string, string | number>;
  /** `key` is a plural base; pick its form with pluralKey(key, language, params.count). */
  plural?: boolean;
  /** Params filled with a translated string: param name to its i18n key. */
  paramKeys?: Record<string, string>;
  /**
   * Nexus 2 free text (a curve or fan name). Never passed through t() params,
   * whose substitution mangles `{x}` and `$&`: the renderer composes it
   * through fillTemplate around the translated fragment instead. With `list`
   * the line is the curve template (name, list) and `key` is unused; without
   * it, the reason-line template (name, translated `key`).
   */
  user?: { name: string; list?: string[] };
}

/**
 * Fills `{token}` placeholders in a single pass over the template, so a value
 * that itself looks like a token or a replacement pattern (`{fans}`, `$&`) is
 * emitted verbatim. Used for lines that carry Nexus 2 free text.
 */
export function fillTemplate(template: string, values: Record<string, string>): string {
  return template
    .split(/(\{[a-zA-Z]+\})/)
    .map(part => {
      const m = /^\{([a-zA-Z]+)\}$/.exec(part);
      return m && m[1] in values ? values[m[1]] : part;
    })
    .join('');
}

/** Locale-aware "A, B, and C"; plain comma join where Intl.ListFormat is missing. */
export function formatList(items: string[], language: string): string {
  if (typeof Intl === 'undefined' || typeof Intl.ListFormat !== 'function') return items.join(', ');
  return new Intl.ListFormat(language, { style: 'long', type: 'conjunction' }).format(items);
}

/** The positive-framing count/value lines for one available category, one bullet each. */
export function categoryDetails(cat: Nexus2PreviewCategory): CategoryDetail[] {
  switch (cat.id) {
    case 'appearance': {
      const accent = { key: 'nexus2Welcome.import.category.appearance.detail', params: { accent: cat.accentColor ?? '-' } };
      return cat.count
        ? [accent, { key: 'nexus2Welcome.import.category.appearance.backgrounds', params: { count: cat.count }, plural: true }]
        : [accent];
    }
    case 'y70Layout':
      return [{ key: 'nexus2Welcome.import.category.y70Layout.detail', params: { pages: cat.pages, widgets: cat.mappedWidgets } }];
    case 'q60Face':
      if (cat.face && !cat.stashedFaces) return [{ key: `panel.widget.${cat.face}`, params: {} }];
      return [{
        key: 'nexus2Welcome.import.category.q60Face.detail',
        params: { face: cat.face ?? '-', stashed: cat.stashedFaces },
        ...(cat.face ? { paramKeys: { face: `panel.widget.${cat.face}` } } : {}),
      }];
    case 'wallpapers': {
      const count = { key: 'nexus2Welcome.import.category.wallpapers.detail', params: { count: cat.count }, plural: true };
      return cat.slideshowIntervalSec
        ? [count, { key: 'nexus2Welcome.import.category.wallpapers.slideshow', params: { count: cat.slideshowIntervalSec }, plural: true }]
        : [count];
    }
    case 'gallerySources':
      // A Gallery widget with no folders brings nothing over.
      return cat.count ? [{ key: 'nexus2Welcome.import.category.gallerySources.detail', params: { count: cat.count } }] : [];
    case 'rotation':
      return [{ key: 'nexus2Welcome.import.category.rotation.detail', params: { value: cat.value ?? '-' } }];
    case 'fanCurves':
      return fanCurveDetails(cat);
    default:
      // Only reachable for Nexus2LanguageCategory: the web never groups or
      // sends it, so this just degrades a service-known id to its raw value.
      return [{ key: 'nexus2Welcome.import.category.other.detail', params: { id: cat.id } }];
  }
}

const FAN_CURVE_REASONS = new Set([
  'mixedCurve', 'nonTemperatureInput', 'sensorNotFound', 'sensorAmbiguous', 'sensorImplausible', 'badPoints',
  'unsafeCurve', 'noTargets', 'pumpKept', 'targetNotFound', 'targetAmbiguous', 'uncontrolledChannel',
  'unsupportedTarget', 'gpuFlat', 'followedChannel', 'guardHealed',
]);

/** Plain-language key for a curve or target skip reason; an unknown or missing code degrades to a generic line. */
export function fanCurveReasonKey(reason: string | undefined): string {
  return reason && FAN_CURVE_REASONS.has(reason)
    ? `nexus2Welcome.import.category.fanCurves.reason.${reason}`
    : 'nexus2Welcome.import.category.fanCurves.reason.unknown';
}

const PRESET_LABEL_KEYS: Record<Nexus3CoolingPreset, string> = {
  silent: 'cooling.mode.silent',
  balanced: 'cooling.mode.balanced',
  turbo: 'cooling.mode.turbo',
};

// Nexus 2's silent and balanced read like the Nexus 3 cooling page labels.
const N2_MODE_LABEL_KEYS: Record<string, string> = {
  silent: 'cooling.mode.silent',
  balanced: 'cooling.mode.balanced',
  performance: 'nexus2Welcome.import.category.fanCurves.mode.performance',
};

/** The i18n key naming a Nexus 3 preset, or null for a value this build does not know. */
export function presetLabelKey(preset: string | undefined): string | null {
  return (preset && (PRESET_LABEL_KEYS as Record<string, string>)[preset]) || null;
}

function n2ModeLabelKey(mode: string | undefined): string | null {
  return (mode && N2_MODE_LABEL_KEYS[mode]) || null;
}

/** True when the fan group carries only a Recommended-mode preset, with no curves. */
export function isPresetOnlyFan(cat: Nexus2FanCurvesCategory): boolean {
  return cat.available && cat.fanCurvesNote === 'recommendedMode' && presetLabelKey(cat.recommendedPreset) !== null;
}

/** Label for a fan group row: a preset-only group is about cooling, not curves. */
export function fanGroupLabelKey(preview: Nexus2PreviewResponse | null, group: ImportGroupDef): string {
  const cat = preview?.categories.find((c): c is Nexus2FanCurvesCategory => c.id === 'fanCurves');
  return group.id === 'fanCurves' && cat && isPresetOnlyFan(cat) ? 'cooling.title' : group.labelKey;
}

function fanPresetDetail(cat: Nexus2FanCurvesCategory): CategoryDetail {
  const base = 'nexus2Welcome.import.category.fanCurves';
  const modeKey = n2ModeLabelKey(cat.recommendedFrom);
  return {
    key: modeKey ? `${base}.presetDetail` : `${base}.presetDetailNoMode`,
    params: { preset: '-', ...(modeKey ? { mode: '-' } : {}) },
    paramKeys: { preset: presetLabelKey(cat.recommendedPreset)!, ...(modeKey ? { mode: modeKey } : {}) },
  };
}

function fanCurveDetails(cat: Nexus2FanCurvesCategory): CategoryDetail[] {
  const base = 'nexus2Welcome.import.category.fanCurves';
  if (isPresetOnlyFan(cat)) return [fanPresetDetail(cat)];
  // An all-skipped group has no count to announce, only reasons.
  const lines: CategoryDetail[] = cat.available
    ? [{ key: `${base}.detail`, params: { count: cat.count }, plural: true }]
    : [];
  const skipLine = (name: string, reason: string | undefined): CategoryDetail => ({
    key: fanCurveReasonKey(reason),
    params: {},
    user: { name },
  });
  for (const curve of cat.fanCurves ?? []) {
    const driven = curve.targets.filter(tg => tg.status === 'import');
    if (curve.status !== 'import' || driven.length === 0) {
      lines.push(skipLine(curve.name, curve.status === 'import' ? 'noTargets' : curve.reason));
      continue;
    }
    lines.push({ key: '', params: {}, user: { name: curve.name, list: driven.map(tg => tg.label) } });
    if (curve.minimumRaised) lines.push({ key: `${base}.curveRaised`, params: {}, user: { name: curve.name } });
    for (const tg of curve.targets) if (tg.status !== 'import') lines.push(skipLine(tg.label, tg.reason));
  }
  if ((cat.otherProfiles ?? 0) > 0) lines.push({ key: `${base}.otherProfiles`, params: {} });
  return lines;
}

const APPLY_STATUS_KEYS: Record<Nexus2ApplyStatus, string> = {
  applied: 'nexus2Welcome.import.result.status.applied',
  skipped: 'nexus2Welcome.import.result.status.skipped',
  failed: 'nexus2Welcome.import.result.status.failed',
  needsConfirm: 'nexus2Welcome.import.result.status.needsConfirm',
};

/** Falls back to a generic status label for a status this build's closed union doesn't model. */
export function applyStatusKey(status: string): string {
  return (APPLY_STATUS_KEYS as Record<string, string>)[status] ?? 'nexus2Welcome.import.result.status.unknown';
}

const APPLY_DETAIL_KEYS: Record<string, string> = {
  'no-q60-record': 'nexus2Welcome.import.result.detail.noQ60Record',
  nexus3CoolingCustomized: 'nexus2Welcome.import.result.detail.nexus3CoolingCustomized',
  'nexus3-cooling-customized': 'nexus2Welcome.import.result.detail.nexus3CoolingCustomized',
};

/** Localizes a known apply-result machine hint; unknown hints fall back to a generic line. */
export function applyDetailKey(detail: string): string {
  return APPLY_DETAIL_KEYS[detail] ?? 'nexus2Welcome.import.result.detail.generic';
}

/** A Recommended-mode group whose preset this build does not know is treated as unmappable, never as curves. */
function isUnknownPresetFan(c: Nexus2PreviewCategory): boolean {
  return c.id === 'fanCurves' && c.fanCurvesNote === 'recommendedMode' && presetLabelKey(c.recommendedPreset) === null;
}

/** Label for an apply-result issue line: the kept-setup hint is about cooling, not curves. */
export function issueCategoryLabelKey(issue: Nexus2ApplyResult): string {
  return issue.id === 'fanCurves' && isKeptSetupSkip(issue) ? 'cooling.title' : categoryLabelKey(issue.id);
}

export function availableCategories(preview: Nexus2PreviewResponse | null): Nexus2PreviewCategory[] {
  return preview?.categories.filter(c => c.available && !isUnknownPresetFan(c)) ?? [];
}

// The wire categories are consolidated into three user-facing groups (Y70
// panel, Q-Series panel, fan curves); a group's own checkbox toggles every
// wire id it carries. `language` is deliberately not a member of any
// group - the web never shows or sends it.
export type ImportGroupId = 'y70Panel' | 'q60Panel' | 'fanCurves';

export interface ImportGroupDef {
  id: ImportGroupId;
  wireIds: Nexus2CategoryId[];
  labelKey: string;
}

export const IMPORT_GROUPS: ImportGroupDef[] = [
  {
    id: 'y70Panel',
    wireIds: ['y70Layout', 'appearance', 'gallerySources'],
    labelKey: 'nexus2Welcome.import.group.y70Panel.label',
  },
  {
    id: 'q60Panel',
    wireIds: ['q60Face', 'wallpapers', 'rotation'],
    labelKey: 'nexus2Welcome.import.group.q60Panel.label',
  },
  {
    id: 'fanCurves',
    wireIds: ['fanCurves'],
    labelKey: 'nexus2Welcome.import.group.fanCurves.label',
  },
];

/** The all-skipped fan curves category (nothing importable, but a list of why), or null. */
function skippedOnlyFanCurves(preview: Nexus2PreviewResponse | null): Nexus2FanCurvesCategory | null {
  const cat = preview?.categories.find((c): c is Nexus2FanCurvesCategory => c.id === 'fanCurves');
  return cat && !cat.available && (cat.fanCurves?.length ?? 0) > 0 ? cat : null;
}

/** The explanation shown for a fan curves group with nothing to import, or null. */
export function unavailableGroupNoteKey(preview: Nexus2PreviewResponse | null, group: ImportGroupDef): string | null {
  if (group.id !== 'fanCurves') return null;
  const cat = preview?.categories.find((c): c is Nexus2FanCurvesCategory => c.id === 'fanCurves');
  if (!cat || !cat.fanCurvesNote || (cat.available && !isUnknownPresetFan(cat))) return null;
  return `nexus2Welcome.import.category.fanCurves.note.${cat.fanCurvesNote}`;
}

/** The note line for an unavailable fan group, with the Nexus 2 mode filled in when the service sent a known one. */
export function unavailableGroupNote(preview: Nexus2PreviewResponse | null, group: ImportGroupDef): CategoryDetail | null {
  const key = unavailableGroupNoteKey(preview, group);
  if (!key) return null;
  const cat = preview?.categories.find((c): c is Nexus2FanCurvesCategory => c.id === 'fanCurves');
  const modeKey = cat?.fanCurvesNote === 'nexus3CoolingCustomized' ? n2ModeLabelKey(cat.recommendedFrom) : null;
  if (cat?.fanCurvesNote === 'nexus3CoolingCustomized') {
    return modeKey
      ? { key, params: { mode: '-' }, paramKeys: { mode: modeKey } }
      : { key: `${key}NoMode`, params: {} };
  }
  return { key, params: {} };
}

/**
 * Title and description keys for the import section, so the header only
 * claims what the importable groups do (a note-only or all-skipped group does
 * not count): personalization replaces the panel setup,
 * fan curves touch only the fans they list.
 */
export function importHeaderKeys(preview: Nexus2PreviewResponse | null): { titleKey: string; descriptionKey: string } {
  const groups = IMPORT_GROUPS.filter(g => groupHasAvailable(preview, g));
  const fan = groups.some(g => g.id === 'fanCurves');
  const personalization = groups.some(g => g.id !== 'fanCurves');
  const fanCat = preview?.categories.find((c): c is Nexus2FanCurvesCategory => c.id === 'fanCurves');
  // A preset-only fan group switches a cooling preset; it lists no fans.
  const preset = fan && !!fanCat && isPresetOnlyFan(fanCat);
  // Nothing importable: a neutral header that promises no replacement.
  const suffix = fan
    ? (preset ? (personalization ? '.bothPreset' : '.fanPreset') : (personalization ? '.both' : '.fanCurves'))
    : (personalization ? '' : '.none');
  return {
    titleKey: `nexus2Welcome.import.title${suffix === '.bothPreset' ? '.both' : suffix}`,
    descriptionKey: `nexus2Welcome.import.description${suffix}`,
  };
}

/** True when the group has at least one available wire category (it can be checked and applied). */
export function groupHasAvailable(preview: Nexus2PreviewResponse | null, group: ImportGroupDef): boolean {
  const available = new Set(availableCategories(preview).map(c => c.id));
  return group.wireIds.some(id => available.has(id));
}

/** Groups with an available wire category, an unavailable-note, or a list of skipped curves to show, in display order. */
export function visibleImportGroups(preview: Nexus2PreviewResponse | null): ImportGroupDef[] {
  return IMPORT_GROUPS.filter(g => groupHasAvailable(preview, g)
    || unavailableGroupNoteKey(preview, g) !== null
    || (g.id === 'fanCurves' && skippedOnlyFanCurves(preview) !== null));
}

/** The positive detail bullets for a group, in member-category order. */
export function groupDetailParts(preview: Nexus2PreviewResponse | null, group: ImportGroupDef): CategoryDetail[] {
  const skipped = skippedOnlyFanCurves(preview);
  return [...availableCategories(preview), ...(skipped ? [skipped] : [])]
    .filter(c => group.wireIds.includes(c.id))
    .flatMap(categoryDetails);
}

/** Every group with something to import starts checked; a note-only group stays unchecked. */
export function defaultSelectedGroupIds(preview: Nexus2PreviewResponse | null): Set<ImportGroupId> {
  return new Set(visibleImportGroups(preview).filter(g => groupHasAvailable(preview, g)).map(g => g.id));
}

/** The available wire ids of every checked group - what an apply call actually sends. */
export function selectedWireIds(preview: Nexus2PreviewResponse | null, selectedGroups: Set<ImportGroupId>): Nexus2CategoryId[] {
  const available = new Set(availableCategories(preview).map(c => c.id));
  return IMPORT_GROUPS
    .filter(g => selectedGroups.has(g.id))
    .flatMap(g => g.wireIds.filter(id => available.has(id)));
}

const STATUS_SEVERITY: Record<Nexus2ApplyStatus, number> = {
  skipped: 0,
  applied: 1,
  needsConfirm: 2,
  failed: 3,
};

export interface GroupResultSummary {
  groupId: ImportGroupId;
  labelKey: string;
  status: Nexus2ApplyStatus;
  /** Items applied, when the service reports a count (fan curves). */
  count?: number;
  /** The Nexus 3 cooling preset applied (fan curves). */
  preset?: Nexus3CoolingPreset;
  /** The failed/needsConfirm members, for the detail line(s) under the group row. */
  issues: Nexus2ApplyResult[];
}

/**
 * Rolls apply results up per group: the group's status is its worst member
 * (failed beats needsConfirm beats applied beats skipped), so a single stuck
 * category never reads as an overall success.
 */
export function groupResultSummaries(results: Nexus2ApplyResult[] | null): GroupResultSummary[] {
  if (!results) return [];
  const summaries: GroupResultSummary[] = [];
  for (const group of IMPORT_GROUPS) {
    const members = results.filter(r => group.wireIds.some(id => id === r.id));
    if (members.length === 0) continue;
    const status = members.reduce<Nexus2ApplyStatus>(
      (worst, r) => (STATUS_SEVERITY[r.status] > STATUS_SEVERITY[worst] ? r.status : worst),
      members[0].status,
    );
    const issues = members.filter(r => r.status === 'failed' || r.status === 'needsConfirm' || isKeptSetupSkip(r));
    const count = members.find(r => typeof r.count === 'number')?.count;
    const preset = members.find(r => presetLabelKey(r.preset) !== null)?.preset;
    summaries.push({
      groupId: group.id, labelKey: preset ? 'cooling.title' : group.labelKey, status, issues,
      ...(count !== undefined ? { count } : {}), ...(preset ? { preset } : {}),
    });
  }
  return summaries;
}

/** A skip that carries the cooling-customized reason: the preset was not applied after the user changed cooling post-preview. */
function isKeptSetupSkip(r: Nexus2ApplyResult): boolean {
  return r.status === 'skipped' && r.detail !== null && applyDetailKey(r.detail) === APPLY_DETAIL_KEYS.nexus3CoolingCustomized;
}

/** True once every result applied cleanly (a plain skip counts as clean; failed, needsConfirm and a kept-setup skip do not). */
export function allApplyResultsClean(results: Nexus2ApplyResult[] | null): boolean {
  return !!results && results.length > 0 && results.every(r => (r.status === 'applied' || r.status === 'skipped') && !isKeptSetupSkip(r));
}
