import { describe, expect, it } from 'vitest';
import { CHART_EVENT_ICONS, chartEventIcon } from './TimeSeriesChart';

describe('chartEventIcon', () => {
  it('returns the mapped icon for a known kind', () => {
    expect(chartEventIcon('usb-attach')).toBe(CHART_EVENT_ICONS['usb-attach']);
  });

  it('falls back to the custom icon for a kind this build does not know', () => {
    expect(chartEventIcon('some-future-kind')).toBe(CHART_EVENT_ICONS.custom);
  });
});
