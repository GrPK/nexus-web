import { QUAD_VERT, adaptGlsl } from '../../../../hooks/useShaderRenderer';
import { compileStudio, type StudioRecipe } from './studioCompiler';

const THUMB_WIDTH = 320;
const THUMB_HEIGHT = 180;
// A moment into the animation, so time-driven blocks are not at their t=0 phase.
const THUMB_TIME = 7;

/** One still frame of the recipe as a JPEG data URL, or null without WebGL2 or on a compile failure. */
export function renderStudioThumbnail(recipe: StudioRecipe): string | null {
  const { frag, params } = compileStudio(recipe);
  const canvas = document.createElement('canvas');
  canvas.width = THUMB_WIDTH;
  canvas.height = THUMB_HEIGHT;
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, alpha: false });
  if (!gl) return null;
  try {
    const shader = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };
    const vs = shader(gl.VERTEX_SHADER, QUAD_VERT);
    const fs = shader(gl.FRAGMENT_SHADER, adaptGlsl(frag));
    if (!vs || !fs) return null;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.viewport(0, 0, THUMB_WIDTH, THUMB_HEIGHT);
    gl.useProgram(prog);

    const set = (name: string, value: number) => {
      const loc = gl.getUniformLocation(prog, name);
      if (loc) gl.uniform1f(loc, value);
    };
    gl.uniform2f(gl.getUniformLocation(prog, 'u_resolution'), THUMB_WIDTH, THUMB_HEIGHT);
    set('u_time', THUMB_TIME);
    set('u_speed', recipe.speed / 50);
    set('u_hue', recipe.hue);
    set('u_colorize', 0);
    set('u_saturation', recipe.saturation);
    set('u_contrast', recipe.contrast);
    for (const [name, value] of Object.entries(params)) set(name, value);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
