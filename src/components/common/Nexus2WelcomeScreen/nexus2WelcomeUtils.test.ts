// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Nexus2ApplyResult, Nexus2PreviewCategory, Nexus2PreviewResponse } from '../../../api/migration';
import {
  IMPORT_GROUPS,
  allApplyResultsClean,
  applyDetailKey,
  applyStatusKey,
  availableCategories,
  categoryDetails,
  categoryLabelKey,
  defaultSelectedGroupIds,
  fanCurveReasonKey,
  fillTemplate,
  formatList,
  groupDetailParts,
  groupResultSummaries,
  importHeaderKeys,
  selectedWireIds,
  unavailableGroupNoteKey,
  visibleImportGroups,
} from './nexus2WelcomeUtils';

describe('categoryLabelKey', () => {
  it('resolves a known category id', () => {
    expect(categoryLabelKey('wallpapers')).toBe('nexus2Welcome.import.category.wallpapers.label');
  });

  it('falls back to the generic label for an unknown id', () => {
    expect(categoryLabelKey('futureCategory')).toBe('nexus2Welcome.import.category.other.label');
  });

  it('falls back to the generic label for language, which the web never groups', () => {
    expect(categoryLabelKey('language')).toBe('nexus2Welcome.import.category.other.label');
  });
});

describe('categoryDetails', () => {
  it('formats y70Layout as pages + mappedWidgets, not the raw widget count', () => {
    expect(categoryDetails({ id: 'y70Layout', available: true, pages: 3, widgets: 12, mappedWidgets: 10, droppedTypes: ['aquarium'] }))
      .toEqual([{ key: 'nexus2Welcome.import.category.y70Layout.detail', params: { pages: 3, widgets: 10 } }]);
  });

  it('adds a plural background count to the accent when the Y70 library gains backgrounds', () => {
    expect(categoryDetails({ id: 'appearance', available: true, accentColor: '#ff0000', background: null, count: 20 })).toEqual([
      { key: 'nexus2Welcome.import.category.appearance.detail', params: { accent: '#ff0000' } },
      { key: 'nexus2Welcome.import.category.appearance.backgrounds', params: { count: 20 }, plural: true },
    ]);
    expect(categoryDetails({ id: 'appearance', available: true, accentColor: '#ff0000', background: null, count: 0 })).toHaveLength(1);
  });

  it('formats wallpapers as a plural count, plus the slideshow interval when there is one', () => {
    expect(categoryDetails({ id: 'wallpapers', available: true, count: 4 }))
      .toEqual([{ key: 'nexus2Welcome.import.category.wallpapers.detail', params: { count: 4 }, plural: true }]);
    expect(categoryDetails({ id: 'wallpapers', available: true, count: 4, slideshowIntervalSec: 5 })).toEqual([
      { key: 'nexus2Welcome.import.category.wallpapers.detail', params: { count: 4 }, plural: true },
      { key: 'nexus2Welcome.import.category.wallpapers.slideshow', params: { count: 5 }, plural: true },
    ]);
  });

  it('names the Q-Series face with its translated widget name', () => {
    expect(categoryDetails({ id: 'q60Face', available: true, face: 'monitoring', stashedFaces: 1 })).toEqual([{
      key: 'nexus2Welcome.import.category.q60Face.detail',
      params: { face: 'monitoring', stashed: 1 },
      paramKeys: { face: 'panel.widget.monitoring' },
    }]);
  });

  it('names only the Q-Series face when no other faces are saved', () => {
    expect(categoryDetails({ id: 'q60Face', available: true, face: 'clock', stashedFaces: 0 }))
      .toEqual([{ key: 'panel.widget.clock', params: {} }]);
  });

  it('formats gallerySources as a count only, regardless of missing', () => {
    expect(categoryDetails({ id: 'gallerySources', available: true, count: 5, missing: 2 }))
      .toEqual([{ key: 'nexus2Welcome.import.category.gallerySources.detail', params: { count: 5 } }]);
  });

  it('leaves out a Gallery widget that has no photo sources', () => {
    expect(categoryDetails({ id: 'gallerySources', available: true, count: 0, missing: 0 })).toEqual([]);
  });

  it('falls back to the generic detail key for language, which the web never groups', () => {
    expect(categoryDetails({ id: 'language', available: true, value: 'it' }))
      .toEqual([{ key: 'nexus2Welcome.import.category.other.detail', params: { id: 'language' } }]);
  });

  it('falls back to the generic detail key for a category id this build does not model', () => {
    const futureCategory = { id: 'futureCategory', available: true } as unknown as Nexus2PreviewCategory;
    expect(categoryDetails(futureCategory))
      .toEqual([{ key: 'nexus2Welcome.import.category.other.detail', params: { id: 'futureCategory' } }]);
  });
});

