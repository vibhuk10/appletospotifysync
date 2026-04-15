"use client";

import { useEffect } from "react";

export default function LocalhostGuard() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hostname === "localhost") {
      const next = window.location.href.replace(
        "://localhost",
        "://127.0.0.1"
      );
      window.location.replace(next);
    }
  }, []);
  return null;
}
