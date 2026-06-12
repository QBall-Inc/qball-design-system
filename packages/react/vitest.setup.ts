import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Unmount and clear the jsdom container after every test so multi-test files
// don't accumulate rendered DOM (otherwise getByRole finds duplicate elements).
afterEach(() => {
  cleanup();
});
