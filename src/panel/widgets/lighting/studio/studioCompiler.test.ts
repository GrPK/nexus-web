import { describe, expect, it } from 'vitest';
import { parseShaderParams } from '../../../../lib/shaderParams';
import { STUDIO_BLOCKS, STUDIO_COST_BUDGET, STUDIO_STAGES, STUDIO_STAGE_LIMIT, studioBlock } from './studioBlocks';
import { compileStudio, makeBlock, orderedBlocks, recipeCost, stageCount, type StudioRecipe } from './studioCompiler';
import { STUDIO_STARTERS, mutateRecipe, shuffleRecipe } from './studioRecipes';

const recipeOf = (...types: string[]): StudioRecipe => ({
  v: 1, blocks: types.map(makeBlock), speed: 50, hue: 0, saturation: 1, contrast: 1,
});

function expectValid(r: StudioRecipe) {
  expect(stageCount(r, 'color')).toBe(1);
  expect(stageCount(r, 'pattern')).toBeGreaterThanOrEqual(1);
  expect(recipeCost(r)).toBeLessThanOrEqual(STUDIO_COST_BUDGET);
  for (const stage of STUDIO_STAGES) expect(stageCount(r, stage)).toBeLessThanOrEqual(STUDIO_STAGE_LIMIT[stage]);
}

describe('compileStudio', () => {
  it('declares a hint_range spec for every param value it emits, with the value in range', () => {
    for (const def of STUDIO_BLOCKS) {
      const types = def.stage === 'pattern' ? ['rings', def.type, 'palette'] : def.stage === 'color' ? ['plasma', def.type] : ['plasma', def.type, 'palette'];
      const { frag, params } = compileStudio(recipeOf(...types));
      const specs = new Map(parseShaderParams(frag).map(s => [s.name, s]));
      for (const [name, value] of Object.entries(params)) {
        const spec = specs.get(name);
        expect(spec?.declared, `${def.type}: ${name}`).toBe(true);
        expect(value).toBeGreaterThanOrEqual(spec!.min);
        expect(value).toBeLessThanOrEqual(spec!.max);
      }
      expect(frag).not.toMatch(/\$[a-z]/);
    }
  });

  // Mac desktop GL rejects non-ASCII anywhere in the source, comments included.
  it('emits ASCII-only GLSL', () => {
    const all = recipeOf('warp', 'kaleidoscope', 'cells', 'sparkle', 'contour', 'colors', 'grain');
    expect(compileStudio(all).frag).toMatch(/^[\x20-\x7e\n]*$/);
  });

  it('keeps the shader key when only param values change', () => {
    const r = recipeOf('plasma', 'palette');
    const a = compileStudio(r);
    r.blocks[0].params.scale = 5;
    const b = compileStudio(r);
    expect(b.key).toBe(a.key);
    expect(b.params.u_b0_scale).toBe(5);
  });

  it('changes the key and routes the audio uniform when a param is modulated', () => {
    const r = recipeOf('plasma', 'palette');
    const before = compileStudio(r).key;
    r.blocks[0].mods = { scale: { source: 'beat', amount: -0.25 } };
    const compiled = compileStudio(r);
    expect(compiled.key).not.toBe(before);
    expect(compiled.params.u_b0_scale_m).toBe(-0.25);
    expect(compiled.frag).toContain('u_b0_scale_m * 5.7 * u_audioBeat');
  });

  it('rounds a modulated whole-number param so it never lands between integers', () => {
    const r = recipeOf('kaleidoscope', 'rings', 'palette');
    r.blocks[0].mods = { sides: { source: 'bass', amount: 0.5 } };
    expect(compileStudio(r).frag).toMatch(/floor\(clamp\(u_b0_sides \+ u_b0_sides_m \* [\d.]+ \* u_audioBass, 2\.0, 16\.0\) \+ 0\.5\)/);
  });

  it('clamps out-of-range and non-finite values to the authored range', () => {
    const r = recipeOf('rings', 'palette');
    r.blocks[0].params.count = 999;
    r.blocks[0].params.speed = Number.NaN;
    const { params } = compileStudio(r);
    expect(params.u_b0_count).toBe(40);
    expect(params.u_b0_speed).toBe(1);
  });

  it('orders blocks by stage whatever the array order', () => {
    const r = recipeOf('glow', 'palette', 'rings', 'spin');
    expect(orderedBlocks(r).map(b => studioBlock(b.type)!.stage)).toEqual(['space', 'pattern', 'color', 'finish']);
  });

  it('blends only the second and later patterns', () => {
    const { frag } = compileStudio(recipeOf('rings', 'stripes', 'palette'));
    expect(frag).toContain('v = f;');
    expect(frag).toContain('v = blendV(v, f, u_b1_blend, u_b1_mix);');
    expect(frag).not.toContain('u_b0_blend');
  });
});

describe('studio recipes', () => {
  it('builds valid starters', () => {
    for (const s of STUDIO_STARTERS) expectValid(s.build());
  });

  it('shuffles and mutates into valid recipes', () => {
    for (let i = 0; i < 300; i++) {
      const r = shuffleRecipe();
      expectValid(r);
      expectValid(mutateRecipe(r));
    }
  });
});
