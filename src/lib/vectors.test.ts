import { describe, it, expect } from "vitest";
import { cosine, rankByVector } from "./vectors";

describe("cosine", () => {
  it("is 1 for identical direction, 0 for orthogonal", () => {
    expect(cosine([1, 0], [2, 0])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
  });
  it("handles zero vectors safely", () => {
    expect(cosine([0, 0], [1, 1])).toBe(0);
  });
});

describe("rankByVector", () => {
  it("ranks the nearest vectors first", () => {
    const corpus = [
      { id: "a", vector: [1, 0] },
      { id: "b", vector: [0.9, 0.1] },
      { id: "c", vector: [0, 1] },
    ];
    const ranked = rankByVector([1, 0], corpus, 2);
    expect(ranked.map((r) => r.id)).toEqual(["a", "b"]);
  });
});
