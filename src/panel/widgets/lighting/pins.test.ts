import { describe, expect, it } from 'vitest';
import {
  animatePin, colorPin, MIRROR_PIN, nearestFillKey, paletteColorPin, pinGridKey, pinHex, pinnedNamesByEffect,
  pinSignature, pinStripPick, selectionPin, staticLookPin, withPins,
} from './pins';
import { defaultStateFor } from '../../../types/lighting';
import { paletteColor, paletteKey } from '../../../types/lightingPalette';

describe('withPins', () => {
  it('sets and clears without touching other devices', () => {
    const a = withPins({ x: animatePin('plasma') }, ['y'], animatePin('aurora'));
    expect(Object.keys(a)).toEqual(['x', 'y']);
    expect(Object.keys(withPins(a, ['x'], null))).toEqual(['y']);
  });

  it('replaces whatever pin a device held', () => {
    const a = withPins({ x: animatePin('plasma') }, ['x'], MIRROR_PIN);
    expect(a.x).toEqual({ kind: 'mirror' });
  });

  it('returns the same object when nothing changes', () => {
    const pin = animatePin('plasma');
    const pins = { x: pin };
    expect(withPins(pins, ['x'], pin)).toBe(pins);
    expect(withPins(pins, ['z'], null)).toBe(pins);
  });
});

describe('pin builders', () => {
  it('a static look pin carries the whole look and its slot', () => {
    const state = { ...defaultStateFor('stripes'), intensity: 0.5, hue: 2, saturation: -1 };
    expect(staticLookPin('stripes', 3, state)).toMatchObject({
      kind: 'static', effect: 'stripes', slot: 3, intensity: 0.5, hue: 1, saturation: 0,
    });
  });

  it('a colour pin is a flat fill with the colour', () => {
    expect(colorPin('#ff0000')).toMatchObject({ kind: 'static', effect: 'flat', color: '#ff0000', hue: 0, saturation: 1 });
  });

  it('a palette pin carries the swatch hue and saturation', () => {
    const c = paletteColor('red-3')!;
    expect(paletteColorPin(c)).toMatchObject({ effect: 'flat', color: c.hex, hue: c.h, saturation: c.s });
  });

  it('an animate pin carries only the shader, a mirror pin nothing', () => {
    expect(animatePin('aurora')).toEqual({ kind: 'animate', effect: 'aurora' });
    expect(MIRROR_PIN).toEqual({ kind: 'mirror' });
  });
});

describe('selectionPin', () => {
  const pins = { a: animatePin('plasma'), b: animatePin('plasma'), c: animatePin('aurora'), m: MIRROR_PIN };

  it('is none for an empty selection or devices that all follow the global mode', () => {
    expect(selectionPin(pins, [])).toEqual({ kind: 'none' });
    expect(selectionPin(pins, ['x', 'y'])).toEqual({ kind: 'none' });
  });

  it('names the pin every selected device wears', () => {
    expect(selectionPin(pins, ['a', 'b'])).toEqual({ kind: 'pin', pin: animatePin('plasma') });
    expect(selectionPin(pins, ['m'])).toEqual({ kind: 'pin', pin: MIRROR_PIN });
  });

  it('is mixed when pins differ, or a pinned device sits beside a following one', () => {
    expect(selectionPin(pins, ['a', 'c'])).toEqual({ kind: 'mixed' });
    expect(selectionPin(pins, ['a', 'x'])).toEqual({ kind: 'mixed' });
    expect(selectionPin(pins, ['x', 'a'])).toEqual({ kind: 'mixed' });
  });

  it('counts the same effect on two presets as a disagreement', () => {
    const state = defaultStateFor('stripes');
    const two = { a: staticLookPin('stripes', 0, state), b: staticLookPin('stripes', 1, state) };
    expect(selectionPin(two, ['a', 'b'])).toEqual({ kind: 'mixed' });
    expect(pinSignature(two.a)).not.toBe(pinSignature(two.b));
  });
});

describe('grid key and strip pick', () => {
  it('a flat colour resolves to its palette swatch, a pattern to its effect', () => {
    const c = paletteColor('red-3')!;
    expect(pinGridKey(paletteColorPin(c))).toBe(paletteKey('red-3'));
    expect(pinGridKey(animatePin('plasma'))).toBe('plasma');
  });

  it('a mirror pin has no strip fallback', () => {
    expect(pinStripPick(MIRROR_PIN)).toBeNull();
    expect(pinStripPick(animatePin('plasma'))).toMatchObject({ key: 'plasma', slot: 0 });
  });

  it('reads a static pin\'s colour from the colour or the hue', () => {
    expect(pinHex(colorPin('#123456'))).toBe('#123456');
    expect(pinHex({ kind: 'static', effect: 'stripes', hue: 0, saturation: 1 }).toLowerCase()).toBe('#ff0000');
  });
});

describe('pinnedNamesByEffect', () => {
  const pins = {
    a: animatePin('plasma'), b: animatePin('plasma'), c: animatePin('aurora'),
    d: { kind: 'static' as const, effect: 'stripes' }, e: colorPin('#ff0000'), m: MIRROR_PIN,
  };
  const names: Record<string, string> = { a: 'Fan A', b: 'Fan B', c: 'Strip', d: 'Hub', e: 'Pump' };

  it('lists animate pins by shader, with device names', () => {
    const m = pinnedNamesByEffect(pins, 'animate', id => names[id]);
    expect(m.get('plasma')).toEqual(['Fan A', 'Fan B']);
    expect(m.get('aurora')).toEqual(['Strip']);
    expect(m.has('stripes')).toBe(false);
  });

  it('lists static pattern pins, leaving flat colours to the palette', () => {
    const m = pinnedNamesByEffect(pins, 'static', id => names[id]);
    expect([...m.keys()]).toEqual(['stripes']);
  });

  it('drops devices it has no name for', () => {
    const m = pinnedNamesByEffect(pins, 'animate', id => (id === 'a' ? 'Fan A' : undefined));
    expect(m.get('plasma')).toEqual(['Fan A']);
    expect(m.has('aurora')).toBe(false);
  });
});

describe('nearestFillKey', () => {
  it('picks the closest of the solid fills', () => {
    expect(nearestFillKey('#ff0000')).toBe('simplered');
    expect(nearestFillKey('#fafafa')).toBe('simplewhite');
    expect(nearestFillKey('#0010ee')).toBe('simpleblue');
  });
});
