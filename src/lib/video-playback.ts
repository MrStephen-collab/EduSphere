/**
 * Video playback provider abstraction (spec section 50).
 *
 * The spec asks for quality options — 360p / 480p / 720p — without building
 * transcoding infrastructure. The honest way to honour a ceiling with the
 * assets we already have (Mux) is the adaptive stream: its ladder carries
 * every rendition the source was encoded to, so a player that caps which
 * rungs it will climb genuinely spends no more than the chosen ceiling.
 * A progressive MP4 is a single file: playing it, the cap cannot be enforced,
 * and the UI must say so rather than pretend.
 *
 * Three strategies fall out of that, decided by what the browser can do:
 *   adaptive-capped     — hls.js in the player, ceiling enforced
 *   adaptive-uncapped   — the browser's own HLS (Safari), adaptive but uncapped
 *   progressive         — one MP4, plays everywhere, no ceiling possible
 */

export type PlaybackStrategy =
  | { kind: "adaptive-capped" }
  | { kind: "adaptive-uncapped" }
  | { kind: "progressive" };

export function choosePlaybackStrategy(input: {
  hasHlsUrl: boolean;
  librarySupported: boolean;
  nativeHls: boolean;
}): PlaybackStrategy {
  if (input.hasHlsUrl && input.librarySupported) return { kind: "adaptive-capped" };
  if (input.hasHlsUrl && input.nativeHls) return { kind: "adaptive-uncapped" };
  return { kind: "progressive" };
}

/** Whether this strategy can honour a pixel ceiling at all. */
export function canEnforceCeiling(strategy: PlaybackStrategy): boolean {
  return strategy.kind === "adaptive-capped";
}

/**
 * Index of the highest rendition at or below the ceiling, or -1 when every
 * rendition already fits (hls.js reads -1 as "no cap").
 *
 * Works from height alone so it does not depend on the ladder's ordering.
 */
export function capLevelIndex(
  levels: readonly { height?: number | null }[],
  ceiling: number,
): number {
  let best = -1;
  let bestHeight = -1;
  for (let i = 0; i < levels.length; i++) {
    const height = levels[i].height;
    if (typeof height !== "number" || !Number.isFinite(height)) continue;
    if (height <= ceiling && height > bestHeight) {
      best = i;
      bestHeight = height;
    }
  }
  return best;
}

/** Honest one-liner for the player footer — never claims a cap that is not live. */
export function describePlayback(
  strategy: PlaybackStrategy,
  enforced: boolean,
  ceiling: number,
): string {
  if (enforced && canEnforceCeiling(strategy)) {
    return `Quality capped at ${ceiling}p.`;
  }
  if (strategy.kind === "progressive") {
    return `This video plays as a single file — the ${ceiling}p cap can't be enforced.`;
  }
  return `This browser streams adaptively — the ${ceiling}p cap can't be enforced here, so quality may go higher.`;
}

export type PlaybackHandle = {
  strategy: PlaybackStrategy;
  /** True while the ceiling is genuinely enforced; flips to false on fallback. */
  enforced: boolean;
  /** Fires if the capped stream fails and playback falls back to the MP4. */
  onFallback: (callback: () => void) => void;
  /**
   * Applies a new ceiling to the live stream — an ABR cap switch needs no
   * re-attach and so never restarts playback. No-op when the strategy cannot
   * enforce a ceiling; the caller re-describes honestly either way.
   */
  setCeiling: (pixels: number) => void;
  detach: () => void;
};

function canPlayNativeHls(video: HTMLVideoElement): boolean {
  try {
    return video.canPlayType("application/vnd.apple.mpegurl") !== "";
  } catch {
    return false;
  }
}

/**
 * Attaches a signed grant to the video element under the chosen strategy.
 *
 * The ceiling is applied as hls.js `autoLevelCapping` once the manifest's
 * ladder is known — no server round trip, no extra rendition files. If the
 * adaptive stream fails for any fatal reason the element falls back to the
 * progressive MP4 so the lesson still plays, and `onFallback` lets the UI
 * drop its claim that the cap is live.
 */
export async function attachPlayback(input: {
  video: HTMLVideoElement;
  streamUrl: string;
  hlsUrl: string;
  ceiling: number;
}): Promise<PlaybackHandle> {
  const { video, streamUrl, hlsUrl, ceiling } = input;

  type HlsConstructor = (typeof import("hls.js"))["default"];
  let HlsCtor: HlsConstructor | null = null;
  try {
    const hlsModule = await import("hls.js");
    if (hlsModule.default.isSupported()) HlsCtor = hlsModule.default;
  } catch {
    HlsCtor = null;
  }

  const strategy = choosePlaybackStrategy({
    hasHlsUrl: Boolean(hlsUrl),
    librarySupported: HlsCtor !== null,
    nativeHls: canPlayNativeHls(video),
  });

  let fallbackCallbacks: (() => void)[] = [];
  const handle: PlaybackHandle = {
    strategy,
    enforced: canEnforceCeiling(strategy),
    onFallback: (callback) => {
      fallbackCallbacks.push(callback);
    },
    setCeiling: () => {},
    detach: () => {},
  };

  const fireFallback = () => {
    if (!handle.enforced) return;
    handle.enforced = false;
    // Playback is now the single MP4 — the strategy changed, not just a flag.
    handle.strategy = { kind: "progressive" };
    const callbacks = fallbackCallbacks;
    fallbackCallbacks = [];
    for (const callback of callbacks) callback();
  };

  if (strategy.kind === "adaptive-capped" && HlsCtor) {
    const hls = new HlsCtor();
    hls.on(HlsCtor.Events.MANIFEST_PARSED, () => {
      hls.autoLevelCapping = capLevelIndex(hls.levels, ceiling);
    });
    hls.on(HlsCtor.Events.ERROR, (_event, data) => {
      if (!data.fatal) return;
      hls.destroy();
      // The lesson matters more than the ceiling: fall back to the MP4.
      video.src = streamUrl;
      fireFallback();
    });
    hls.loadSource(hlsUrl);
    hls.attachMedia(video);
    handle.setCeiling = (pixels: number) => {
      if (handle.enforced) hls.autoLevelCapping = capLevelIndex(hls.levels, pixels);
    };
    handle.detach = () => {
      hls.destroy();
      video.removeAttribute("src");
    };
    return handle;
  }

  video.src = strategy.kind === "adaptive-uncapped" ? hlsUrl : streamUrl;
  handle.detach = () => {
    video.removeAttribute("src");
  };
  return handle;
}
