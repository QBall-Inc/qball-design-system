// `./sim-worker.inline` has no source file: the build plugin in
// ../../inline-worker.ts answers that import with sim-worker-entry.ts bundled
// into one self-contained script, as a string.
declare const source: string;
export default source;
