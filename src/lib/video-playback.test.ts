import { describe, expect, it } from "vitest";
import {
  canEnforceCeiling,
  capLevelIndex,
  choosePlaybackStrategy,
  describePlayback,
} from "@/lib/video-playback";

describe("choosePlaybackStrategy", () => {
  it("caps through the library whenever it is supported", () => {
    expect(
      choosePlaybackStrategy({ hasHlsUrl: true, librarySupported: true, nativeHls: true }),
    ).toEqual({ kind: "adaptive-capped" });
  });

  it("uses the browser's own adaptive stream when the library cannot run", () => {
    expect(
      choosePlaybackStrategy({ hasHlsUrl: true, librarySupported: false, nativeHls: true }),
    ).toEqual({ kind: "adaptive-uncapped" });
  });

  it("falls back to the progressive file when nothing plays HLS", () => {
    expect(
      choosePlaybackStrategy({ hasHlsUrl: true, librarySupported: false, nativeHls: false }),
    ).toEqual({ kind: "progressive" });
    expect(
      choosePlaybackStrategy({ hasHlsUrl: false, librarySupported: true, nativeHls: true }),
    ).toEqual({ kind: "progressive" });
  });
});

describe("canEnforceCeiling", () => {
  it("is true only for the capped adaptive strategy", () => {
    expect(canEnforceCeiling({ kind: "adaptive-capped" })).toBe(true);
    expect(canEnforceCeiling({ kind: "adaptive-uncapped" })).toBe(false);
    expect(canEnforceCeiling({ kind: "progressive" })).toBe(false);
  });
});

describe("capLevelIndex", () => {
  const ladder = [{ height: 240 }, { height: 360 }, { height: 480 }, { height: 720 }, { height: 1080 }];

  it("picks the highest rung at or below the ceiling", () => {
    expect(capLevelIndex(ladder, 480)).toBe(2);
    expect(capLevelIndex(ladder, 600)).toBe(2);
    expect(capLevelIndex(ladder, 1080)).toBe(4);
    expect(capLevelIndex(ladder, 240)).toBe(0);
  });

  it("caps at the top rung when every rung fits, and at -1 when none do", () => {
    // Every rung fits: capping at the top rung is the same as no cap.
    expect(capLevelIndex(ladder, 2160)).toBe(4);
    // Ceiling below the lowest rendition: nothing can be done without
    // transcoding, so -1 lets the lowest available rung play.
    expect(capLevelIndex(ladder, 200)).toBe(-1);
    expect(capLevelIndex([], 480)).toBe(-1);
  });

  it("does not depend on the ladder being ordered by height", () => {
    const shuffled = [{ height: 1080 }, { height: 360 }, { height: 720 }];
    expect(capLevelIndex(shuffled, 720)).toBe(2);
    expect(capLevelIndex(shuffled, 480)).toBe(1);
  });

  it("ignores rungs without a numeric height", () => {
    expect(capLevelIndex([{ height: null }, { height: 360 }, {}], 480)).toBe(1);
  });
});

describe("describePlayback", () => {
  it("claims the cap only when it is genuinely enforced", () => {
    expect(describePlayback({ kind: "adaptive-capped" }, true, 480)).toBe("Quality capped at 480p.");
  });

  it("admits when an adaptive browser cannot be capped", () => {
    expect(describePlayback({ kind: "adaptive-uncapped" }, false, 480)).toBe(
      "This browser streams adaptively — the 480p cap can't be enforced here, so quality may go higher.",
    );
  });

  it("admits when playback fell back to a single file", () => {
    expect(describePlayback({ kind: "adaptive-capped" }, false, 480)).toBe(
      "This browser streams adaptively — the 480p cap can't be enforced here, so quality may go higher.",
    );
    expect(describePlayback({ kind: "progressive" }, false, 360)).toBe(
      "This video plays as a single file — the 360p cap can't be enforced.",
    );
  });
});
