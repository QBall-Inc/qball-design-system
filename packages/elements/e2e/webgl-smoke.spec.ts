// WebGL smoke (RQ-9 mitigation): proves headless Chromium can render a real
// three.js frame via SwiftShader. The page loads the installed three build over
// an intercepted origin (no dev server), renders a solid red full-view plane on
// a black clear colour, and reads the centre pixel back from the GL buffer.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { expect, test } from "@playwright/test";

const ORIGIN = "http://elements.test";
const THREE_BUILD_DIR = dirname(createRequire(import.meta.url).resolve("three"));

const PAGE = `<!doctype html>
<html>
  <body style="margin:0">
    <canvas id="c" width="64" height="64"></canvas>
    <script type="importmap">{ "imports": { "three": "/three/three.module.js" } }</script>
    <script type="module">
      import * as THREE from "three";
      try {
        const canvas = document.getElementById("c");
        const renderer = new THREE.WebGLRenderer({ canvas, preserveDrawingBuffer: true });
        renderer.setClearColor(0x000000, 1);
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
        camera.position.z = 1;
        scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ color: 0xff0000 })));
        renderer.render(scene, camera);
        const gl = renderer.getContext();
        const px = new Uint8Array(4);
        gl.readPixels(32, 32, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        window.__smoke = { ok: true, webgl2: renderer.capabilities.isWebGL2, pixel: Array.from(px) };
      } catch (err) {
        window.__smoke = { ok: false, error: String(err) };
      }
    </script>
  </body>
</html>`;

interface SmokeResult {
  ok: boolean;
  webgl2?: boolean;
  pixel?: number[];
  error?: string;
}

declare global {
  interface Window {
    __smoke?: SmokeResult;
  }
}

test("three.js renders a frame in headless Chromium (SwiftShader)", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));

  await page.route(`${ORIGIN}/**`, async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === "/") {
      await route.fulfill({ contentType: "text/html", body: PAGE });
    } else if (pathname.startsWith("/three/")) {
      const file = join(THREE_BUILD_DIR, basename(pathname));
      await route.fulfill({ contentType: "text/javascript", body: readFileSync(file) });
    } else {
      await route.fulfill({ status: 404, body: "not found" });
    }
  });

  await page.goto(`${ORIGIN}/`);
  await page.waitForFunction(() => window.__smoke !== undefined);
  const result = await page.evaluate(() => window.__smoke);
  if (result === undefined) throw new Error("smoke page did not publish a result");

  expect(pageErrors).toEqual([]);
  expect(result.error).toBeUndefined();
  expect(result.ok).toBe(true);
  expect(result.webgl2).toBe(true);
  const [r, g, b, a] = result.pixel ?? [];
  expect(r).toBeGreaterThan(200);
  expect(g).toBeLessThan(50);
  expect(b).toBeLessThan(50);
  expect(a).toBe(255);
});
