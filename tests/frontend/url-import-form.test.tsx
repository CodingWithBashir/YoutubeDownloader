import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UrlImportForm } from "@/components/landing/url-import-form";

describe("URL import form", () => {
  it("blocks streaming pages before calling the API", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<UrlImportForm config={null} onSuccess={vi.fn()} />);
    await user.type(screen.getByLabelText(/Direct media file URL/i), "https://www.youtube.com/watch?v=abc");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /Continue/i }));
    expect(await screen.findByText(/Streaming and social-media pages are not supported/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
