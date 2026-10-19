function embedUrl(id: string): string {
  // As locked down as YouTube allows: youtube-nocookie (no tracking cookie
  // until play), modestbranding (less YouTube chrome), rel=0 (no related
  // videos from other channels at the end), playsinline=1 (stays inside the
  // embed on mobile instead of handing off to the native YouTube app, which
  // would surface the shareable watch URL).
  const url = new URL(`https://www.youtube-nocookie.com/embed/${id}`);
  url.searchParams.set("modestbranding", "1");
  url.searchParams.set("rel", "0");
  url.searchParams.set("playsinline", "1");
  return url.toString();
}

export function getYouTubeEmbedUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    if (host === "youtu.be" || host.endsWith(".youtu.be")) {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id ? embedUrl(id) : null;
    }

    if (host === "youtube.com" || host.endsWith(".youtube.com") || host === "m.youtube.com") {
      if (parsed.pathname.startsWith("/embed/")) {
        const id = parsed.pathname.split("/")[2];
        return id ? embedUrl(id) : null;
      }
      const v = parsed.searchParams.get("v");
      if (v) return embedUrl(v);
    }
  } catch {
    return null;
  }
  return null;
}

export function isEmbeddableVideo(url: string | null | undefined): boolean {
  return getYouTubeEmbedUrl(url) !== null;
}