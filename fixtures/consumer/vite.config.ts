import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Throwaway consumer build. `cssCodeSplit: false` emits a single stylesheet
// under dist/assets so the validate script can grep one deterministic file for
// the Strategy-2 .btn delivery (AC-5), the optional bg-surface utility (AC-6),
// and a single Tailwind base block (AC-7).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    cssCodeSplit: false,
  },
});
