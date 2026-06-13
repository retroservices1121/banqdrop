"use client";

// PWA glue: registers the service worker and shows HONEST install onboarding.
// iOS cannot trigger add-to-home-screen programmatically, so we detect the
// platform and show the manual Share-sheet steps instead of a fake button.
// Android/desktop get the real beforeinstallprompt button. Hidden once installed.

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}
function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export default function PwaClient() {
  const pathname = usePathname();
  const [installEvt, setInstallEvt] = useState<BIPEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [notif, setNotif] = useState<NotificationPermission | "unsupported">("unsupported");

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    if (isStandalone()) return; // already installed — no prompts
    if (typeof Notification !== "undefined") setNotif(Notification.permission);

    const onBIP = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    if (isIos()) setShowIosHint(true);
    return () => window.removeEventListener("beforeinstallprompt", onBIP);
  }, []);

  async function install() {
    if (!installEvt) return;
    await installEvt.prompt();
    await installEvt.userChoice;
    setInstallEvt(null);
  }
  async function enableNotifications() {
    if (typeof Notification === "undefined") return;
    setNotif(await Notification.requestPermission());
  }

  // The landing ("/") has its own in-page install CTA — don't double up with the banner.
  const showBar = pathname !== "/" && !dismissed && (installEvt || showIosHint);
  if (!showBar) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-50 mx-auto w-full max-w-md p-3">
      <div className="rounded-2xl bg-ink p-3 text-white shadow-lg">
        <div className="flex items-start gap-3">
          <span className="text-xl">◍</span>
          <div className="flex-1 text-sm">
            <div className="font-semibold">Install banqdrop</div>
            {installEvt ? (
              <p className="text-white/70">Add it to your home screen for a full-screen app.</p>
            ) : (
              <p className="text-white/70">
                Tap the Share icon <span className="font-semibold">⎙</span>, then{" "}
                <span className="font-semibold">“Add to Home Screen”</span>.
              </p>
            )}
            <div className="mt-2 flex gap-2">
              {installEvt && (
                <button onClick={install} className="rounded-lg bg-white px-3 py-1 text-xs font-semibold text-ink">
                  Install
                </button>
              )}
              {notif === "default" && (
                <button
                  onClick={enableNotifications}
                  className="rounded-lg bg-white/15 px-3 py-1 text-xs font-medium"
                >
                  Turn on alerts
                </button>
              )}
              <button onClick={() => setDismissed(true)} className="rounded-lg px-3 py-1 text-xs text-white/60">
                Not now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
