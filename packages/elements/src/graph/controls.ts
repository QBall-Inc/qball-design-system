// Pointer and wheel input on the canvas element, ported from the prototype
// engine (design bundle graph/graph-canvas.js L504-607): drag orbits,
// alt/⌘-drag pans, wheel zooms, two-pointer pinch zooms and pans, a still
// click/tap selects (screen-space nearest node), and a mouse drag on a node
// moves it with a gentle pull on its strongest neighbors.

import type { CanvasModel } from "./canvas-model";
import type { GraphScene } from "./scene";

/** A press that moves less than this (px) is a click, not a drag. */
const CLICK_SLOP = 5;
/** Strength of the neighbor pull while dragging a node (prototype k). */
const RELAX = 0.024;
/** Neighbors pulled along by a dragged node. */
const RELAX_NEIGHBORS = 30;
/** Zoom change per wheel delta unit (prototype). */
const WHEEL_ZOOM_PER_DELTA = 0.001;

export interface ControlsContext {
  readonly canvas: HTMLCanvasElement;
  readonly scene: GraphScene;
  readonly model: CanvasModel;
  readonly positions: Float32Array;
  readonly coarse: boolean;
  readonly draggable: boolean;
  /** Current per-node dims (picking skips dimmed nodes while selecting/filtering). */
  dims(): Float32Array;
  /** Whether picking should skip dimmed nodes (a selection or filter is active). */
  focused(): boolean;
  settling(): boolean;
  /** A click/tap landed on node `index` (or on nothing: -1). */
  select(index: number): void;
  /** Pointer hovering node `index` at host-relative (x, y), or -1 for none. */
  hover(index: number, x: number, y: number): void;
  /** Camera or positions changed; schedule a frame. */
  changed(): void;
}

type Mode = "rotate" | "pan" | "drag" | "pinch" | null;

/** Wires the input listeners; returns the remover. */
export function attachControls(ctx: ControlsContext): () => void {
  const { canvas, scene, model, positions } = ctx;
  const pointers = new Map<number, { x: number; y: number }>();
  let mode: Mode = null;
  let lastX = 0;
  let lastY = 0;
  let down: [number, number] | null = null;
  let dragIndex = -1;
  let pinchStart = 0;
  let pinchDistance = 0;
  let pinchMid = { x: 0, y: 0 };
  let suppressTap = false;

  const local = (ev: PointerEvent | WheelEvent): [number, number] => {
    const r = canvas.getBoundingClientRect();
    return [ev.clientX - r.left, ev.clientY - r.top];
  };
  const size = (): [number, number] => {
    const r = canvas.getBoundingClientRect();
    return [r.width, r.height];
  };
  const pickAt = (ev: PointerEvent): number => {
    const [x, y] = local(ev);
    const [w, h] = size();
    return scene.pick(x, y, w, h, {
      coarse: ctx.coarse,
      skipDimmed: ctx.focused(),
      dims: ctx.dims(),
    });
  };

  const onDown = (ev: PointerEvent): void => {
    canvas.setPointerCapture?.(ev.pointerId);
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (pointers.size === 2) {
      const [p1, p2] = [...pointers.values()] as [
        { x: number; y: number },
        { x: number; y: number },
      ];
      mode = "pinch";
      suppressTap = true;
      dragIndex = -1;
      pinchStart = Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1;
      pinchDistance = scene.distance;
      pinchMid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      return;
    }
    suppressTap = false;
    lastX = ev.clientX;
    lastY = ev.clientY;
    down = [ev.clientX, ev.clientY];
    const canDrag = ctx.draggable && ev.pointerType === "mouse" && !ev.altKey && !ev.metaKey;
    const hit = canDrag ? pickAt(ev) : -1;
    if (ev.altKey || ev.metaKey) mode = "pan";
    else if (hit >= 0 && !ctx.settling()) {
      mode = "drag";
      dragIndex = hit;
    } else mode = "rotate";
  };

  const onMove = (ev: PointerEvent): void => {
    if (pointers.has(ev.pointerId)) pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (mode === "pinch") {
      if (pointers.size < 2) return;
      const [p1, p2] = [...pointers.values()] as [
        { x: number; y: number },
        { x: number; y: number },
      ];
      const d = Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1;
      scene.setDistance((pinchDistance * pinchStart) / d);
      const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      scene.pan(mid.x - pinchMid.x, mid.y - pinchMid.y);
      pinchMid = mid;
      ctx.changed();
      return;
    }
    if (mode === null) {
      if (!ctx.settling()) {
        const hit = pickAt(ev);
        const [x, y] = local(ev);
        ctx.hover(hit >= 0 && ctx.dims()[hit]! > 0.5 ? hit : -1, x, y);
      }
      return;
    }
    const dx = ev.clientX - lastX;
    const dy = ev.clientY - lastY;
    lastX = ev.clientX;
    lastY = ev.clientY;
    if (mode === "rotate") scene.orbit(dx, dy);
    else if (mode === "pan") scene.pan(dx, dy);
    else if (mode === "drag" && dragIndex >= 0) {
      const [x, y] = local(ev);
      const [w, h] = size();
      const p = scene.dragPoint(dragIndex, x, y, w, h);
      if (!p) return;
      positions[dragIndex * 3] = p.x;
      positions[dragIndex * 3 + 1] = p.y;
      positions[dragIndex * 3 + 2] = p.z;
      for (const nb of model.adjacency[dragIndex]!.slice(0, RELAX_NEIGHBORS)) {
        if (!nb.typed && nb.w < 2) continue;
        const j = nb.j * 3;
        positions[j] = positions[j]! + (p.x - positions[j]!) * RELAX;
        positions[j + 1] = positions[j + 1]! + (p.y - positions[j + 1]!) * RELAX;
        positions[j + 2] = positions[j + 2]! + (p.z - positions[j + 2]!) * RELAX;
      }
      scene.positionsChanged();
    }
    ctx.changed();
  };

  const onUp = (ev: PointerEvent): void => {
    pointers.delete(ev.pointerId);
    if (mode === "pinch") {
      if (pointers.size < 2) mode = null;
      return;
    }
    if (!suppressTap) {
      const still =
        down !== null && Math.hypot(ev.clientX - down[0], ev.clientY - down[1]) < CLICK_SLOP;
      if (still && mode === "rotate") ctx.select(pickAt(ev));
      else if (still && mode === "drag") ctx.select(dragIndex);
    }
    mode = null;
    dragIndex = -1;
  };

  const onCancel = (ev: PointerEvent): void => {
    pointers.delete(ev.pointerId);
    mode = null;
    dragIndex = -1;
  };

  const onLeave = (): void => {
    if (mode === null) ctx.hover(-1, 0, 0);
  };

  const onWheel = (ev: WheelEvent): void => {
    ev.preventDefault();
    scene.zoom(1 + ev.deltaY * WHEEL_ZOOM_PER_DELTA);
    ctx.changed();
  };

  canvas.style.touchAction = "none";
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onCancel);
  canvas.addEventListener("pointerleave", onLeave);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  return () => {
    canvas.removeEventListener("pointerdown", onDown);
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerup", onUp);
    canvas.removeEventListener("pointercancel", onCancel);
    canvas.removeEventListener("pointerleave", onLeave);
    canvas.removeEventListener("wheel", onWheel);
  };
}
