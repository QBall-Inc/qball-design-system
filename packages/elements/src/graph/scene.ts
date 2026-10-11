// The three.js layer of the canvas: point sprites + two edge classes with depth
// fog, an orbit camera, screen-space picking and projection. Ported from the
// prototype engine (design bundle graph/graph-canvas.js L265-335, L462-514).
// `three` arrives as an argument (loaded lazily by the canvas), never imported
// at module evaluation, and the renderer comes from an injectable factory so
// the DOM-level tests can run the real scene with a stand-in renderer.

import type * as ThreeNS from "three";
import { EdgeRole, hubBrightening, type CanvasModel, type EdgeStyle } from "./canvas-model";
import { classRole, type Palette, type PaletteRole } from "./palette";
import { LINE_FRAGMENT, LINE_VERTEX, POINT_FRAGMENT, POINT_VERTEX } from "./shaders";

export type Three = typeof ThreeNS;

/** The subset of THREE.WebGLRenderer the canvas uses. */
export interface RendererLike {
  readonly domElement: HTMLCanvasElement;
  setPixelRatio(ratio: number): void;
  setSize(width: number, height: number, updateStyle?: boolean): void;
  render(scene: ThreeNS.Scene, camera: ThreeNS.Camera): void;
  dispose(): void;
}

export type RendererFactory = (three: Three) => RendererLike;

/** The production renderer. Throws when the browser cannot create a WebGL context. */
export const createWebGLRenderer: RendererFactory = (three) =>
  new three.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });

/** Camera defaults and limits (prototype DEFAULTS + the design record's zoom range). */
export const CAMERA = Object.freeze({
  fov: 50,
  near: 10,
  far: 12000,
  distance: 950,
  theta: 0.6,
  phi: 1.15,
  minDistance: 220,
  maxDistance: 6000,
  fogSpan: [0.6, 2.1] as const,
  phiMargin: 0.15,
  /** Orbit speed, radians per dragged pixel. */
  orbitPerPixel: 0.0045,
});

/** Screen-space pick radius: `max(min, size * PICK_SIZE_SCALE / depth + PICK_PADDING)` px (prototype). */
const PICK_MIN_FINE = 11;
const PICK_MIN_COARSE = 20;
const PICK_SIZE_SCALE = 230;
const PICK_PADDING = 6;

export interface ProjectedPoint {
  x: number;
  y: number;
  /** In front of the camera and within the (slightly padded) viewport. */
  onScreen: boolean;
}

export interface GraphScene {
  readonly canvas: HTMLCanvasElement;
  /** Marks node positions changed (after a sim step or a drag) and syncs edges. */
  positionsChanged(): void;
  /** Writes node colours/dims and both edge styles into the GPU buffers. */
  applyStyle(selected: number, dims: Float32Array, typed: EdgeStyle, comention: EdgeStyle): void;
  resize(width: number, height: number): void;
  render(): void;
  orbit(dx: number, dy: number): void;
  pan(dx: number, dy: number): void;
  /** Multiplies the camera distance, clamped to the zoom range. */
  zoom(factor: number): void;
  /** Sets the camera distance, clamped to the zoom range. */
  setDistance(distance: number): void;
  readonly distance: number;
  /** True when the orbit target is off the origin (Esc's second press recenters). */
  isPanned(): boolean;
  recenter(): void;
  project(index: number, width: number, height: number): ProjectedPoint;
  /**
   * Nearest node to (x, y) in canvas pixels within its hit radius, or -1.
   * Nodes whose dim is below 0.5 are skipped when `skipDimmed` is set.
   */
  pick(x: number, y: number, width: number, height: number, options: PickOptions): number;
  /** The camera-facing plane through a node, and the world point under (x, y) on it. */
  dragPoint(
    index: number,
    x: number,
    y: number,
    width: number,
    height: number,
  ): ThreeNS.Vector3 | null;
  /** Disposes every geometry and material this scene created (the renderer is the caller's). */
  dispose(): void;
}

export interface PickOptions {
  coarse: boolean;
  skipDimmed: boolean;
  dims: Float32Array;
}

/** Linear-RGB triples per palette role, plus the role a class maps to. */
function paletteColors(three: Three, palette: Palette): Record<PaletteRole, ThreeNS.Color> {
  const out = {} as Record<PaletteRole, ThreeNS.Color>;
  for (const role of Object.keys(palette) as PaletteRole[])
    out[role] = new three.Color(palette[role]);
  return out;
}

