import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Field } from "./Field";
import { Input } from "./Input";

describe("Field", () => {
  it("renders a label associated to the child input via htmlFor/id", () => {
    const { getByText, getByRole } = render(
      <Field label="Email address">
        <Input />
      </Field>,
    );
    const label = getByText("Email address");
    const input = getByRole("textbox");
    expect(label.tagName).toBe("LABEL");
    const forId = label.getAttribute("for");
    expect(forId).toBeTruthy();
    expect(input.getAttribute("id")).toBe(forId);
  });

  it("renders helpText as .field__help wired via aria-describedby", () => {
    const { getByText, getByRole } = render(
      <Field label="Email" helpText="We send a magic link, no password.">
        <Input />
      </Field>,
    );
    const help = getByText("We send a magic link, no password.");
    expect(help.className.split(" ")).toContain("field__help");
    const describedBy = getByRole("textbox").getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(describedBy).toContain(help.getAttribute("id"));
  });

  it("errorText renders a role=alert message, marks the child invalid, and applies .input--error", () => {
    const { getByRole } = render(
      <Field label="Email" errorText="Enter a valid email address.">
        <Input />
      </Field>,
    );
    const alert = getByRole("alert");
    expect(alert.className.split(" ")).toContain("field__error");
    expect(alert.textContent).toBe("Enter a valid email address.");

    const input = getByRole("textbox");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.className.split(" ")).toContain("input--error");
    expect(input.getAttribute("aria-describedby")).toContain(alert.getAttribute("id"));
  });

  it("merges a pre-existing child aria-describedby with the field's own help id", () => {
    const { getByRole, getByText } = render(
      <Field label="Email" helpText="We send a magic link.">
        <Input aria-describedby="external-hint" />
      </Field>,
    );
    const describedBy = getByRole("textbox").getAttribute("aria-describedby") ?? "";
    const helpId = getByText("We send a magic link.").getAttribute("id");
    expect(describedBy.split(" ")).toContain("external-hint");
    expect(describedBy.split(" ")).toContain(helpId);
  });

  it("renders the required marker (.field__req) when required", () => {
    const { getByText } = render(
      <Field label="Email address" required>
        <Input />
      </Field>,
    );
    const star = getByText("*");
    expect(star.className.split(" ")).toContain("field__req");
  });

  it("omits help/error/required markers when not provided", () => {
    const { container, queryByRole } = render(
      <Field label="Email">
        <Input />
      </Field>,
    );
    expect(queryByRole("alert")).toBeNull();
    expect(container.querySelector(".field__help")).toBeNull();
    expect(container.querySelector(".field__req")).toBeNull();
    expect(container.querySelector(".input--error")).toBeNull();
  });
});
