import { Button } from "@qball-inc/react";

/**
 * Throwaway consumer surface. Two distribution prongs are under test:
 *
 *  1. <Button> — a WP-B-2.1 className wrapper. Its `.btn` styling must arrive
 *     entirely from the installed @qball-inc/tokens component CSS (Strategy-2
 *     delivery; AC-5). The component ships no CSS of its own.
 *
 *  2. <div className="bg-surface"> — CONSUMER-authored markup using a token
 *     utility that the OPTIONAL tailwindcss + theme.css path must generate
 *     (AC-6). This is the only Tailwind-utility usage, and it is on consumer
 *     markup, never on a component.
 */
export function App() {
  return (
    <main className="bg-surface">
      <h1>QBall DS — consumer distribution fixture</h1>
      <Button variant="primary">Primary action</Button>
    </main>
  );
}
