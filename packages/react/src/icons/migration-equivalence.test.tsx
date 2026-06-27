import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import type { ReactElement } from "react";

import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BellOff,
  Check,
  CircleCheckBig,
  CircleX,
  Clock,
  Eye,
  EyeOff,
  Info,
  Moon,
  Plus,
  SearchIcon,
  Sun,
  TriangleAlert,
  X,
} from "./generated";

import { ToolUseIndicator } from "../ai/ToolUseIndicator";
import { Composer } from "../ai/Composer";
import { NotificationBell } from "../chrome/AppBar";
import { CommandDock } from "../chrome/CommandDock";
import { NotificationCenter } from "../chrome/NotificationCenter";
import type { NotificationKind } from "../chrome/NotificationCenter";
import { ThemeToggle } from "../chrome/ThemeToggle";
import { Callout } from "../overlay/Callout";
import { AlertModal, Modal, ModalClose, ModalContent, ModalTitle } from "../overlay/Modal";
import { Toaster, toast } from "../overlay/Toast";
import { SecretInput } from "../primitives/SecretInput";

/**
 * §10 DOM-equivalence gate (the icon-system glyph migration).
 *
 * For every migrated call site, this asserts the rendered icon IS the expected B2
 * generated component — identical geometry (the inner path/circle elements, in emit
 * order), the additive `ic` base class, decorative a11y, and the documented
 * `size`→`width`/`height` + `strokeWidth` — sitting in the SAME CSS wrapper as before
 * (`.modal__x` / `.callout__icon` / `.tuf__glyph` / `.ic-sun` / `.notif__mark--*` …).
 *
 * Under the owner-recertified Option-1 migration (adopt B2 / current-Lucide as the
 * canonical look — SD1 D-08), the original gate's
 * "emitted path-d byte-preserved" is re-scoped to "renders the RIGHT B2 icon": the
 * geometry is compared against the standalone B2 render (the single source of truth
 * for the recertified shape), while the wrapper class + element placement + the
 * decorative idiom stay byte-for-byte. The additive `width`/`height` + `class="ic"`
 * the migrated icons gain over the bare inline SVGs are the B1 AC-1 decision — an
 * EXPECTED delta the gate pins, not a regression.
 *
 * Built BEFORE the migration (brief §notes: "Do NOT begin migration until the
 * per-component equivalence harness exists"): it is RED against the pre-migration
 * hand-rolled glyphs (no `ic` class; divergent geometry for the ~19 refreshed shapes)
 * and GREEN once each site imports its B2 component with the documented props.
 *
 * Carve-outs (NOT migrated, asserted untouched): the animated `StockyIcon` mascot and
 * all data-viz SVG.
 */

const noop = (): void => {};

/** The inner geometry (paths/circles/lines, in emit order) of a standalone B2 icon. */
function geometryOf(icon: ReactElement): string {
  const { container } = render(icon);
  const svg = container.querySelector("svg");
  if (svg === null) throw new Error("expected the B2 icon to render an <svg>");
  return svg.innerHTML;
}

interface IconExpectation {
  /** The B2 component the slot must render (geometry source of truth). */
  expected: ReactElement;
  /** Documented render size → asserted `width`/`height`. */
  size: number;
  /** Documented stroke width. Omit for the IconBase default (1.5). */
  strokeWidth?: number;
}

/**
 * Assert `svg` is the migrated B2 icon: the additive `ic` base class, decorative
 * a11y, the documented size + strokeWidth on the fixed 24 viewBox, and geometry
 * identical to the standalone B2 render.
 */
function expectMigratedIcon(svg: Element | null | undefined, exp: IconExpectation): void {
  if (svg === null || svg === undefined) {
    throw new Error("expected a migrated <svg> in the slot, found none");
  }
  // The additive IconBase signature (the B1/B2 AC-1 decision — an expected delta).
  expect(svg.getAttribute("class")).toBe("ic");
  expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
  expect(svg.getAttribute("width")).toBe(String(exp.size));
  expect(svg.getAttribute("height")).toBe(String(exp.size));
  expect(svg.getAttribute("stroke-width")).toBe(String(exp.strokeWidth ?? 1.5));
  // Every migrated call site is decorative (adjacent text / a labelled control
  // carries the meaning) — the stroke idiom + aria-hidden must survive.
  expect(svg.getAttribute("fill")).toBe("none");
  expect(svg.getAttribute("stroke")).toBe("currentColor");
  expect(svg.getAttribute("aria-hidden")).toBe("true");
  expect(svg.getAttribute("role")).toBeNull();
  // The recertified B2 geometry, in emit order.
  expect(svg.innerHTML).toBe(geometryOf(exp.expected));
}

