// Graph smoke specimen: proves the deployed gallery can load the BUILT
// @qball-inc/elements graph entry, lazily load its `three` peer, and render a
// real WebGL frame. Reports through window globals so the browser gate asserts
// on a signal, not on console output:
//   window.__smokeOk = true        — a frame rendered and read back as red
//   window.__smokeErr = "<message>" — anything failed
import { ENTRY, loadThree } from "../packages/elements/dist/graph/index.js";

async function run() {
  if (ENTRY !== "graph") throw new Error(`unexpected entry marker: ${String(ENTRY)}`);
  const THREE = await loadThree();
  const canvas = document.getElementById("smoke");
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error("canvas#smoke missing");

  const renderer = new THREE.WebGLRenderer({ canvas, preserveDrawingBuffer: true });
  renderer.setClearColor(0x000000, 1);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
  camera.position.z = 1;
  scene.add(
    new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ color: 0xff0000 })),
  );
  renderer.render(scene, camera);

  const gl = renderer.getContext();
  const px = new Uint8Array(4);
  gl.readPixels(canvas.width >> 1, canvas.height >> 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  if (px[0] < 200 || px[1] > 40 || px[2] > 40) {
    throw new Error(`centre pixel not red: rgba(${px.join(",")})`);
  }
  window.__smokeOk = true;
}

run().catch((err) => {
  window.__smokeErr = err instanceof Error ? err.message : String(err);
});
