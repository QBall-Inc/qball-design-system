import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  AlertModal,
  Modal,
  ModalClose,
  ModalContent,
  ModalDescription,
  ModalTitle,
  ModalTrigger,
} from "./Modal";

/** A controlled Modal with a trigger, head (title/desc/close), body, and footer. */
function TestModal(props: { closeOnEscape?: boolean; closeOnOverlayClick?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Modal open={open} onOpenChange={setOpen}>
      <ModalTrigger>Open</ModalTrigger>
      <ModalContent {...props}>
        <div className="modal__head">
          <div>
            <ModalTitle>Create alert</ModalTitle>
            <ModalDescription>AAPL · Apple Inc.</ModalDescription>
          </div>
          <ModalClose />
        </div>
        <div className="modal__body">
          <input aria-label="Threshold" defaultValue="200.00" />
        </div>
        <div className="modal__foot">
          <ModalClose asChild>
            <button type="button">Cancel</button>
          </ModalClose>
          <button type="button">Save alert</button>
        </div>
      </ModalContent>
    </Modal>
  );
}

describe("Modal", () => {
  it("opens from the trigger and closes via the head close button (lifecycle)", async () => {
    const user = userEvent.setup();
    render(<TestModal />);

    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Open" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Create alert")).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("paints the shipped .modal panel over a .scrim overlay (AC-1/AC-2 structure)", async () => {
    const user = userEvent.setup();
    render(<TestModal />);
    await user.click(screen.getByRole("button", { name: "Open" }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog.className.split(" ")).toContain("modal");
    // The scrim overlay (var(--color-scrim)) is the no-shadow lift partner.
    expect(document.querySelector(".scrim")).not.toBeNull();
  });

  it("locks body scroll while open and releases it on close (AC-4)", async () => {
    const user = userEvent.setup();
    render(<TestModal />);
    expect(document.body.hasAttribute("data-scroll-locked")).toBe(false);

    await user.click(screen.getByRole("button", { name: "Open" }));
    await screen.findByRole("dialog");
    expect(document.body.hasAttribute("data-scroll-locked")).toBe(true);

    await user.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(document.body.hasAttribute("data-scroll-locked")).toBe(false);
  });

  it("traps focus inside the open dialog and restores it to the trigger on close (AC-5)", async () => {
    const user = userEvent.setup();
    render(<TestModal />);

    const trigger = screen.getByRole("button", { name: "Open" });
    await user.click(trigger);
    const dialog = await screen.findByRole("dialog");

    // Focus moved into the dialog (Radix FocusScope), not left on the body.
    expect(dialog.contains(document.activeElement)).toBe(true);

    // Tabbing repeatedly never escapes the dialog.
    for (let i = 0; i < 6; i++) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }

    // Escape closes and focus returns to the trigger.
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(document.activeElement).toBe(trigger);
  });

  it("closes on Escape by default (AC-6)", async () => {
    const user = userEvent.setup();
    render(<TestModal />);
    await user.click(screen.getByRole("button", { name: "Open" }));
    await screen.findByRole("dialog");

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("suppresses Escape close when closeOnEscape={false} (AC-6 override)", async () => {
    const user = userEvent.setup();
    render(<TestModal closeOnEscape={false} />);
    await user.click(screen.getByRole("button", { name: "Open" }));
    await screen.findByRole("dialog");

    await user.keyboard("{Escape}");
    // Give any (suppressed) close a chance to run, then assert still open.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole("dialog")).not.toBeNull();
  });

  it("closes on overlay (scrim) click by default (AC-6)", async () => {
    const user = userEvent.setup();
    render(<TestModal />);
    await user.click(screen.getByRole("button", { name: "Open" }));
    await screen.findByRole("dialog");

    const scrim = document.querySelector(".scrim");
    if (scrim === null) throw new Error("expected a .scrim overlay");
    await user.click(scrim);
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("suppresses overlay click close when closeOnOverlayClick={false} (AC-6 override)", async () => {
    const user = userEvent.setup();
    render(<TestModal closeOnOverlayClick={false} />);
    await user.click(screen.getByRole("button", { name: "Open" }));
    await screen.findByRole("dialog");

    const scrim = document.querySelector(".scrim");
    if (scrim === null) throw new Error("expected a .scrim overlay");
    await user.click(scrim);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole("dialog")).not.toBeNull();
  });

  it("emits zero shadow style in component source (FR4 mechanical no-shadow gate)", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, "Modal.tsx"), "utf8");
    // Match applied shadows (a CSS `box-shadow:` declaration or a `boxShadow`
    // inline-style property), not prose mentions of the no-shadow rule. The
    // forbidden token is assembled at runtime so this assertion does not itself
    // trip the AST-scoped DESIGN_DENY eslint gate (which also lints test files);
    // that gate is the canonical mechanical guard this test mirrors.
    const cssShadow = new RegExp(["box", "shadow"].join("-") + "\\s*:", "i");
    expect(src).not.toMatch(cssShadow);
    expect(src).not.toMatch(/\bboxShadow\b/);
  });
});

describe("AlertModal", () => {
  it("confirms a destructive action via the destructive button and closes (AC-1)", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <AlertModal
        defaultOpen
        title="Remove AAPL?"
        description="This deletes the symbol and its 2 active alerts."
        confirmLabel="Remove"
        onConfirm={onConfirm}
      />,
    );

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Remove AAPL?")).not.toBeNull();
    // Destructive cue is the .btn--destructive class, not color alone.
    const confirm = within(dialog).getByRole("button", { name: "Remove" });
    expect(confirm.className.split(" ")).toContain("btn--destructive");

    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).toBeNull();
    });
  });

  it("cancels without firing onConfirm (AC-1)", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <AlertModal
        defaultOpen
        title="Remove AAPL?"
        description="This deletes the symbol and its 2 active alerts."
        confirmLabel="Remove"
        onConfirm={onConfirm}
      />,
    );
    await screen.findByRole("alertdialog");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onConfirm).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).toBeNull();
    });
  });
});
