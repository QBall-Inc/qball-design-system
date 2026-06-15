import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { Toaster, toast } from "./Toast";

// Sonner's store is module-global; clear it between cases so counts don't leak.
afterEach(() => {
  toast.dismiss();
});

describe("Toast", () => {
  const variants = [
    { name: "info", call: toast.info, cls: "toast--info" },
    { name: "success", call: toast.success, cls: "toast--success" },
    { name: "warning", call: toast.warning, cls: "toast--warning" },
    { name: "error", call: toast.error, cls: "toast--error" },
  ] as const;

  it.each(variants)(
    "renders the $name variant with its accent class + a non-color icon cue (AC-8)",
    async ({ name, call, cls }) => {
      render(<Toaster />);
      call(`${name} headline`, { description: `${name} detail` });

      const text = await screen.findByText(`${name} headline`);
      const card = text.closest<HTMLElement>(".toast");
      if (card === null) throw new Error("expected a .toast card");
      expect(card.className.split(" ")).toContain(cls);
      // The icon is the redundant non-color cue (finance-color-plus-cue).
      expect(card.querySelector(".toast__icon svg")).not.toBeNull();
      expect(within(card).getByText(`${name} detail`)).not.toBeNull();
    },
  );

  it("stacks three concurrent toasts in the DOM (AC-9)", async () => {
    render(<Toaster visibleToasts={5} />);
    // Clean slate, defending against store leakage from earlier cases.
    toast.dismiss();
    await waitFor(() => {
      expect(document.querySelectorAll(".toast")).toHaveLength(0);
    });

    toast.info("Stack one");
    toast.info("Stack two");
    toast.info("Stack three");

    await waitFor(() => {
      expect(document.querySelectorAll(".toast")).toHaveLength(3);
    });
  });

  it("auto-dismisses after the configured duration (AC-10)", async () => {
    render(<Toaster />);
    toast.info("Ephemeral", { duration: 60 });

    await screen.findByText("Ephemeral");
    await waitFor(
      () => {
        expect(screen.queryByText("Ephemeral")).toBeNull();
      },
      { timeout: 3000 },
    );
  });

  it("dismisses via the manual close button (AC-10)", async () => {
    const user = userEvent.setup();
    render(<Toaster />);
    // Infinity → no auto-dismiss; only the manual close removes it.
    toast.error("Sticky failure", { duration: Infinity });

    const card = (await screen.findByText("Sticky failure")).closest(".toast");
    if (card === null) throw new Error("expected a .toast card");
    await user.click(within(card as HTMLElement).getByRole("button", { name: "Dismiss" }));

    await waitFor(() => {
      expect(screen.queryByText("Sticky failure")).toBeNull();
    });
  });

  it("positions the Toaster top-center by default (AC-7)", async () => {
    render(<Toaster />);
    // Sonner only mounts its region once a toast exists.
    toast.info("anchor");
    await screen.findByText("anchor");

    const region = document.querySelector("[data-sonner-toaster]");
    expect(region).not.toBeNull();
    expect(region?.getAttribute("data-y-position")).toBe("top");
    expect(region?.getAttribute("data-x-position")).toBe("center");
  });
});
