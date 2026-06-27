import {
  Button,
  Modal,
  ModalClose,
  ModalContent,
  ModalTitle,
  Stat,
  Switch,
} from "@qball-inc/react";

/**
 * Throwaway consumer surface. Distribution prongs under test:
 *
 *  1. The four representative components — <Button>, <Switch>,
 *     <Modal>, and <Stat> — are all rendered
 *     from the tarball-installed @qball-inc/react. Each is a Strategy-2 className
 *     wrapper that ships NO CSS of its own; their `.btn` / `.switch` / `.modal` /
 *     `.stat` styling must arrive entirely from the installed @qball-inc/tokens
 *     component CSS (Strategy-2 delivery; AC-5). Rendering all four proves the
 *     package's exports + types resolve through the published tarball.
 *
 *  2. <Stat direction="up"> emits `.stat__value` (a `var(--font-display)` numeric
 *     display element) and `.stat__delta--up` (a `var(--data-up)` finance color) —
 *     the two concrete component-delivery proofs validate-consumer.sh asserts in
 *     the emitted CSS.
 *
 *  3. <main className="bg-surface"> is CONSUMER-authored markup using a token
 *     utility the OPTIONAL tailwindcss + theme.css path must generate (AC-6). This
 *     is the only Tailwind-utility usage, and it is on consumer markup, never on a
 *     component.
 */
export function App() {
  return (
    <main className="bg-surface">
      <h1>QBall DS — consumer distribution fixture</h1>

      <Button variant="primary">Primary action</Button>

      <Switch defaultChecked>Notifications</Switch>

      <Stat label="AAPL" value="184.30" unit="USD" direction="up" delta="+8.4%" />

      <Modal defaultOpen>
        <ModalContent aria-label="Consumer fixture dialog">
          <div className="modal__head">
            <ModalTitle>Create alert</ModalTitle>
            <ModalClose />
          </div>
          <div className="modal__body">A modal rendered from the packed tarball.</div>
        </ModalContent>
      </Modal>
    </main>
  );
}
