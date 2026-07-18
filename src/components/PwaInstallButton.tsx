"use client";

import { useEffect, useState } from "react";

type InstallChoice = {
  readonly outcome: "accepted" | "dismissed";
};

type InstallPromptEvent = Event & {
  readonly prompt: () => Promise<void>;
  readonly userChoice: Promise<InstallChoice>;
};

function isInstallPromptEvent(event: Event): event is InstallPromptEvent {
  return (
    typeof Reflect.get(event, "prompt") === "function" &&
    typeof Reflect.get(event, "userChoice") === "object"
  );
}

export default function PwaInstallButton() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const handleBeforeInstall = (event: Event) => {
      if (!isInstallPromptEvent(event)) return;
      event.preventDefault();
      setInstallPrompt(event);
    };

    const handleInstalled = () => setInstallPrompt(null);

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  if (installPrompt === null) return null;

  const handleInstall = async () => {
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  return (
    <button
      type="button"
      onClick={handleInstall}
      className="button-secondary flex w-full items-center justify-center rounded-xl px-5 py-4 text-base"
    >
      이 앱 설치하기
    </button>
  );
}
