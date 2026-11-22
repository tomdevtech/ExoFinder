import { describe, expect, it } from "vitest";
import { describeStar } from "@/app/stars/summary";

describe("describeStar", () => {
  it("names a star by the number of its known planets, with the singular for one", () => {
    expect(describeStar(1)).toBe("Star · 1 known planet");
    expect(describeStar(7)).toBe("Star · 7 known planets");
    expect(describeStar(0)).toBe("Star · 0 known planets");
  });
});
