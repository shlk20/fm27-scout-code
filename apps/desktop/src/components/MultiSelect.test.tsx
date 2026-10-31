// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MultiSelect } from "./MultiSelect";
import type { FilterOption } from "@/lib/types";

const OPTIONS: FilterOption[] = [
  { id: 1, name: "Arsenal", count: 25 },
  { id: 2, name: "Chelsea", count: 24 },
];

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

function renderMultiSelect(onChange: (selected: number[]) => void, selected: number[] = []) {
  act(() => {
    root.render(
      <MultiSelect
        options={OPTIONS}
        selected={selected}
        onChange={onChange}
        placeholder="All clubs"
      />,
    );
  });
  act(() => container.querySelector("button")!.click());
}

describe("MultiSelect", () => {
  it("selects an option once when its name is clicked", () => {
    const onChange = vi.fn();
    renderMultiSelect(onChange);

    const name = [...container.querySelectorAll("span")].find(
      (element) => element.textContent === "Arsenal",
    );
    expect(name).toBeDefined();

    act(() => name!.click());

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith([1]);
  });

  it("selects an option when the checkbox is clicked", () => {
    const onChange = vi.fn();
    renderMultiSelect(onChange);

    const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(checkbox).not.toBeNull();

    act(() => checkbox!.click());

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith([1]);
  });
});
