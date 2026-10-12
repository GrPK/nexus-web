import { describe, expect, it } from 'vitest';
import type { MonitoringEventKind } from '../../../../api/monitoringEvents';
import { eventKindLabel } from './monitoringEventLabels';

const t = (key: string) => key;

describe('eventKindLabel', () => {
  it('uses the kind own label', () => {
    expect(eventKindLabel(t, 'usb-attach')).toBe('monitoring.events.kind.usb-attach');
  });

  it('falls back to the generic label for a kind this build does not know', () => {
    expect(eventKindLabel(t, 'future-kind' as MonitoringEventKind)).toBe('monitoring.events.kind.custom');
  });
});
