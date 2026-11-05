import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";

afterEach(() => {
  window.localStorage.clear();
  document.documentElement.classList.remove("light", "dark");
});

describe("theme controls", () => {
  it("persists a theme choice and updates the document class", async () => {
    const user = userEvent.setup();
    render(<ThemeProvider><ThemeToggle /></ThemeProvider>);
    const button = screen.getByRole("button", { name: /current:/i });
    await user.click(button);
    expect(window.localStorage.getItem("clearframe.theme")).toBe("light");
    expect(document.documentElement.classList.contains("light")).toBe(true);
    await user.click(button);
    expect(window.localStorage.getItem("clearframe.theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
