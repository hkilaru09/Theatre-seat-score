// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { stubCinemaData } from "./test/cinemaData";

vi.mock("./components/CinemaMap", () => ({ CinemaMap: () => null }));

const seatButton = (row: string, n: number) => screen.getByRole("button", { name: new RegExp(`^Row ${row} seat ${n},`) });
const stat = (label: string) =>
  within(screen.getByRole("region", { name: "Summary" })).getByText(label).closest(".stat") as HTMLElement;
const detailTitle = () => screen.getByRole("heading", { level: 3 }).textContent;

beforeEach(() => {
  localStorage.clear();
  stubCinemaData();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("SeatScore app", () => {
  it("opens on the multiplex with the summary filled in", () => {
    render(<App />);
    expect(screen.getAllByRole("tab")).toHaveLength(5);
    expect(screen.getByRole("tab", { name: "Multiplex Screen 4" })).toHaveAttribute("aria-selected", "true");
    expect(within(stat("Best seat")).getByText("K12 · 100")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Seat map for Multiplex Screen 4" })).toBeTruthy();
  });

  it("switches theaters", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("tab", { name: "IMAX Laser Hall" }));
    expect(screen.getByRole("img", { name: "Seat map for IMAX Laser Hall" })).toBeTruthy();
    expect(within(stat("Booked")).getByText(/\/ 452$/)).toBeTruthy();
  });

  it("shows details for a clicked seat", async () => {
    render(<App />);
    await userEvent.click(seatButton("A", 1));
    expect(detailTitle()).toBe("Row A, seat 1");
    expect(seatButton("A", 1).getAttribute("class")).toContain("selected");
  });

  it("selects a seat from the keyboard", () => {
    render(<App />);
    fireEvent.keyDown(seatButton("B", 2), { key: "Enter" });
    expect(detailTitle()).toBe("Row B, seat 2");
  });

  it("changes the group size and lists blocks of that size", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "More people" }));
    expect(screen.getByText("Best 3 together")).toBeTruthy();
    const first = screen.getAllByRole("button", { pressed: true }).find((b) => b.classList.contains("result"))!;
    const [, from, to] = first.textContent!.match(/seats (\d+)–(\d+)/)!;
    expect(Number(to) - Number(from)).toBe(2);
  });

  it("picking a result selects its middle seat", async () => {
    render(<App />);
    const results = screen.getAllByRole("button").filter((b) => b.classList.contains("result"));
    await userEvent.click(results[1]);
    expect(results[1]).toHaveAttribute("aria-pressed", "true");
    const row = results[1].textContent!.match(/Row (\w)/)![1];
    expect(detailTitle()).toMatch(new RegExp(`^Row ${row}, seat`));
  });

  it("books and frees seats in edit mode", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Clear bookings" }));
    expect(within(stat("Booked")).getByText("0 / 330")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Mark seats as booked" }));
    await userEvent.click(seatButton("K", 12));
    expect(seatButton("K", 12).getAttribute("aria-label")).toContain("booked");
    expect(within(stat("Booked")).getByText("1 / 330")).toBeTruthy();
    expect(within(stat("Best seat")).getByText(/^Best open:/)).toBeTruthy();

    await userEvent.click(seatButton("K", 12));
    expect(within(stat("Booked")).getByText("0 / 330")).toBeTruthy();
  });

  it("draws new sample bookings", async () => {
    render(<App />);
    const before = within(stat("Booked")).getByText(/\/ 330$/).textContent;
    await userEvent.click(screen.getByRole("button", { name: "New sample bookings" }));
    expect(within(stat("Booked")).getByText(/\/ 330$/).textContent).not.toBe(before);
  });

  it("applies presets and marks custom weights", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Easy exit" }));
    expect(screen.getByLabelText("Aisle access")).toHaveValue("5");
    expect(screen.getByRole("button", { name: "Easy exit" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.change(screen.getByLabelText("Sound"), { target: { value: "4" } });
    expect(screen.getByRole("button", { name: "Easy exit" })).toHaveAttribute("aria-pressed", "false");
  });

  it("applies the KOFA crowd preset and says where its weights come from", async () => {
    render(<App />);
    expect(screen.queryByText(/Fitted on KOFA data/)).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "KOFA crowd" }));
    expect(screen.getByRole("button", { name: "KOFA crowd" })).toHaveAttribute("aria-pressed", "true");
    const expected = { Immersion: "1", "Neck comfort": "2", Centering: "3", Sound: "0", "Clear view": "3", "Aisle access": "1" };
    for (const [label, value] of Object.entries(expected)) expect(screen.getByLabelText(label)).toHaveValue(value);
    expect(screen.getByLabelText("Screen size in your view")).toHaveValue("48");
    expect(screen.getByText(/Fitted on KOFA data/)).toBeTruthy();

    // Editing a weight makes it a custom mix, so the note no longer applies.
    fireEvent.change(screen.getByLabelText("Sound"), { target: { value: "2" } });
    expect(screen.queryByText(/Fitted on KOFA data/)).toBeNull();
  });

  it("hides the KOFA note when another preset is chosen", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "KOFA crowd" }));
    await userEvent.click(screen.getByRole("button", { name: "Balanced" }));
    expect(screen.queryByText(/Fitted on KOFA data/)).toBeNull();
    expect(screen.getByText("40° (screen default)")).toBeTruthy();
  });

  it("keeps the selected seat when weights change", async () => {
    render(<App />);
    await userEvent.click(seatButton("C", 3));
    fireEvent.change(screen.getByLabelText("Immersion"), { target: { value: "0" } });
    expect(detailTitle()).toBe("Row C, seat 3");
  });

  it("overrides and restores the target screen size", async () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText("Screen size in your view"), { target: { value: "50" } });
    expect(screen.getByText("50°")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Use screen default" }));
    expect(screen.getByText("40° (screen default)")).toBeTruthy();
  });

  it("remembers preferences across reloads", async () => {
    const { unmount } = render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Sound first" }));
    unmount();
    render(<App />);
    expect(screen.getByRole("button", { name: "Sound first" })).toHaveAttribute("aria-pressed", "true");
  });
});
