import { describe, expect, it } from "vitest";
import { asArray } from "./embed";

describe("asArray", () => {
  it("wraps a to-one embed returned as an object", () => {
    expect(asArray({ name: "Mathematics" })).toEqual([{ name: "Mathematics" }]);
  });

  it("passes an embed returned as an array straight through", () => {
    const embed = [{ name: "Mathematics" }];
    expect(asArray(embed)).toBe(embed);
  });

  it("treats a missing embed as empty", () => {
    expect(asArray(null)).toEqual([]);
    expect(asArray(undefined)).toEqual([]);
  });

  it("keeps falsy-but-present values", () => {
    expect(asArray(0)).toEqual([0]);
    expect(asArray("")).toEqual([""]);
    expect(asArray(false)).toEqual([false]);
  });

  it("exposes the first entry for chained reads", () => {
    type Embed = { name: string; id: number } | { name: string; id: number }[] | null;
    const embed: Embed = { name: "English", id: 1 };
    const missing: Embed = null;
    expect(asArray(embed)[0]?.name).toBe("English");
    expect(asArray<{ name: string; id: number }>(missing)[0]?.name).toBeUndefined();
  });
});