export function createScene(
  three: Three,
  renderer: RendererLike,
  model: CanvasModel,
  positions: Float32Array,
  palette: Palette,
  pixelRatio: number,
): GraphScene {
  const colors = paletteColors(three, palette);
  const n = model.count;
  const disposables: { dispose(): void }[] = [];

  renderer.setPixelRatio(Math.min(pixelRatio, 2));
  const canvas = renderer.domElement;
  canvas.className = "gc-canvas";

  const scene = new three.Scene();
  const camera = new three.PerspectiveCamera(CAMERA.fov, 1, CAMERA.near, CAMERA.far);
  let radius: number = CAMERA.distance;
  let theta: number = CAMERA.theta;
  let phi: number = CAMERA.phi;
  const target = new three.Vector3(0, 0, 0);
  const uniforms = {
    fogColor: { value: colors.bg.clone() },
    fogNear: { value: radius * CAMERA.fogSpan[0] },
    fogFar: { value: radius * CAMERA.fogSpan[1] },
    bg: { value: colors.bg.clone() },
  };

  // ---- nodes ----
  const pointGeometry = new three.BufferGeometry();
  disposables.push(pointGeometry);
  const positionAttr = new three.BufferAttribute(positions, 3).setUsage(three.DynamicDrawUsage);
  pointGeometry.setAttribute("position", positionAttr);
  pointGeometry.setAttribute("aSize", new three.BufferAttribute(model.sizes, 1));
  const colorAttr = new three.BufferAttribute(new Float32Array(n * 3), 3);
  pointGeometry.setAttribute("aColor", colorAttr);
  const dimAttr = new three.BufferAttribute(new Float32Array(n), 1).setUsage(
    three.DynamicDrawUsage,
  );
  pointGeometry.setAttribute("aDim", dimAttr);
  const pointMaterial = new three.ShaderMaterial({
    uniforms,
    vertexShader: POINT_VERTEX,
    fragmentShader: POINT_FRAGMENT,
    transparent: true,
    depthWrite: false,
  });
  disposables.push(pointMaterial);
  scene.add(new three.Points(pointGeometry, pointMaterial));

  // ---- edges ----
  const edgeObject = (count: number): ThreeNS.LineSegments<ThreeNS.BufferGeometry> => {
    const geometry = new three.BufferGeometry();
    geometry.setAttribute(
      "position",
      new three.BufferAttribute(new Float32Array(count * 6), 3).setUsage(three.DynamicDrawUsage),
    );
    geometry.setAttribute("aColor", new three.BufferAttribute(new Float32Array(count * 6), 3));
    geometry.setAttribute(
      "aAlpha",
      new three.BufferAttribute(new Float32Array(count * 2), 1).setUsage(three.DynamicDrawUsage),
    );
    const material = new three.ShaderMaterial({
      uniforms,
      vertexShader: LINE_VERTEX,
      fragmentShader: LINE_FRAGMENT,
      transparent: true,
      depthWrite: false,
    });
    disposables.push(geometry, material);
    return new three.LineSegments(geometry, material);
  };
  const typedLines = edgeObject(model.typed.length);
  const comentionLines = edgeObject(model.comention.length);
  scene.add(comentionLines);
  scene.add(typedLines);
  const edgeSets = [
    [typedLines, model.typed],
    [comentionLines, model.comention],
  ] as const;

  const syncEdgePositions = (): void => {
    for (const [lines, edges] of edgeSets) {
      const attr = lines.geometry.getAttribute("position") as ThreeNS.BufferAttribute;
      const p = attr.array as Float32Array;
      for (let k = 0; k < edges.length; k++) {
        const e = edges[k]!;
        p.set(positions.subarray(e.a * 3, e.a * 3 + 3), k * 6);
        p.set(positions.subarray(e.b * 3, e.b * 3 + 3), k * 6 + 3);
      }
      attr.needsUpdate = true;
      lines.geometry.computeBoundingSphere();
    }
  };

  // Rest colours: class colour, the biggest hubs brightened toward the hub token.
  const restColor = (i: number, out: ThreeNS.Color): ThreeNS.Color => {
    out.copy(colors[classRole(model.nodes[i]!.cls)]);
    const br = hubBrightening(model.typedDegree[i]!);
    if (br > 0) out.lerp(colors.hub, br);
    return out;
  };

  const edgeColor = (role: number, isTyped: boolean): ThreeNS.Color => {
    if (role === EdgeRole.litTyped) return colors.signal;
    if (role === EdgeRole.litComention) return colors.amber;
    return isTyped ? colors.anno : colors.muted;
  };

  const tmp = new three.Color();
  const applyStyle: GraphScene["applyStyle"] = (selected, dims, typed, comention) => {
    const c = colorAttr.array as Float32Array;
    for (let i = 0; i < n; i++) {
      // A selection drops hub whitening (prototype L428): class colours, selected amber.
      if (selected >= 0)
        tmp.copy(i === selected ? colors.amber : colors[classRole(model.nodes[i]!.cls)]);
      else restColor(i, tmp);
      c[i * 3] = tmp.r;
      c[i * 3 + 1] = tmp.g;
      c[i * 3 + 2] = tmp.b;
    }
    colorAttr.needsUpdate = true;
    (dimAttr.array as Float32Array).set(dims);
    dimAttr.needsUpdate = true;
    for (const [lines, edges, style, isTyped] of [
      [typedLines, model.typed, typed, true],
      [comentionLines, model.comention, comention, false],
    ] as const) {
      const colorBuf = lines.geometry.getAttribute("aColor") as ThreeNS.BufferAttribute;
      const alphaBuf = lines.geometry.getAttribute("aAlpha") as ThreeNS.BufferAttribute;
      const ca = colorBuf.array as Float32Array;
      const aa = alphaBuf.array as Float32Array;
      for (let k = 0; k < edges.length; k++) {
        const col = edgeColor(style.role[k]!, isTyped);
        ca[k * 6] = ca[k * 6 + 3] = col.r;
        ca[k * 6 + 1] = ca[k * 6 + 4] = col.g;
        ca[k * 6 + 2] = ca[k * 6 + 5] = col.b;
        aa[k * 2] = aa[k * 2 + 1] = style.alpha[k]!;
      }
      colorBuf.needsUpdate = true;
      alphaBuf.needsUpdate = true;
    }
  };

  const updateCamera = (): void => {
    camera.position.set(
      target.x + radius * Math.sin(phi) * Math.cos(theta),
      target.y + radius * Math.cos(phi),
      target.z + radius * Math.sin(phi) * Math.sin(theta),
    );
    camera.lookAt(target);
    camera.updateMatrixWorld();
    uniforms.fogNear.value = radius * CAMERA.fogSpan[0];
    uniforms.fogFar.value = radius * CAMERA.fogSpan[1];
  };
  updateCamera();

  const clampDistance = (d: number): number =>
    Math.min(CAMERA.maxDistance, Math.max(CAMERA.minDistance, d));

  const v = new three.Vector3();
  const project = (index: number, width: number, height: number): ProjectedPoint => {
    v.fromArray(positions, index * 3).project(camera);
    return {
      x: (v.x * 0.5 + 0.5) * width,
      y: (-v.y * 0.5 + 0.5) * height,
      onScreen: v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05,
    };
  };

  return {
    canvas,
    positionsChanged() {
      positionAttr.needsUpdate = true;
      syncEdgePositions();
    },
    applyStyle,
    resize(width, height) {
      renderer.setSize(width, height);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
    },
    render() {
      renderer.render(scene, camera);
    },
    orbit(dx, dy) {
      theta += dx * CAMERA.orbitPerPixel;
      phi = Math.min(
        Math.PI - CAMERA.phiMargin,
        Math.max(CAMERA.phiMargin, phi + dy * CAMERA.orbitPerPixel),
      );
      updateCamera();
    },
    pan(dx, dy) {
      const scale =
        (2 * radius * Math.tan((camera.fov * Math.PI) / 360)) / Math.max(canvas.clientHeight, 1);
      const right = new three.Vector3();
      const up = new three.Vector3();
      camera.matrix.extractBasis(right, up, new three.Vector3());
      target.addScaledVector(right, -dx * scale).addScaledVector(up, dy * scale);
      updateCamera();
    },
    zoom(factor) {
      radius = clampDistance(radius * factor);
      updateCamera();
    },
    setDistance(distance) {
      radius = clampDistance(distance);
      updateCamera();
    },
    get distance() {
      return radius;
    },
    isPanned() {
      return target.lengthSq() > 1;
    },
    recenter() {
      target.set(0, 0, 0);
      updateCamera();
    },
    project,
    pick(x, y, width, height, options) {
      let best = -1;
      let bestD = Infinity;
      const minRadius = options.coarse ? PICK_MIN_COARSE : PICK_MIN_FINE;
      for (let i = 0; i < n; i++) {
        if (options.skipDimmed && options.dims[i]! < 0.5) continue;
        v.fromArray(positions, i * 3);
        const depth = camera.position.distanceTo(v);
        v.project(camera);
        if (v.z > 1) continue;
        const dx = (v.x * 0.5 + 0.5) * width - x;
        const dy = (-v.y * 0.5 + 0.5) * height - y;
        const d2 = dx * dx + dy * dy;
        const r = Math.max(minRadius, (model.sizes[i]! * PICK_SIZE_SCALE) / depth + PICK_PADDING);
        if (d2 < r * r && d2 < bestD) {
          bestD = d2;
          best = i;
        }
      }
      return best;
    },
    dragPoint(index, x, y, width, height) {
      const plane = new three.Plane().setFromNormalAndCoplanarPoint(
        camera.getWorldDirection(new three.Vector3()).negate(),
        new three.Vector3().fromArray(positions, index * 3),
      );
      const ray = new three.Raycaster();
      ray.setFromCamera(new three.Vector2((x / width) * 2 - 1, -(y / height) * 2 + 1), camera);
      return ray.ray.intersectPlane(plane, new three.Vector3());
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
