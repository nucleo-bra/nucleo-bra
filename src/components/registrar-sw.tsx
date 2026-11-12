"use client";
// Liga o service worker que guarda o sistema no aparelho (uso sem internet).
import { useEffect } from "react";

export function RegistrarSW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || location.hostname === "localhost" && !location.search.includes("sw=1")) return;
    const t = setTimeout(() => navigator.serviceWorker.register("/sw.js").catch(() => {}), 2500);
    return () => clearTimeout(t);
  }, []);
  return null;
}
