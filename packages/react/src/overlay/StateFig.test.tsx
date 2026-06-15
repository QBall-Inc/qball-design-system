import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EmptyStateFig, ErrorStateFig } from "./StateFig";

describe("EmptyStateFig", () => {
  it("renders the icon chip, headline, body, and CTA on the base .state-fig (AC-4/AC-9e)", () => {
    const { container } = render(
      <EmptyStateFig
        icon={<svg data-testid="empty-icon" />}
        title="Your watchlist is empty"
        body="Add a ticker to start tracking prices."
        action={<button type="button">Add a ticker</button>}
      />,
    );
    const fig = container.querySelector(".state-fig");
    expect(fig).not.toBeNull();
    // Empty is the neutral base — NOT the error modifier.
    expect(fig?.className.split(" ")).not.toContain("state-fig--error");
    // Icon chip hosts the consumer-provided node.
    expect(fig?.querySelector(".state-fig__icon [data-testid='empty-icon']")).not.toBeNull();
    expect(screen.getByText("Your watchlist is empty")).not.toBeNull();
    expect(screen.getByText("Add a ticker to start tracking prices.")).not.toBeNull();
    // CTA lands in the actions row.
    const cta = screen.getByRole("button", { name: "Add a ticker" });
    expect(cta.closest(".state-fig__actions")).not.toBeNull();
  });

  it("omits the icon, body, and actions rows when not provided", () => {
    const { container } = render(<EmptyStateFig title="No matches" />);
    expect(container.querySelector(".state-fig__icon")).toBeNull();
    expect(container.querySelector(".state-fig__msg")).toBeNull();
    expect(container.querySelector(".state-fig__actions")).toBeNull();
    expect(screen.getByText("No matches")).not.toBeNull();
  });
});

describe("ErrorStateFig", () => {
  it("renders the error modifier and a mandatory Retry CTA (AC-5/AC-6)", () => {
    const { container } = render(
      <ErrorStateFig
        icon={<svg data-testid="error-icon" />}
        title="Couldn't load this chart"
        body="The data provider didn't respond."
        retry={vi.fn()}
      />,
    );
    expect(container.querySelector(".state-fig")?.className.split(" ")).toContain(
      "state-fig--error",
    );
    expect(screen.getByRole("button", { name: "Retry" })).not.toBeNull();
  });

  it("invokes the retry callback when the Retry CTA is clicked (AC-5/AC-9f)", async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    render(<ErrorStateFig title="Couldn't load this chart" retry={retry} />);
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("renders no Dismiss CTA unless onDismiss is provided", () => {
    render(<ErrorStateFig title="Failed" retry={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Dismiss" })).toBeNull();
  });

  it("renders a Dismiss CTA that fires onDismiss when provided", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<ErrorStateFig title="Failed" retry={vi.fn()} onDismiss={onDismiss} />);
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("supports a custom retry label", () => {
    render(<ErrorStateFig title="Failed" retry={vi.fn()} retryLabel="Try again" />);
    expect(screen.getByRole("button", { name: "Try again" })).not.toBeNull();
  });
});
