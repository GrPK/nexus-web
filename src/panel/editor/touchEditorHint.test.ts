// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { calendarApp } from '../widgets/calendar';
import { touchEditorHintFor } from './touchEditorHint';

const meta = { touchEditorHintKey: 'some.key' };

describe('touchEditorHintFor', () => {
  it('applies on touch surfaces, the phone included', () => {
    expect(touchEditorHintFor(meta, 'y70')).toBe('some.key');
    expect(touchEditorHintFor(meta, 'phone')).toBe('some.key');
  });

  it('stays off the desktop and display-only panels', () => {
    expect(touchEditorHintFor(meta, 'desktop')).toBeNull();
    expect(touchEditorHintFor(meta, 'q60')).toBeNull();
  });

  it('follows a monitor\'s digitizer', () => {
    expect(touchEditorHintFor(meta, 'monitor', true)).toBe('some.key');
    expect(touchEditorHintFor(meta, 'monitor', false)).toBeNull();
  });

  it('is opt-in per app', () => {
    expect(touchEditorHintFor({}, 'y70')).toBeNull();
    expect(touchEditorHintFor(undefined, 'y70')).toBeNull();
  });

  it('is declared by the calendar widget', () => {
    expect(touchEditorHintFor(calendarApp.meta, 'y70')).toBe('panel.widget.calendar.touchEditorHint');
  });
});
