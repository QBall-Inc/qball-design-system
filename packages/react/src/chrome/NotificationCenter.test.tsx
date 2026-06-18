import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { NotificationCenter } from "./NotificationCenter";
import type { NotificationItemData } from "./NotificationCenter";

const noop = (): void => {};

function item(
  over: Partial<NotificationItemData> & Pick<NotificationItemData, "id">,
): NotificationItemData {
  return {
    kind: "info",
    title: `Item ${over.id}`,
    timestamp: "now",
    read: false,
    onMarkRead: noop,
    ...over,
  };
}

describe("NotificationCenter — bell badge wiring (AppBar contract)", () => {
  it("derives the bell .badge-count from the unread items (AC-11)", () => {
    const { container } = render(
      <NotificationCenter
        items={[
          item({ id: "1", read: false }),
          item({ id: "2", read: false }),
          item({ id: "3", read: true }),
        ]}
      />,
    );
    expect(container.querySelector(".badge-count")?.textContent).toBe("2");
  });

  it("renders no bell badge when every item is read — unread count 0 (AC-12)", () => {
    const { container } = render(<NotificationCenter items={[item({ id: "1", read: true })]} />);
    expect(container.querySelector(".badge-count")).toBeNull();
  });

  it("renders no bell badge when items is empty", () => {
    const { container } = render(<NotificationCenter items={[]} />);
    expect(container.querySelector(".badge-count")).toBeNull();
  });
});

describe("NotificationCenter — panel", () => {
  it("opens the .notif panel on bell click (AC-8)", async () => {
    const user = userEvent.setup();
    render(<NotificationCenter items={[item({ id: "1", title: "NVDA up" })]} />);

    await user.click(screen.getByRole("button", { name: "Notifications" }));
    await screen.findByText("NVDA up");
    expect(document.querySelector(".dropdown.notif")).not.toBeNull();
  });

  it("tints unread rows (.notif__item--unread) and leaves read rows plain (AC-10)", async () => {
    const user = userEvent.setup();
    render(
      <NotificationCenter
        items={[
          item({ id: "1", title: "Unread one", read: false }),
          item({ id: "2", title: "Read one", read: true }),
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Notifications" }));
    await screen.findByText("Unread one");

    const rows = Array.from(document.querySelectorAll(".notif__item"));
    expect(rows).toHaveLength(2);
    expect(document.querySelector(".notif__item--unread")?.textContent).toContain("Unread one");
    const readRow = rows.find((r) => r.textContent?.includes("Read one"));
    expect(readRow?.classList.contains("notif__item--unread")).toBe(false);
  });

  it("marks an unread row read on click, calling onMarkRead(id) (AC-10)", async () => {
    const user = userEvent.setup();
    const onMarkRead = vi.fn();
    render(
      <NotificationCenter
        items={[item({ id: "42", title: "NVDA up", read: false, onMarkRead })]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Notifications" }));
    await user.click(await screen.findByRole("button", { name: "Mark read: NVDA up" }));

    expect(onMarkRead).toHaveBeenCalledWith("42");
  });

  it("marks an unread row read via the keyboard — Enter and Space (AC-10 keyboard)", async () => {
    const user = userEvent.setup();
    const onMarkRead = vi.fn();
    render(
      <NotificationCenter items={[item({ id: "7", title: "NVDA up", read: false, onMarkRead })]} />,
    );

    await user.click(screen.getByRole("button", { name: "Notifications" }));
    const row = await screen.findByRole("button", { name: "Mark read: NVDA up" });
    row.focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");

    expect(onMarkRead).toHaveBeenCalledTimes(2);
    expect(onMarkRead).toHaveBeenNthCalledWith(1, "7");
    expect(onMarkRead).toHaveBeenNthCalledWith(2, "7");
  });

  it("applies the semantic .notif__mark--{kind} per item (S84 owner decision)", async () => {
    const user = userEvent.setup();
    render(
      <NotificationCenter
        items={[
          item({ id: "1", kind: "up", read: false }),
          item({ id: "2", kind: "down", read: true }),
          item({ id: "3", kind: "warn", read: true }),
          item({ id: "4", kind: "info", read: true }),
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Notifications" }));
    await screen.findByText("Item 1");

    expect(document.querySelector(".notif__mark--up")).not.toBeNull();
    expect(document.querySelector(".notif__mark--down")).not.toBeNull();
    expect(document.querySelector(".notif__mark--warn")).not.toBeNull();
    expect(document.querySelector(".notif__mark--info")).not.toBeNull();
  });

  it("renders the empty state and no rows when items is empty (AC-12)", async () => {
    const user = userEvent.setup();
    render(<NotificationCenter items={[]} />);

    await user.click(screen.getByRole("button", { name: "Notifications" }));
    expect(await screen.findByText("No notifications")).not.toBeNull();
    expect(document.querySelector(".notif__item")).toBeNull();
  });

  it("renders the 'Mark all read' head action and fires onMarkAllRead", async () => {
    const user = userEvent.setup();
    const onMarkAllRead = vi.fn();
    render(
      <NotificationCenter items={[item({ id: "1", read: false })]} onMarkAllRead={onMarkAllRead} />,
    );

    await user.click(screen.getByRole("button", { name: "Notifications" }));
    await user.click(await screen.findByRole("button", { name: "Mark all read" }));

    expect(onMarkAllRead).toHaveBeenCalledTimes(1);
  });

  it("emits no shadow in source — lift is the .dropdown border-strong panel (FR4)", () => {
    const src = readFileSync(resolve(process.cwd(), "src/chrome/NotificationCenter.tsx"), "utf8");
    const styleProp = "box" + "Shadow";
    const cssDecl = "box" + "-shadow:";
    expect(src).not.toContain(styleProp);
    expect(src).not.toContain(cssDecl);
  });
});
