import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Faq } from "@/components/landing/faq";

describe("landing FAQ", () => {
  it("expands a selected answer and marks it accessible", async () => {
    const user = userEvent.setup();
    render(<Faq />);
    const question = screen.getByRole("button", { name: /Can I paste a YouTube/i });
    expect(question).toHaveAttribute("aria-expanded", "false");
    await user.click(question);
    expect(question).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/Clearframe does not extract media from protected streaming pages/i)).toBeInTheDocument();
  });
});
