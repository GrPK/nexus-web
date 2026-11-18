// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { calendarApp } from '../widgets/calendar';
import { touchEditorHintFor } from './touchEditorHint';

const meta = { touchEditorHintKey: 'some.key' };

describe('touchEditorHintFor', () => {
  it('applies on every panel surface, pointer-driven ones included', () => {
    for (const surface of ['y70', 'phone', 'q60', 'monitor', 'lcd-round'] as const) {
      expect(touchEditorHintFor(meta, surface)).toBe('some.key');
    }
  });

  it('stays off the desktop dashboard', () => {
    expect(touchEditorHintFor(meta, 'desktop')).toBeNull();
  });

  it('is opt-in per app', () => {
    expect(touchEditorHintFor({}, 'y70')).toBeNull();
    expect(touchEditorHintFor(undefined, 'y70')).toBeNull();
  });

  it('is declared by the calendar widget', () => {
    expect(touchEditorHintFor(calendarApp.meta, 'y70')).toBe('panel.widget.calendar.touchEditorHint');
  });
});