describe("Icon migration DOM-equivalence gate", () => {
  describe("C1 · overlay", () => {
    describe("Modal", () => {
      it("ModalClose renders the B2 X (.modal__x, 16px)", () => {
        render(
          <Modal open>
            <ModalContent aria-label="Demo">
              <ModalTitle>Demo</ModalTitle>
              <ModalClose />
            </ModalContent>
          </Modal>,
        );
        const svg = document.querySelector(".modal__x svg");
        expectMigratedIcon(svg, { expected: <X />, size: 16 });
      });

      it("AlertModal warn badge renders the B2 TriangleAlert (17px, stroke 1.6)", () => {
        render(<AlertModal open title="Delete alert" description="This cannot be undone." />);
        const svg = document.querySelector(".modal__head svg");
        expectMigratedIcon(svg, { expected: <TriangleAlert />, size: 17, strokeWidth: 1.6 });
      });
    });

    describe("Callout", () => {
      const cases: { variant: "warning" | "error" | "info" | "neutral"; expected: ReactElement }[] =
        [
          { variant: "warning", expected: <TriangleAlert /> },
          { variant: "error", expected: <CircleX /> },
          { variant: "info", expected: <Info /> },
          { variant: "neutral", expected: <Info /> },
        ];

      it.each(cases)(
        "CalloutIcon[$variant] renders its B2 glyph (.callout__icon, 17px, stroke 1.6)",
        ({ variant, expected }) => {
          render(<Callout variant={variant}>body</Callout>);
          const svg = document.querySelector(".callout__icon svg");
          expectMigratedIcon(svg, { expected, size: 17, strokeWidth: 1.6 });
        },
      );

      it("the dismiss CloseIcon renders the B2 X (.callout__x, 14px, stroke 1.6)", () => {
        render(
          <Callout variant="info" dismissible>
            body
          </Callout>,
        );
        const svg = document.querySelector(".callout__x svg");
        expectMigratedIcon(svg, { expected: <X />, size: 14, strokeWidth: 1.6 });
      });
    });

    describe("Toast", () => {
      afterEach(() => {
        toast.dismiss();
      });

      const cases: {
        variant: "success" | "warning" | "error" | "info";
        call: (title: string) => string | number;
        expected: ReactElement;
      }[] = [
        { variant: "success", call: toast.success, expected: <CircleCheckBig /> },
        { variant: "warning", call: toast.warning, expected: <TriangleAlert /> },
        { variant: "error", call: toast.error, expected: <CircleX /> },
        { variant: "info", call: toast.info, expected: <Info /> },
      ];

      it.each(cases)(
        "VariantIcon[$variant] renders its B2 glyph (.toast__icon, 17px, stroke 1.6)",
        async ({ variant, call, expected }) => {
          render(<Toaster />);
          call(`${variant} headline`);
          const card = (await screen.findByText(`${variant} headline`)).closest(".toast");
          if (card === null) throw new Error("expected a .toast card");
          expectMigratedIcon(card.querySelector(".toast__icon svg"), {
            expected,
            size: 17,
            strokeWidth: 1.6,
          });
        },
      );

      it("the close button renders the B2 X (.toast__x, 14px, stroke 1.6)", async () => {
        render(<Toaster />);
        toast.info("closable");
        const card = (await screen.findByText("closable")).closest(".toast");
        if (card === null) throw new Error("expected a .toast card");
        expectMigratedIcon(card.querySelector(".toast__x svg"), {
          expected: <X />,
          size: 14,
          strokeWidth: 1.6,
        });
      });
    });
  });

  describe("C2 · chrome + primitives", () => {
    describe("ThemeToggle", () => {
      it("renders the B2 Sun + Moon in their swap wrappers (19px)", () => {
        const { container } = render(<ThemeToggle />);
        expectMigratedIcon(container.querySelector(".ic-sun svg"), { expected: <Sun />, size: 19 });
        expectMigratedIcon(container.querySelector(".ic-moon svg"), {
          expected: <Moon />,
          size: 19,
        });
      });
    });

    describe("AppBar / NotificationBell", () => {
      it("renders the B2 Bell in the .iconbtn (19px)", () => {
        const { container } = render(<NotificationBell />);
        expectMigratedIcon(container.querySelector(".iconbtn svg"), { expected: <Bell />, size: 19 });
      });
    });

    describe("NotificationCenter", () => {
      const marks: { kind: NotificationKind; expected: ReactElement; strokeWidth: number }[] = [
        { kind: "up", expected: <ArrowUpRight />, strokeWidth: 1.8 },
        { kind: "down", expected: <ArrowDownRight />, strokeWidth: 1.8 },
        { kind: "warn", expected: <TriangleAlert />, strokeWidth: 1.7 },
        { kind: "info", expected: <Info />, strokeWidth: 1.7 },
      ];

      it.each(marks)(
        "MarkIcon[$kind] renders its B2 glyph (.notif__mark--$kind, 15px)",
        async ({ kind, expected, strokeWidth }) => {
          const user = userEvent.setup();
          render(
            <NotificationCenter
              items={[
                {
                  id: "1",
                  kind,
                  title: "row",
                  timestamp: "now",
                  read: true,
                  onMarkRead: noop,
                },
              ]}
            />,
          );
          await user.click(screen.getByRole("button", { name: "Notifications" }));
          await screen.findByText("row");
          expectMigratedIcon(document.querySelector(`.notif__mark--${kind} svg`), {
            expected,
            size: 15,
            strokeWidth,
          });
        },
      );

      it("the empty-state renders the B2 BellOff (26px, stroke 1.4)", async () => {
        const user = userEvent.setup();
        render(<NotificationCenter items={[]} />);
        await user.click(screen.getByRole("button", { name: "Notifications" }));
        await screen.findByText("No notifications");
        expectMigratedIcon(document.querySelector(".notif__list svg"), {
          expected: <BellOff />,
          size: 26,
          strokeWidth: 1.4,
        });
      });
    });

    describe("SecretInput", () => {
      function renderSecret(): void {
        render(
          <SecretInput value="" onChange={noop} onSet={noop} onRemove={noop} label="API key" />,
        );
      }

      it("the reveal toggle shows the B2 Eye while masked (16px)", () => {
        renderSecret();
        expectMigratedIcon(document.querySelector(".input-wrap__affix svg"), {
          expected: <Eye />,
          size: 16,
        });
      });

      it("the reveal toggle shows the B2 EyeOff once revealed (16px)", async () => {
        const user = userEvent.setup();
        renderSecret();
        await user.click(screen.getByRole("button", { name: "Show secret" }));
        expectMigratedIcon(document.querySelector(".input-wrap__affix svg"), {
          expected: <EyeOff />,
          size: 16,
        });
      });
    });
  });

  describe("C3 · ai", () => {
    describe("Composer", () => {
      it("the send button renders the B2 ArrowRight, NOT a paper-plane (.term__send, 16px, stroke 1.6)", () => {
        const { container } = render(<Composer onSend={noop} />);
        expectMigratedIcon(container.querySelector(".term__send svg"), {
          expected: <ArrowRight />,
          size: 16,
          strokeWidth: 1.6,
        });
      });
    });

    describe("ToolUseIndicator", () => {
      const glyphs: { state: "pending" | "success" | "error" | "partial"; expected: ReactElement }[] =
        [
          { state: "pending", expected: <Clock /> },
          { state: "success", expected: <Check /> },
          { state: "error", expected: <CircleX /> },
          { state: "partial", expected: <TriangleAlert /> },
        ];

      it.each(glyphs)(
        "the $state leading glyph renders its B2 icon (.tuf__glyph, 16px)",
        ({ state, expected }) => {
          const { container } = render(<ToolUseIndicator state={state} skill="news-research" />);
          expectMigratedIcon(container.querySelector(".tuf__glyph svg"), { expected, size: 16 });
        },
      );
    });
  });

  describe("C4 · CommandDock", () => {
    it("the Search trigger renders the B2 SearchIcon (21px)", () => {
      render(<CommandDock />);
      const svg = screen.getByRole("button", { name: "Search" }).querySelector("svg");
      expectMigratedIcon(svg, { expected: <SearchIcon />, size: 21 });
    });

    it("the Add trigger renders the B2 Plus (22px, stroke 1.8)", () => {
      render(<CommandDock />);
      const svg = screen.getByRole("button", { name: "Add stock" }).querySelector("svg");
      expectMigratedIcon(svg, { expected: <Plus />, size: 22, strokeWidth: 1.8 });
    });

    it("CARVE-OUT: the animated StockyIcon mascot is untouched (.stocky-icon, 32 viewBox, no ic class)", () => {
      render(<CommandDock />);
      const stocky = screen
        .getByRole("button", { name: "Ask Stocky" })
        .querySelector(".stocky-icon svg");
      if (stocky === null) throw new Error("expected the .stocky-icon mascot svg");
      // The mascot is hand-rolled brand art on a 32 viewBox with no IconBase `ic`
      // class — it must NOT be migrated to the 24-viewBox B2 set.
      expect(stocky.getAttribute("viewBox")).toBe("0 0 32 32");
      expect(stocky.getAttribute("class")).toBeNull();
    });
  });
});
