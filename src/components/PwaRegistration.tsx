"use client";

import { useEffect } from "react";

export default function PwaRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error: unknown) => {
      if (process.env.NODE_ENV !== "production") {
        console.warn("서비스 워커를 등록하지 못했습니다.", error);
      }
    });
  }, []);

  return null;
}