describe('applyStatusKey', () => {
  it('resolves a known status', () => {
    expect(applyStatusKey('applied')).toBe('nexus2Welcome.import.result.status.applied');
    expect(applyStatusKey('needsConfirm')).toBe('nexus2Welcome.import.result.status.needsConfirm');
  });

  it('falls back to the generic unknown-status key for a status this build does not model', () => {
    expect(applyStatusKey('futureStatus')).toBe('nexus2Welcome.import.result.status.unknown');
  });
});

describe('applyDetailKey', () => {
  it('resolves the documented no-q60-record hint', () => {
    expect(applyDetailKey('no-q60-record')).toBe('nexus2Welcome.import.result.detail.noQ60Record');
  });

  it('falls back to the generic detail key for an unknown hint', () => {
    expect(applyDetailKey('some-future-hint')).toBe('nexus2Welcome.import.result.detail.generic');
  });
});

const PREVIEW: Nexus2PreviewResponse = {
  available: true,
  profileName: 'Default',
  categories: [
    { id: 'appearance', available: true, accentColor: '#ff0000', background: null },
    { id: 'y70Layout', available: false, pages: 0, widgets: 0, mappedWidgets: 0, droppedTypes: [] },
    { id: 'wallpapers', available: true, count: 2 },
    { id: 'language', available: true, value: 'it' },
  ],
};

describe('availableCategories', () => {
  it('keeps only categories marked available', () => {
    expect(availableCategories(PREVIEW).map(c => c.id)).toEqual(['appearance', 'wallpapers', 'language']);
  });

  it('is empty for a null preview', () => {
    expect(availableCategories(null)).toEqual([]);
  });
});

describe('IMPORT_GROUPS', () => {
  it('groups exactly the seven wire categories into three groups, excluding language', () => {
    const allWireIds = IMPORT_GROUPS.flatMap(g => g.wireIds);
    expect(allWireIds.sort()).toEqual(['appearance', 'fanCurves', 'gallerySources', 'q60Face', 'rotation', 'wallpapers', 'y70Layout'].sort());
  });

  it('y70Panel carries y70Layout, appearance, and gallerySources', () => {
    const y70 = IMPORT_GROUPS.find(g => g.id === 'y70Panel');
    expect(y70?.wireIds.slice().sort()).toEqual(['appearance', 'gallerySources', 'y70Layout'].sort());
  });

  it('q60Panel carries q60Face, wallpapers, and rotation', () => {
    const q60 = IMPORT_GROUPS.find(g => g.id === 'q60Panel');
    expect(q60?.wireIds.slice().sort()).toEqual(['q60Face', 'rotation', 'wallpapers'].sort());
  });
});

describe('visibleImportGroups / defaultSelectedGroupIds', () => {
  it('shows a group when at least one of its wire categories is available', () => {
    // appearance is available -> y70Panel shows even though y70Layout/gallerySources are absent.
    expect(visibleImportGroups(PREVIEW).map(g => g.id)).toEqual(['y70Panel', 'q60Panel']);
  });

  it('hides a group when none of its wire categories are available', () => {
    const preview: Nexus2PreviewResponse = {
      available: true,
      profileName: null,
      categories: [{ id: 'appearance', available: false, accentColor: null, background: null }],
    };
    expect(visibleImportGroups(preview)).toEqual([]);
  });

  it('pre-selects every visible group', () => {
    expect(defaultSelectedGroupIds(PREVIEW)).toEqual(new Set(['y70Panel', 'q60Panel']));
  });

  it('is empty for a null preview', () => {
    expect(visibleImportGroups(null)).toEqual([]);
    expect(defaultSelectedGroupIds(null)).toEqual(new Set());
  });
});

