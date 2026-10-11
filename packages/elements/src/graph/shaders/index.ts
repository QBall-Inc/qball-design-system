// GLSL for the canvas, ported verbatim from the prototype engine (design bundle
// graph/graph-canvas.js L139-173). Written in GLSL ES 1.0 style; three's
// ShaderMaterial (glslVersion unset) prefixes the defines that map
// `attribute`/`varying`/`gl_FragColor` onto WebGL2, so no syntax change is
// needed under three 0.186. Fog is computed per fragment from view depth so the
// far side of the cloud sinks into the stage colour.

/** Point sprites: size attenuates with depth; colour mixes toward the stage by (1 - dim), then into fog. */
export const POINT_VERTEX = `
attribute float aSize; attribute vec3 aColor; attribute float aDim;
varying vec3 vColor; varying float vDim; varying float vDepth;
void main(){ vColor=aColor; vDim=aDim;
  vec4 mv = modelViewMatrix * vec4(position,1.0);
  vDepth = -mv.z;
  gl_PointSize = aSize * (460.0 / -mv.z);
  gl_Position = projectionMatrix * mv; }`;

export const POINT_FRAGMENT = `
uniform vec3 fogColor; uniform float fogNear; uniform float fogFar; uniform vec3 bg;
varying vec3 vColor; varying float vDim; varying float vDepth;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  if(length(c)>0.5) discard;
  float fog = smoothstep(fogNear, fogFar, vDepth);
  vec3 col = mix(vColor, bg, 1.0 - vDim);
  col = mix(col, fogColor, fog * 0.85);
  float a = vDim * (1.0 - fog * 0.6);
  if (a < 0.02) discard;
  gl_FragColor = vec4(col, a); }`;

/** Edge segments: per-vertex colour and alpha, faded by fog. */
export const LINE_VERTEX = `
attribute vec3 aColor; attribute float aAlpha;
varying vec3 vColor; varying float vAlpha; varying float vDepth;
void main(){ vColor=aColor; vAlpha=aAlpha;
  vec4 mv = modelViewMatrix * vec4(position,1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv; }`;

export const LINE_FRAGMENT = `
uniform vec3 fogColor; uniform float fogNear; uniform float fogFar;
varying vec3 vColor; varying float vAlpha; varying float vDepth;
void main(){
  float fog = smoothstep(fogNear, fogFar, vDepth);
  float a = vAlpha * (1.0 - fog * 0.9);
  if (a < 0.008) discard;
  gl_FragColor = vec4(mix(vColor, fogColor, fog * 0.7), a); }`;
