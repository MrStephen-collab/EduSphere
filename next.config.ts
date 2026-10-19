import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Every portal page is authenticated, i.e. dynamic, and the client router
    // cache for dynamic pages defaults to 0 seconds -- so even flipping back
    // to the page you just left paid a full server round trip. 30 seconds
    // makes a burst of navigation (sidebar flips, Back, returning to a list)
    // resolve from the client cache; server actions still invalidate through
    // revalidation when something is written.
    staleTimes: {
      dynamic: 30,
    },
    // Prefetch the full payload of a dynamic route on hover instead of only
    // its loading shell, so the click that follows resolves from the
    // prefetch rather than starting the fetch at click time.
    dynamicOnHover: true,
  },
};

export default nextConfig;