describe('groupDetailParts', () => {
  it('builds the positive detail parts of every available member category', () => {
    const y70 = IMPORT_GROUPS.find(g => g.id === 'y70Panel')!;
    expect(groupDetailParts(PREVIEW, y70)).toEqual([
      { key: 'nexus2Welcome.import.category.appearance.detail', params: { accent: '#ff0000' } },
    ]);
  });

  it('is empty for a group with no available members', () => {
    const q60 = IMPORT_GROUPS.find(g => g.id === 'q60Panel')!;
    const preview: Nexus2PreviewResponse = {
      available: true,
      profileName: null,
      categories: [{ id: 'q60Face', available: false, face: null, stashedFaces: 0 }],
    };
    expect(groupDetailParts(preview, q60)).toEqual([]);
  });
});

describe('selectedWireIds', () => {
  it('expands a checked group to only its available wire ids', () => {
    expect(selectedWireIds(PREVIEW, new Set(['y70Panel']))).toEqual(['appearance']);
  });

  it('never includes an unchecked group', () => {
    expect(selectedWireIds(PREVIEW, new Set(['q60Panel']))).toEqual(['wallpapers']);
  });

  it('is empty when no group is checked', () => {
    expect(selectedWireIds(PREVIEW, new Set())).toEqual([]);
  });

  it('is empty for a null preview', () => {
    expect(selectedWireIds(null, new Set(['y70Panel', 'q60Panel']))).toEqual([]);
  });
});

describe('groupResultSummaries', () => {
  it('is empty for null results', () => {
    expect(groupResultSummaries(null)).toEqual([]);
  });

  it('rolls a clean group up to applied', () => {
    const results: Nexus2ApplyResult[] = [
      { id: 'appearance', status: 'applied', detail: null },
      { id: 'gallerySources', status: 'skipped', detail: null },
    ];
    expect(groupResultSummaries(results)).toEqual([
      { groupId: 'y70Panel', labelKey: 'nexus2Welcome.import.group.y70Panel.label', status: 'applied', issues: [] },
    ]);
  });

  it('worst status wins: failed beats needsConfirm beats applied beats skipped', () => {
    const results: Nexus2ApplyResult[] = [
      { id: 'q60Face', status: 'applied', detail: null },
      { id: 'wallpapers', status: 'failed', detail: 'patch-failed' },
      { id: 'rotation', status: 'needsConfirm', detail: 'layout-customized' },
    ];
    const [summary] = groupResultSummaries(results);
    expect(summary.groupId).toBe('q60Panel');
    expect(summary.status).toBe('failed');
  });

  it('collects only failed/needsConfirm members as issues', () => {
    const results: Nexus2ApplyResult[] = [
      { id: 'q60Face', status: 'applied', detail: null },
      { id: 'wallpapers', status: 'failed', detail: 'patch-failed' },
      { id: 'rotation', status: 'needsConfirm', detail: 'layout-customized' },
    ];
    const [summary] = groupResultSummaries(results);
    expect(summary.issues.map(i => i.id).sort()).toEqual(['rotation', 'wallpapers']);
  });

  it('omits a group with no results sent for it', () => {
    const results: Nexus2ApplyResult[] = [{ id: 'appearance', status: 'applied', detail: null }];
    expect(groupResultSummaries(results).map(s => s.groupId)).toEqual(['y70Panel']);
  });
});

describe('allApplyResultsClean', () => {
  it('is false when any result needs confirmation or failed', () => {
    expect(allApplyResultsClean([
      { id: 'appearance', status: 'applied', detail: null },
      { id: 'y70Layout', status: 'needsConfirm', detail: null },
    ])).toBe(false);
    expect(allApplyResultsClean([{ id: 'appearance', status: 'applied', detail: null }])).toBe(true);
    expect(allApplyResultsClean([{ id: 'appearance', status: 'skipped', detail: null }])).toBe(true);
    expect(allApplyResultsClean([])).toBe(false);
    expect(allApplyResultsClean(null)).toBe(false);
  });
});

const FAN = 'nexus2Welcome.import.category.fanCurves';
const FAN_GROUP = IMPORT_GROUPS.find(g => g.id === 'fanCurves')!;

const MIXED_FAN_CURVES: Nexus2PreviewCategory = {
  id: 'fanCurves',
  available: true,
  count: 2,
  otherProfiles: 1,
  fanCurves: [
    {
      name: 'Quiet', kind: 'graph', status: 'import', minimumRaised: true,
      targets: [
        { label: 'Front 1', status: 'import' },
        { label: 'Front 2', status: 'import' },
        { label: 'Pump', status: 'skip', reason: 'pumpKept' },
        { label: 'Odd', status: 'skip', reason: 'futureCode' },
      ],
    },
    { name: 'Hot', kind: 'linear', status: 'skip', reason: 'unsafeCurve', minimumRaised: false, targets: [] },
  ],
};

