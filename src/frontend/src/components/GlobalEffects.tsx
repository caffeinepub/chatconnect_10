import { useNavigate } from "@tanstack/react-router";
import { LogOut, Shield } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { backendInterface as ExtendedBackend } from "../backend.d";
import { useActor } from "../hooks/useActor";
import { useLocalAuth } from "../hooks/useLocalAuth";

function formatBanDate(nanos: bigint | null): string {
  if (!nanos) return "an unknown time";
  const ms = Number(nanos / BigInt(1_000_000));
  return new Date(ms).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function GlobalEffects() {
  const { isLocalLoggedIn, localSession, logoutLocal } = useLocalAuth();
  const { actor } = useActor();
  const navigate = useNavigate();
  const extActor = actor as unknown as ExtendedBackend | null;

  // --- Push Notifications ---
  const seenNotifIds = useRef<Set<string>>(new Set());
  const prevUnreadDM = useRef<number>(0);

  const pollPushNotifications = useCallback(async () => {
    if (!isLocalLoggedIn || !localSession || !extActor) return;
    if (Notification.permission !== "granted") return;

    try {
      const [notifs, unreadCount] = await Promise.all([
        extActor.getNotificationsAsLocal(localSession.token),
        extActor.getUnreadDMCount(localSession.token),
      ]);

      // Fire push for new notifications
      for (const notif of notifs) {
        const idStr = notif.id.toString();
        if (!notif.isRead && !seenNotifIds.current.has(idStr)) {
          seenNotifIds.current.add(idStr);
          const nt = notif.notifType as string;
          const label =
            nt === "callRequest"
              ? `${notif.actorName} is calling you`
              : nt === "like"
                ? `${notif.actorName} liked your post`
                : nt === "comment"
                  ? `${notif.actorName} replied to your post`
                  : "New notification";
          try {
            new Notification("Wave Chat", {
              body: label,
              icon: "/favicon.ico",
            });
          } catch {
            // ignore
          }
        }
      }

      // Fire push for new DMs
      const currentUnread = Number(unreadCount);
      if (currentUnread > prevUnreadDM.current && prevUnreadDM.current >= 0) {
        try {
          new Notification("Wave Chat", {
            body: "You have new messages",
            icon: "/favicon.ico",
          });
        } catch {
          // ignore
        }
      }
      prevUnreadDM.current = currentUnread;
    } catch {
      // ignore
    }
  }, [isLocalLoggedIn, localSession, extActor]);

  // Request notification permission on login
  useEffect(() => {
    if (!isLocalLoggedIn) return;
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "default"
    ) {
      Notification.requestPermission().catch(() => {});
    }
  }, [isLocalLoggedIn]);

  // Poll push notifications every 5s
  useEffect(() => {
    if (!isLocalLoggedIn) return;
    const interval = setInterval(pollPushNotifications, 5_000);
    return () => clearInterval(interval);
  }, [isLocalLoggedIn, pollPushNotifications]);

  // --- Ban Shield ---
  const [isBanned, setIsBanned] = useState(false);
  const [banExpiry, setBanExpiry] = useState<bigint | null>(null);

  const checkBan = useCallback(async () => {
    if (!isLocalLoggedIn || !localSession || !extActor) return;
    try {
      const [banned, expiry] = await Promise.all([
        extActor.isUserBanned(localSession.username),
        extActor.getBanExpiry(localSession.username),
      ]);
      setIsBanned(banned);
      setBanExpiry(expiry ?? null);

      if (!banned && isBanned) {
        // Just got unbanned
        navigate({ to: "/feed" });
      }
    } catch {
      // ignore
    }
  }, [isLocalLoggedIn, localSession, extActor, isBanned, navigate]);

  // Check ban on login and every 30s
  useEffect(() => {
    if (!isLocalLoggedIn) {
      setIsBanned(false);
      return;
    }
    checkBan();
    const interval = setInterval(checkBan, 30_000);
    return () => clearInterval(interval);
  }, [isLocalLoggedIn, checkBan]);

  const handleLogout = async () => {
    await logoutLocal();
    navigate({ to: "/login" });
  };

  if (!isBanned) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)" }}
      data-ocid="ban.modal"
    >
      <div
        className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
        style={{
          background:
            "linear-gradient(135deg, #7f1d1d 0%, #991b1b 40%, #c2410c 100%)",
        }}
      >
        {/* Icon area */}
        <div className="flex flex-col items-center pt-10 pb-6 px-8">
          <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mb-5 shadow-lg shadow-red-900/50">
            <Shield className="h-10 w-10 text-red-200" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2 text-center">
            Account Suspended
          </h2>
          <p className="text-red-200 text-sm text-center leading-relaxed">
            {banExpiry
              ? `You are banned until ${formatBanDate(banExpiry)}.`
              : "Your account has been permanently banned."}
          </p>
          <p className="text-red-300/60 text-xs text-center mt-2">
            {banExpiry
              ? "Access will be automatically restored once the ban expires."
              : "Please contact the admin for further information."}
          </p>
        </div>

        {/* Divider */}
        <div className="mx-8 border-t border-white/10" />

        {/* Log out */}
        <div className="px-8 py-6">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors"
            data-ocid="ban.primary_button"
          >
            <LogOut className="h-4 w-4" />
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
}
