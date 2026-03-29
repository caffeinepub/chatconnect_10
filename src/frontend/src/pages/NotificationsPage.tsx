import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate } from "@tanstack/react-router";
import { Bell, CheckCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type {
  Notification as AppNotification,
  backendInterface as ExtendedBackend,
} from "../backend.d";
import { BottomNav } from "../components/BottomNav";
import { GlobalCallWatcher } from "../components/GlobalCallWatcher";
import { useActor } from "../hooks/useActor";
import { useLocalAuth } from "../hooks/useLocalAuth";

function relativeTime(timestamp: bigint): string {
  const ms = Number(timestamp / BigInt(1_000_000));
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function notifLabel(notif: AppNotification): string {
  const nt = notif.notifType as string;
  const truncated = notif.postText
    ? `${notif.postText.slice(0, 40)}${notif.postText.length > 40 ? "\u2026" : ""}`
    : "";
  if (nt === "like")
    return `${notif.actorName} liked your post${truncated ? `: ${truncated}` : ""}`;
  if (nt === "comment")
    return `${notif.actorName} replied to your post${truncated ? `: ${truncated}` : ""}`;
  if (nt === "callRequest") return `${notif.actorName} is requesting a call`;
  return "New notification";
}

function notifIcon(notif: AppNotification): string {
  const nt = notif.notifType as string;
  if (nt === "like") return "\u2764\ufe0f";
  if (nt === "comment") return "\ud83d\udcac";
  if (nt === "callRequest") return "\ud83d\udcde";
  return "\ud83d\udd14";
}

function notifDest(notif: AppNotification): string {
  const nt = notif.notifType as string;
  if (nt === "callRequest") return "/cards";
  return "/feed";
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { isLocalLoggedIn, localSession } = useLocalAuth();
  const { actor } = useActor();
  const extActor = actor as unknown as ExtendedBackend | null;

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!isLocalLoggedIn || !localSession || !extActor) return;
    try {
      const notifs = await extActor.getNotificationsAsLocal(localSession.token);
      setNotifications(
        [...notifs].sort((a, b) => Number(b.timestamp - a.timestamp)),
      );
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [isLocalLoggedIn, localSession, extActor]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleClickNotif = async (notif: AppNotification) => {
    if (extActor && localSession) {
      try {
        await extActor.markNotificationReadAsLocal(
          localSession.token,
          notif.id,
        );
      } catch {
        // ignore
      }
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n)),
      );
    }
    navigate({ to: notifDest(notif) });
  };

  const handleMarkAll = async () => {
    if (extActor && localSession) {
      try {
        await extActor.markAllNotificationsReadAsLocal(localSession.token);
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      } catch {
        // ignore
      }
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <GlobalCallWatcher />
      <header className="bg-background border-b border-border px-4 py-3 flex items-center justify-between flex-shrink-0 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg gradient-hero flex items-center justify-center text-white font-bold text-sm">
            W
          </div>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-foreground" />
            <h1 className="font-display font-bold text-lg">Notifications</h1>
            {unreadCount > 0 && (
              <span className="bg-violet-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMarkAll}
            className="flex items-center gap-1.5 text-xs text-primary"
            data-ocid="notifications.secondary_button"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all read
          </Button>
        )}
      </header>

      <ScrollArea className="flex-1 pb-24">
        {loading ? (
          <div
            className="flex items-center justify-center py-16"
            data-ocid="notifications.loading_state"
          >
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-24 px-8 text-center"
            data-ocid="notifications.empty_state"
          >
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Bell className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="font-semibold text-lg text-foreground mb-1">
              No notifications yet
            </p>
            <p className="text-sm text-muted-foreground">
              When someone likes or comments on your posts, or sends a call
              request, you'll see it here.
            </p>
          </div>
        ) : (
          <div className="px-4 py-4 flex flex-col gap-3">
            {notifications.map((notif, idx) => (
              <button
                key={notif.id.toString()}
                type="button"
                onClick={() => handleClickNotif(notif)}
                className={`w-full text-left rounded-2xl p-5 shadow-sm border transition-all active:scale-[0.98] ${
                  !notif.isRead
                    ? "border-l-4 border-l-violet-500 bg-violet-500/5 border-border"
                    : "border-l-4 border-l-transparent bg-card border-border hover:bg-muted/40"
                }`}
                data-ocid={`notifications.item.${idx + 1}`}
              >
                <div className="flex items-start gap-4">
                  <span className="text-2xl flex-shrink-0 mt-0.5">
                    {notifIcon(notif)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold leading-snug text-foreground">
                      {notifLabel(notif)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {relativeTime(notif.timestamp)}
                    </p>
                  </div>
                  {!notif.isRead && (
                    <span className="w-2.5 h-2.5 rounded-full bg-violet-500 flex-shrink-0 mt-1.5" />
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>

      <BottomNav />
    </div>
  );
}