describe('importHeaderKeys', () => {
  const y70: Nexus2PreviewCategory = { id: 'y70Layout', available: true, pages: 1, widgets: 1, mappedWidgets: 1, droppedTypes: [] };
  const preview = (...categories: Nexus2PreviewCategory[]) => ({ available: true, profileName: null, categories });
  const skippedFan: Nexus2PreviewCategory = {
    id: 'fanCurves', available: false, count: 0,
    fanCurves: [{ name: 'Hot', kind: 'linear', status: 'skip', reason: 'unsafeCurve', minimumRaised: false, targets: [] }],
  };
  it('keeps the personalization header when no fan curves group is importable', () => {
    expect(importHeaderKeys(preview(y70))).toEqual({ titleKey: 'nexus2Welcome.import.title', descriptionKey: 'nexus2Welcome.import.description' });
  });
  it('uses the fan curves header when only fan curves is importable', () => {
    expect(importHeaderKeys(preview(MIXED_FAN_CURVES))).toEqual({ titleKey: 'nexus2Welcome.import.title.fanCurves', descriptionKey: 'nexus2Welcome.import.description.fanCurves' });
  });
  it('uses the combined header when both are importable', () => {
    expect(importHeaderKeys(preview(y70, MIXED_FAN_CURVES))).toEqual({ titleKey: 'nexus2Welcome.import.title.both', descriptionKey: 'nexus2Welcome.import.description.both' });
  });
  it('uses a neutral header when nothing is importable', () => {
    const noted: Nexus2PreviewCategory = { id: 'fanCurves', available: false, count: 0, fanCurvesNote: 'noUserCurves' };
    expect(importHeaderKeys(preview(noted))).toEqual({ titleKey: 'nexus2Welcome.import.title.none', descriptionKey: 'nexus2Welcome.import.description.none' });
    expect(importHeaderKeys(preview(skippedFan)).titleKey).toBe('nexus2Welcome.import.title.none');
    expect(importHeaderKeys(null).titleKey).toBe('nexus2Welcome.import.title.none');
  });
  it('ignores a note-only or all-skipped fan group', () => {
    const noted: Nexus2PreviewCategory = { id: 'fanCurves', available: false, count: 0, fanCurvesNote: 'noUserCurves' };
    expect(importHeaderKeys(preview(y70, noted)).titleKey).toBe('nexus2Welcome.import.title');
    expect(importHeaderKeys(preview(y70, skippedFan)).titleKey).toBe('nexus2Welcome.import.title');
  });
});

