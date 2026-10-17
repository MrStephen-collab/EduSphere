import { describe, expect, it } from "vitest";
import {
  composeDataMode,
  dataPreferencesSchema,
  defaultDataModeFor,
  playbackPolicyFor,
  readDeviceSaveData,
  resolveEffectivePreferences,
  resolveVideoCeiling,
} from "@/lib/data-preferences";

describe("data preference schemas", () => {
  it("accepts the three modes and four quality settings", () => {
    expect(dataPreferencesSchema.safeParse({ dataMode: "saver", videoQuality: "360p" }).success).toBe(true);
    expect(dataPreferencesSchema.safeParse({ dataMode: "high", videoQuality: "auto" }).success).toBe(true);
  });

  it("rejects modes and qualities outside the spec's lists", () => {
    expect(dataPreferencesSchema.safeParse({ dataMode: "ultra", videoQuality: "auto" }).success).toBe(false);
    expect(dataPreferencesSchema.safeParse({ dataMode: "saver", videoQuality: "1080p" }).success).toBe(false);
    expect(dataPreferencesSchema.safeParse({ dataMode: "saver" }).success).toBe(false);
  });
});

describe("defaultDataModeFor", () => {
  it("starts a school in low-data mode at Data Saver", () => {
    expect(defaultDataModeFor(true)).toBe("saver");
  });

  it("defaults everyone else to Balanced", () => {
    expect(defaultDataModeFor(false)).toBe("balanced");
  });
});

describe("composeDataMode precedence", () => {
  it("lets an explicit choice win over the device and the school", () => {
    expect(
      composeDataMode({ savedMode: "high", schoolLowDataMode: true, deviceSaveData: true }),
    ).toBe("high");
    expect(
      composeDataMode({ savedMode: "balanced", schoolLowDataMode: true, deviceSaveData: true }),
    ).toBe("balanced");
  });

  it("falls back to Data Saver when the device asks to save data", () => {
    expect(composeDataMode({ savedMode: null, schoolLowDataMode: false, deviceSaveData: true })).toBe("saver");
  });

  it("falls back to Data Saver when the school is in low-data mode", () => {
    expect(composeDataMode({ savedMode: null, schoolLowDataMode: true, deviceSaveData: false })).toBe("saver");
  });

  it("settles on Balanced when nothing asks for economy", () => {
    expect(composeDataMode({ savedMode: null, schoolLowDataMode: false, deviceSaveData: false })).toBe("balanced");
  });
});

describe("resolveVideoCeiling", () => {
  it("derives the ceiling from the mode when quality is auto", () => {
    expect(resolveVideoCeiling("saver", "auto")).toBe(360);
    expect(resolveVideoCeiling("balanced", "auto")).toBe(480);
    expect(resolveVideoCeiling("high", "auto")).toBe(720);
  });

  it("lets an explicit quality win over the mode", () => {
    expect(resolveVideoCeiling("saver", "720p")).toBe(720);
    expect(resolveVideoCeiling("high", "360p")).toBe(360);
  });
});

describe("resolveEffectivePreferences", () => {
  it("reports where the mode came from", () => {
    expect(
      resolveEffectivePreferences({
        saved: { dataMode: "high", videoQuality: "480p" },
        schoolLowDataMode: true,
        deviceSaveData: true,
      }),
    ).toMatchObject({ mode: "high", videoQuality: "480p", ceiling: 480, source: "yours" });

    expect(
      resolveEffectivePreferences({ saved: null, schoolLowDataMode: true, deviceSaveData: false }),
    ).toMatchObject({ mode: "saver", videoQuality: "auto", ceiling: 360, source: "school" });

    expect(
      resolveEffectivePreferences({ saved: null, schoolLowDataMode: false, deviceSaveData: false }),
    ).toMatchObject({ mode: "balanced", source: "default" });
  });

  it("keeps a device request from claiming to be a saved choice", () => {
    const resolved = resolveEffectivePreferences({
      saved: null,
      schoolLowDataMode: false,
      deviceSaveData: true,
    });
    expect(resolved.mode).toBe("saver");
    expect(resolved.source).toBe("default");
  });
});

describe("playbackPolicyFor", () => {
  it("states the ceiling honestly for every mode/quality pair", () => {
    expect(playbackPolicyFor("saver", "auto")).toEqual({ ceiling: 360, note: "Quality capped at 360p." });
    expect(playbackPolicyFor("balanced", "720p")).toEqual({ ceiling: 720, note: "Quality capped at 720p." });
    expect(playbackPolicyFor("high", "360p")).toEqual({ ceiling: 360, note: "Quality capped at 360p." });
  });
});

describe("readDeviceSaveData", () => {
  it("returns false when the browser exposes no connection info", () => {
    // jsdom and SSR have no navigator.connection — the honest default.
    expect(readDeviceSaveData()).toBe(false);
  });
});
