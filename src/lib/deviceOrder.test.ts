import { describe, expect, it } from 'vitest';
import { mergeDeviceOrder } from './deviceOrder';

describe('mergeDeviceOrder', () => {
  it('keeps an undetected saved id in its slot while detected ones are reordered', () => {
    expect(mergeDeviceOrder(['a', 'gone', 'b'], ['b', 'a'])).toEqual(['b', 'gone', 'a']);
  });

  it('adds detected devices that were never saved', () => {
    expect(mergeDeviceOrder([], ['x', 'y'])).toEqual(['x', 'y']);
    expect(mergeDeviceOrder(['gone'], ['x', 'y'])).toEqual(['gone', 'x', 'y']);
  });

  it('keeps several undetected ids in their relative order', () => {
    expect(mergeDeviceOrder(['g1', 'a', 'g2', 'b'], ['b', 'a'])).toEqual(['g1', 'b', 'g2', 'a']);
  });

  it('keeps every undetected id when only one device is visible', () => {
    expect(mergeDeviceOrder(['a', 'b', 'c', 'gone'], ['a'])).toEqual(['a', 'b', 'c', 'gone']);
  });
});
