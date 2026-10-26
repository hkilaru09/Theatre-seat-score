// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { stubCinemaData } from "../test/cinemaData";

vi.mock("./CinemaMap", () => ({ CinemaMap: () => <div data-testid="map" /> }));

const list = () => within(screen.getByRole("list", { name: "Matching cinemas" }));

beforeEach(() => {
  localStorage.clear();
  stubCinemaData();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Cinema finder", () => {
  it("opens on the visitor's country and lists its cinemas", async () => {
    render(<App />);
    expect(await screen.findByText("4 cinemas in 2 countries")).toBeTruthy();
    expect(await list().findByText("AMC Lincoln Square 13")).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Country" })).toHaveValue("US");
    expect(screen.getByText("2 cinemas")).toBeTruthy();
  });

  it("searches by city and shows a cinema's details", async () => {
    render(<App />);
    await list().findByText("AMC Lincoln Square 13");
    await userEvent.type(screen.getByRole("searchbox", { name: "Search" }), "brooklyn");
    expect(screen.getByText("1 cinema")).toBeTruthy();
    await userEvent.click(list().getByRole("button", { name: /Alamo Drafthouse/ }));
    const card = within(screen.getByLabelText("Selected cinema"));
    expect(card.getByText("Brooklyn · 7 screens")).toBeTruthy();
    expect(card.getByText(/No seat plan for this cinema yet/)).toBeTruthy();
    expect(card.getByRole("link", { name: "OpenStreetMap" })).toHaveAttribute("href", "https://www.openstreetmap.org/node/2");
  });

  it("opens the real seat plan for a cinema that has one", async () => {
    render(<App />);
    await userEvent.selectOptions(await screen.findByRole("combobox", { name: "Country" }), "KR");
    await userEvent.click(await list().findByRole("button", { name: /KOFA/ }));
    await userEvent.click(screen.getByRole("button", { name: "KOFA Hall 2" }));
    expect(screen.getByRole("tab", { name: "KOFA Hall 2" })).toHaveAttribute("aria-selected", "true");
  });
});
