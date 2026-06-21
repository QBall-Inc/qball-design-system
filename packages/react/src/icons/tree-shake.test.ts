// @vitest-environment node
// esbuild requires real Node TextEncoder/Uint8Array globals; jsdom's break its
// startup invariant. This is a pure build assertion — no DOM — so run it in node.
import { build } from "esbuild";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Resolve disk paths from process.cwd() (= packages/react under `vitest run`);
// fileURLToPath(import.meta.url) throws in vitest's runner.
const GENERATED = resolve(process.cwd(), "src/icons/generated");

/** The first path `d` of a generated icon (track-qualified, e.g. `ui/funnel`,
 * `ai/bot`, `brand/github`) — a unique fingerprint for bundle checks. */
function firstPathD(relPath: string): string {
  const src = readFileSync(resolve(GENERATED, `${relPath}.tsx`), "utf8");
  const d = src.match(/d="([^"]+)"/)?.[1];
  if (!d) throw new Error(`no path geometry found in ${relPath}.tsx`);
  return d;
}

describe("icon tree-shaking (real esbuild build)", () => {
  // This is the observable proof of the §6 export decision (named exports shake
  // off the single barrel) AND the documented re-open trigger for the ./icons
  // subpath: if this fails on a real build, the subpath earns its keep.
  it("importing one icon from the hub does not pull another icon's geometry", async () => {
    const hub = resolve(GENERATED, "index.ts");
    const result = await build({
      stdin: {
        contents: `import { Funnel } from ${JSON.stringify(hub)};\nexport const used = Funnel;`,
        resolveDir: GENERATED,
        loader: "ts",
      },
      bundle: true,
      write: false,
      format: "esm",
      treeShaking: true,
      jsx: "automatic",
      external: ["react", "react-dom", "react/jsx-runtime"],
      logLevel: "silent",
    });

    const out = result.outputFiles[0];
    if (!out) throw new Error("esbuild produced no output");
    const code = out.text;

    // The imported icon's geometry IS present...
    expect(code).toContain(firstPathD("ui/funnel"));
    // ...and an un-imported icon's unique geometry is shaken OUT — across ALL three
    // tracks on the now-comprehensive barrel (UI + AI + brand).
    expect(code).not.toContain(firstPathD("ui/trending-up"));
    expect(code).not.toContain(firstPathD("ai/bot"));
    expect(code).not.toContain(firstPathD("brand/github"));
  });
});
