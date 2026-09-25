"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const isDev = process.env.NODE_ENV === "development";
    const registerInDev = process.env.NEXT_PUBLIC_ENABLE_PWA_DEV === "true";
    if (isDev && !registerInDev) return;

    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .catch((error) => {
        console.error("[pwa] Service worker registration failed:", error);
      });
  }, []);

  return null;
}