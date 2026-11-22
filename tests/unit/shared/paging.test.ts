import { describe, expect, it } from "vitest";
import { clampPage, pageCount, pageLinks, parsePage } from "@/shared/paging";

describe("parsePage", () => {
  it("reads a whole number from 1 up", () => {
    expect(parsePage("1")).toBe(1);
    expect(parsePage("17")).toBe(17);
    expect(parsePage(" 3 ")).toBe(3);
  });

  it("takes the first value when the address names the page twice", () => {
    expect(parsePage(["4", "9"])).toBe(4);
  });

  it("falls back to page 1 for anything else", () => {
    for (const value of [undefined, "", "0", "-2", "1.5", "abc", "2e3", "99999999999999999999"]) {
      expect(parsePage(value)).toBe(1);
    }
  });
});

describe("pageCount and clampPage", () => {
  it("counts full and partly filled pages", () => {
    expect(pageCount(0, 200)).toBe(1);
    expect(pageCount(1, 200)).toBe(1);
    expect(pageCount(200, 200)).toBe(1);
    expect(pageCount(201, 200)).toBe(2);
    expect(pageCount(6478, 200)).toBe(33);
  });

  it("counts by the size of the page it is given", () => {
    expect(pageCount(60, 60)).toBe(1);
    expect(pageCount(61, 60)).toBe(2);
    expect(pageCount(2220, 60)).toBe(37);
  });

  it("moves a page beyond the end to the last page", () => {
    expect(clampPage(999, 6478, 200)).toBe(33);
    expect(clampPage(33, 6478, 200)).toBe(33);
    expect(clampPage(999, 2220, 60)).toBe(37);
  });

  it("moves a page before the start, and any page of an empty list, to page 1", () => {
    expect(clampPage(0, 6478, 200)).toBe(1);
    expect(clampPage(-4, 6478, 200)).toBe(1);
    expect(clampPage(2, 0, 200)).toBe(1);
  });
});

describe("pageLinks", () => {
  it("shows every page of a short list", () => {
    expect(pageLinks(1, 1)).toEqual([1]);
    expect(pageLinks(2, 3)).toEqual([1, 2, 3]);
    expect(pageLinks(1, 4)).toEqual([1, 2, 3, 4]);
  });

  it("keeps the first, the last and the neighbours of the current page", () => {
    expect(pageLinks(1, 33)).toEqual([1, 2, "gap", 33]);
    expect(pageLinks(5, 33)).toEqual([1, "gap", 4, 5, 6, "gap", 33]);
    expect(pageLinks(33, 33)).toEqual([1, "gap", 32, 33]);
  });

  it("shows a number instead of a gap that would hide only that number", () => {
    expect(pageLinks(4, 33)).toEqual([1, 2, 3, 4, 5, "gap", 33]);
    expect(pageLinks(30, 33)).toEqual([1, "gap", 29, 30, 31, 32, 33]);
  });

  it("always contains the current page exactly once, in rising order", () => {
    for (let count = 1; count <= 40; count++) {
      for (let current = 1; current <= count; current++) {
        const numbers = pageLinks(current, count).filter((link) => link !== "gap");
        expect(numbers.filter((page) => page === current)).toHaveLength(1);
        expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
        expect(numbers[0]).toBe(1);
        expect(numbers.at(-1)).toBe(count);
      }
    }
  });
});
