import { describe, expect, it } from 'vitest';
import { shortColumnLabels } from './microColumnLabels';

describe('shortColumnLabels', () => {
  it('strips the trailing words every label shares', () => {
    expect(shortColumnLabels(['Pin 1 Current', 'Pin 2 Current', 'Pin 3 Current'])).toEqual(['Pin 1', 'Pin 2', 'Pin 3']);
    expect(shortColumnLabels(['CPU Temp', 'GPU Temp', 'SSD Temp'])).toEqual(['CPU', 'GPU', 'SSD']);
  });
  it('matches case-insensitively and strips several trailing words', () => {
    expect(shortColumnLabels(['Fan 1 rpm speed', 'Fan 2 RPM Speed'])).toEqual(['Fan 1', 'Fan 2']);
  });
  it('only strips from the end', () => {
    expect(shortColumnLabels(['CPU Temp', 'CPU Load'])).toEqual(['CPU Temp', 'CPU Load']);
    expect(shortColumnLabels(['Core Temp A', 'Core Temp B'])).toEqual(['Core Temp A', 'Core Temp B']);
  });
  it('keeps full labels when stripping would empty or collide', () => {
    expect(shortColumnLabels(['Temp', 'Temp'])).toEqual(['Temp', 'Temp']);
    expect(shortColumnLabels(['CPU Temp', 'Package CPU Temp'])).toEqual(['CPU', 'Package CPU']);
    expect(shortColumnLabels(['A Temp', 'a Temp'])).toEqual(['A Temp', 'a Temp']);
  });
  it('leaves a single label and hidden (empty) labels alone', () => {
    expect(shortColumnLabels(['Pin 1 Current'])).toEqual(['Pin 1 Current']);
    expect(shortColumnLabels(['', ''])).toEqual(['', '']);
  });
});
