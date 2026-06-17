import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge, ConsentBadge } from "./Badge";

describe("Badge Component", () => {
  it("renders with default neutral tone", () => {
    render(<Badge>Test Badge</Badge>);
    const badge = screen.getByText("Test Badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("bg-muted");
  });

  it("applies tone classes correctly", () => {
    render(<Badge tone="success">Success</Badge>);
    const badge = screen.getByText("Success");
    expect(badge).toHaveClass("bg-success/15");
  });

  it("renders a dot when dot prop is true", () => {
    const { container } = render(<Badge dot tone="danger">Danger</Badge>);
    const dot = container.querySelector("span.rounded-full");
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveClass("bg-danger");
  });
});

describe("ConsentBadge Component", () => {
  it("renders granted status correctly", () => {
    render(<ConsentBadge status="granted" />);
    const badge = screen.getByText("granted");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("bg-success/15");
  });
});
