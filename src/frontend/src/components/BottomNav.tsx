import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLocation, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  Inbox,
  MessageCircle,
  Newspaper,
  Phone,
  UserCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type {
  Notification as AppNotification,
  backendInterface as ExtendedBackend,
} from "../backend.d";
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
    ? `${notif.postText.slice(0, 30)}${notif.postText.length > 30 ? "\u2026" : ""}`
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
  if (nt === "like") return "❤️";
  if (nt === "comment") return "💬";
  if (nt === "callRequest") return "📞";
  return "🔔";
}

function notifDest(notif: AppNotification): string {
  const nt = notif.notifType as string;
  if (nt === "callRequest") return "/cards";
  return "/feed";
}

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLocalLoggedIn, localSession } = useLocalAuth();
  const { actor } = useActor();
  const extActor = actor as unknown as ExtendedBackend | null;

  // Unread messages
  const [unreadCount, setUnreadCount] = useState(0);
  const fetchUnread = useCallback(async () => {
    if (!isLocalLoggedIn || !localSession || !extActor) return;
    try {
      const count = await extActor.getUnreadDMCount(localSession.token);
      setUnreadCount(Number(count));
    } catch {
      // silently ignore
    }
  }, [isLocalLoggedIn, localSession, extActor]);

  useEffect(() => {
    if (!isLocalLoggedIn) return;
    fetchUnread();
    const interval = setInterval(fetchUnread, 5_000);
    return () => clearInterval(interval);
  }, [isLocalLoggedIn, fetchUnread]);

  useEffect(() => {
    if (location.pathname === "/messages") {
      setUnreadCount(0);
    }
  }, [location.pathname]);

  // Notifications
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!isLocalLoggedIn || !localSession || !extActor) return;
    try {
      const notifs = await extActor.getNotificationsAsLocal(localSession.token);
      setNotifications(
        [...notifs].sort((a, b) => Number(b.timestamp - a.timestamp)),
      );
    } catch {
      // silently ignore
    }
  }, [isLocalLoggedIn, localSession, extActor]);

  useEffect(() => {
    if (!isLocalLoggedIn) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10_000);
    return () => clearInterval(interval);
  }, [isLocalLoggedIn, fetchNotifications]);

  // Presence heartbeat
  useEffect(() => {
    if (!isLocalLoggedIn || !localSession || !extActor) return;
    const ping = () => {
      extActor.pingOnline(localSession.token).catch(() => {});
    };
    ping();
    const interval = setInterval(ping, 30_000);
    return () => clearInterval(interval);
  }, [isLocalLoggedIn, localSession, extActor]);

  const unreadNotifCount = notifications.filter((n) => !n.isRead).length;

  const handleClickNotif = async (notif: AppNotification) => {
    setNotifOpen(false);
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

  const isActive = (path: string) => location.pathname === path;

  const btnClass = (path: string) =>
    `flex flex-col items-center justify-center gap-0.5 flex-1 min-h-[56px] py-2 transition-colors ${
      isActive(path)
        ? "text-violet-600 dark:text-violet-400"
        : "text-muted-foreground hover:text-foreground"
    }`;

  const labelClass = "text-[10px] leading-none font-medium";

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border flex items-stretch"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      data-ocid="bottom.nav"
    >
      {/* Feed */}
      <button
        type="button"
        className={btnClass("/feed")}
        onClick={() => navigate({ to: "/feed" })}
        data-ocid="nav.feed_link"
      >
        <Newspaper className="h-[20px] w-[20px]" />
        <span className={labelClass}>Feed</span>
      </button>

      {/* Lobby */}
      <button
        type="button"
        className={btnClass("/lobby")}
        onClick={() => navigate({ to: "/lobby" })}
        data-ocid="nav.lobby_link"
      >
        <MessageCircle className="h-[20px] w-[20px]" />
        <span className={labelClass}>Lobby</span>
      </button>

      {/* Calls */}
      <button
        type="button"
        className={btnClass("/cards")}
        onClick={() => navigate({ to: "/cards" })}
        data-ocid="nav.cards_link"
      >
        <Phone className="h-[20px] w-[20px]" />
        <span className={labelClass}>Calls</span>
      </button>

      {/* Inbox (Messages) */}
      <button
        type="button"
        className={`${btnClass("/messages")} relative`}
        onClick={() => navigate({ to: "/messages" })}
        data-ocid="nav.messages_button"
      >
        <div className="relative">
          <Inbox className="h-[20px] w-[20px]" />
          {unreadCount > 0 && (
            <Badge
              className={`absolute -top-2 -right-2 h-4 w-4 min-w-0 p-0 flex items-center justify-center text-[10px] bg-red-500 text-white border-0 ${
                unreadCount > 0 ? "animate-pulse" : ""
              }`}
              data-ocid="nav.messages_badge"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </div>
        <span className={labelClass}>Inbox</span>
      </button>

      {/* Notifications Bell */}
      <div className="flex-1 relative">
        <button
          type="button"
          className="flex flex-col items-center justify-center gap-0.5 w-full min-h-[56px] py-2 transition-colors text-muted-foreground hover:text-foreground"
          onClick={() => setNotifOpen((v) => !v)}
          data-ocid="nav.bell_button"
        >
          <div className="relative">
            <Bell className="h-[20px] w-[20px]" />
            {unreadNotifCount > 0 && (
              <Badge
                className="absolute -top-2 -right-2 h-4 w-4 min-w-0 p-0 flex items-center justify-center text-[10px] bg-red-500 text-white border-0"
                data-ocid="nav.notification_badge"
              >
                {unreadNotifCount > 9 ? "9+" : unreadNotifCount}
              </Badge>
            )}
          </div>
          <span className={labelClass}>Alerts</span>
        </button>

        {/* Notification sheet */}
        {notifOpen && (
          <>
            <button
              type="button"
              className="fixed inset-0 bg-black/40 z-40 cursor-default"
              onClick={() => setNotifOpen(false)}
              aria-label="Close notifications"
            />
            <div
              className="fixed bottom-14 left-0 right-0 z-50 bg-background rounded-t-2xl shadow-2xl flex flex-col border-t border-border"
              style={{
                maxHeight: "70vh",
                paddingBottom: "env(safe-area-inset-bottom, 0)",
              }}
              data-ocid="nav.popover"
            >
              <div className="flex justify-center pt-2 pb-1">
                <div className="w-10 h-1 rounded-full bg-border" />
              </div>
              <div className="flex items-center justify-between px-4 py-2 border-b border-border">
                <span className="font-semibold text-sm">Notifications</span>
                <div className="flex items-center gap-2">
                  {unreadNotifCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAll}
                      className="text-xs text-primary hover:underline"
                      data-ocid="nav.secondary_button"
                    >
                      Mark all read
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setNotifOpen(false)}
                    className="text-xs text-muted-foreground hover:text-foreground px-2 py-0.5"
                    data-ocid="nav.close_button"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div className="px-4 py-3 flex flex-col gap-2">
                  {notifications.length === 0 ? (
                    <div
                      className="py-8 text-center text-sm text-muted-foreground"
                      data-ocid="nav.empty_state"
                    >
                      No notifications
                    </div>
                  ) : (
                    notifications.slice(0, 20).map((notif, idx) => (
                      <button
                        key={notif.id.toString()}
                        type="button"
                        onClick={() => handleClickNotif(notif)}
                        className={`w-full text-left rounded-xl p-4 shadow-sm border transition-colors ${
                          !notif.isRead
                            ? "border-l-4 border-l-violet-500 bg-violet-500/5 border-border"
                            : "border-l-4 border-l-transparent bg-card border-border hover:bg-muted/40"
                        }`}
                        data-ocid={`nav.item.${idx + 1}`}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-lg flex-shrink-0 mt-0.5">
                            {notifIcon(notif)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium leading-snug text-foreground">
                              {notifLabel(notif)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {relativeTime(notif.timestamp)}
                            </p>
                          </div>
                          {!notif.isRead && (
                            <span className="w-2 h-2 rounded-full bg-violet-500 flex-shrink-0 mt-1.5" />
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </>
        )}
      </div>

      {/* My Profile */}
      <button
        type="button"
        className={`${btnClass("/profile")} relative`}
        onClick={() => navigate({ to: "/profile" })}
        data-ocid="nav.profile_link"
      >
        <div
          className="rounded-full p-0.5"
          style={{
            background: isActive("/profile")
              ? "linear-gradient(135deg, #7C3AED, #22C7B7)"
              : "transparent",
          }}
        >
          <UserCircle
            className="h-[20px] w-[20px]"
            style={{
              color: isActive("/profile") ? "white" : undefined,
            }}
          />
        </div>
        <span className={labelClass}>Profile</span>
      </button>
    </nav>
  );
}
