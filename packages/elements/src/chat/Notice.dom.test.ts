import { describe, expect, it } from "vitest";
import { HOSTILE_MARKUP } from "../trust/test-fixtures";
import { renderNotice } from "./Notice";

describe("renderNotice", () => {
  it("is a status note; each \\n starts a new line; no verdict stamp", () => {
    const notice = renderNotice("you’ve used today’s questions.\ncome back tomorrow.");
    expect(notice.className).toBe("qnotice");
    expect(notice.getAttribute("role")).toBe("status");
    expect(notice.querySelectorAll("br")).toHaveLength(1);
    expect(notice.textContent).toBe("you’ve used today’s questions.come back tomorrow.");
    expect(notice.querySelector(".vstamp, .vrow")).toBeNull();
  });

  it("renders a root-relative action as a link on its own line", () => {
    const notice = renderNotice("the chat is resting this month.", {
      action: { label: "the explorer is awake →", href: "/explore" },
    });
    const action = notice.querySelector(".qnotice__act");
    expect(action?.tagName).toBe("A");
    expect(action?.getAttribute("href")).toBe("/explore");
    expect(action?.textContent).toBe("the explorer is awake →");
    expect(action?.previousSibling?.nodeName).toBe("BR");
  });

  it("allows an absolute link only on an allow-listed origin", () => {
    const allowed = renderNotice("note", {
      action: { label: "go", href: "https://example.com/explore" },
      allowedOrigins: ["https://example.com"],
    });
    expect(allowed.querySelector("a.qnotice__act")?.getAttribute("href")).toBe(
      "https://example.com/explore",
    );
  });

  it.each([
    "javascript:globalThis.__trustPwned=1",
    "data:text/html,<script>globalThis.__trustPwned=1</script>",
    "vbscript:msgbox(1)",
    "//evil.example/explore",
    "https://evil.example/explore",
  ])("a hostile action href %j stays inert text with no href", (href) => {
    const notice = renderNotice("note", { action: { label: "go", href } });
    const action = notice.querySelector(".qnotice__act");
    expect(action?.tagName).toBe("SPAN");
    expect(action?.textContent).toBe("go");
    expect(notice.querySelector("[href]")).toBeNull();
  });

  it("a button action calls the consumer's handler", () => {
    let clicks = 0;
    const notice = renderNotice("that’s the cap for one conversation.", {
      action: {
        label: "start fresh →",
        onClick: () => {
          clicks += 1;
        },
      },
    });
    const button = notice.querySelector<HTMLButtonElement>("button.qnotice__act");
    expect(button?.type).toBe("button");
    button?.click();
    expect(clicks).toBe(1);
  });

  it("text and labels with markup stay inert text", () => {
    const notice = renderNotice(`${HOSTILE_MARKUP}\n${HOSTILE_MARKUP}`, {
      action: { label: HOSTILE_MARKUP, href: "/x" },
    });
    expect(notice.querySelectorAll("img")).toHaveLength(0);
    expect(notice.textContent).toBe(HOSTILE_MARKUP.repeat(3));
    expect((globalThis as { __trustPwned?: unknown }).__trustPwned).toBeUndefined();
  });

  it.each([
    ["", undefined, "text must be a non-empty string."],
    ["  ", undefined, "text must be a non-empty string."],
    ["ok", { label: "", href: "/x" }, "action.label must be a non-empty string."],
    ["ok", { label: "go", href: "" }, "action.href must be a non-empty string."],
    ["ok", { label: "go", onClick: "nope" }, "action.onClick must be a function."],
  ])("rejects bad input (%j, %j)", (text, action, message) => {
    expect(() =>
      renderNotice(text, action === undefined ? {} : { action: action as never }),
    ).toThrow(message);
  });
});