describe('fan curves', () => {
  it('maps known reasons and degrades unknown or missing ones to the generic line', () => {
    expect(fanCurveReasonKey('pumpKept')).toBe(`${FAN}.reason.pumpKept`);
    expect(fanCurveReasonKey('followedChannel')).toBe(`${FAN}.reason.followedChannel`);
    expect(fanCurveReasonKey('guardHealed')).toBe(`${FAN}.reason.guardHealed`);
    expect(fanCurveReasonKey('futureCode')).toBe(`${FAN}.reason.unknown`);
    expect(fanCurveReasonKey(undefined)).toBe(`${FAN}.reason.unknown`);
  });

  it('lists imported curves with their fans, skipped curves and targets with a reason, and the profile line', () => {
    const lines = categoryDetails(MIXED_FAN_CURVES);
    expect(lines).toEqual([
      { key: `${FAN}.detail`, params: { count: 2 }, plural: true },
      { key: '', params: {}, user: { name: 'Quiet', list: ['Front 1', 'Front 2'] } },
      { key: `${FAN}.curveRaised`, params: {}, user: { name: 'Quiet' } },
      { key: `${FAN}.reason.pumpKept`, params: {}, user: { name: 'Pump' } },
      { key: `${FAN}.reason.unknown`, params: {}, user: { name: 'Odd' } },
      { key: `${FAN}.reason.unsafeCurve`, params: {}, user: { name: 'Hot' } },
      { key: `${FAN}.otherProfiles`, params: {} },
    ]);
  });

  it('treats an imported curve with no importable target as noTargets', () => {
    const lines = categoryDetails({
      id: 'fanCurves', available: true, count: 1,
      fanCurves: [{ name: 'X', kind: 'flat', status: 'import', minimumRaised: false, targets: [{ label: 'P', status: 'skip', reason: 'pumpKept' }] }],
    });
    expect(lines[1]).toEqual({ key: `${FAN}.reason.noTargets`, params: {}, user: { name: 'X' } });
  });

  it('starts checked only when available, and shows an unavailable group only with a note', () => {
    const avail = { available: true, profileName: null, categories: [MIXED_FAN_CURVES] };
    expect(defaultSelectedGroupIds(avail).has('fanCurves')).toBe(true);
    expect(selectedWireIds(avail, new Set(['fanCurves']))).toEqual(['fanCurves']);

    const noted = { available: true, profileName: null, categories: [{ id: 'fanCurves' as const, available: false, count: 0, fanCurvesNote: 'recommendedMode' as const }] };
    expect(visibleImportGroups(noted)).toEqual([FAN_GROUP]);
    expect(defaultSelectedGroupIds(noted).size).toBe(0);
    expect(unavailableGroupNoteKey(noted, FAN_GROUP)).toBe(`${FAN}.note.recommendedMode`);
    expect(selectedWireIds(noted, new Set(['fanCurves']))).toEqual([]);

    const off = { available: true, profileName: null, categories: [{ id: 'fanCurves' as const, available: false, count: 0, fanCurvesNote: 'coolingDisabled' as const }] };
    expect(unavailableGroupNoteKey(off, FAN_GROUP)).toBe(`${FAN}.note.coolingDisabled`);
    expect(visibleImportGroups(off)).toEqual([FAN_GROUP]);

    const bare = { available: true, profileName: null, categories: [{ id: 'fanCurves' as const, available: false, count: 0 }] };
    expect(visibleImportGroups(bare)).toEqual([]);
  });

  it('shows an all-skipped group with each curve reason and no count line', () => {
    const allSkipped = {
      available: true, profileName: null,
      categories: [{
        id: 'fanCurves' as const, available: false, count: 0,
        fanCurves: [{ name: 'Hot', kind: 'linear' as const, status: 'skip' as const, reason: 'unsafeCurve', minimumRaised: false, targets: [] }],
      }],
    };
    expect(visibleImportGroups(allSkipped)).toEqual([FAN_GROUP]);
    expect(defaultSelectedGroupIds(allSkipped).size).toBe(0);
    expect(groupDetailParts(allSkipped, FAN_GROUP)).toEqual([{ key: `${FAN}.reason.unsafeCurve`, params: {}, user: { name: 'Hot' } }]);
    expect(selectedWireIds(allSkipped, new Set(['fanCurves']))).toEqual([]);
  });

  it('keeps user names out of the translated params', () => {
    const lines = categoryDetails({
      id: 'fanCurves', available: true, count: 1,
      fanCurves: [{ name: '{fans} $&', kind: 'graph', status: 'import', minimumRaised: false, targets: [{ label: '{name}', status: 'import' }] }],
    });
    for (const line of lines) expect(JSON.stringify(line.params)).not.toMatch(/\$&|\{fans\}|\{name\}/);
    expect(lines[1].user).toEqual({ name: '{fans} $&', list: ['{name}'] });
  });

  it('fills templates in one pass and keeps locale punctuation', () => {
    expect(fillTemplate('{name} : {reason}', { name: '{reason} $&', reason: 'ok' })).toBe('{reason} $& : ok');
    expect(fillTemplate('{name}\uFF1A{reason}', { name: 'A', reason: 'B' })).toBe('A\uFF1AB');
    expect(fillTemplate('{unknown} {name}', { name: 'N' })).toBe('{unknown} N');
  });

  it('formats lists with the locale conjunction', () => {
    expect(formatList(['A', 'B', 'C'], 'en')).toBe('A, B, and C');
    expect(formatList(['A'], 'en')).toBe('A');
  });

  it('carries the applied count into the group summary', () => {
    const summaries = groupResultSummaries([{ id: 'fanCurves', status: 'applied', detail: null, count: 3 }]);
    expect(summaries).toEqual([expect.objectContaining({ groupId: 'fanCurves', status: 'applied', count: 3 })]);
  });
});
