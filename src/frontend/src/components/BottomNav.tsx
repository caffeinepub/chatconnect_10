import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

  // Presence heartbeat - ping every 30s when logged in
  useEffect(() => {
    if (!isLocalLoggedIn || !localSession || !extActor) return;
    const ping = () => {
      extActor.pingOnline(localSession.token).catch(() => {});
    };
    ping(); // ping immediately on mount
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
        ? "text-violet-600"
        : "text-muted-foreground hover:text-foreground"
    }`;

  const labelClass = "text-[10px] leading-none font-medium";

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border flex items-stretch"
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
      <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex flex-col items-center justify-center gap-0.5 flex-1 min-h-[56px] py-2 transition-colors text-muted-foreground hover:text-foreground"
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
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          side="top"
          className="w-80 p-0 mb-2"
          data-ocid="nav.dropdown_menu"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="font-semibold text-sm">Notifications</span>
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
          </div>
          <ScrollArea className="max-h-72">
            {notifications.length === 0 ? (
              <div
                className="py-8 text-center text-sm text-muted-foreground"
                data-ocid="nav.empty_state"
              >
                No notifications
              </div>
            ) : (
              notifications.slice(0, 20).map((notif, idx) => (
                <DropdownMenuItem
                  key={notif.id.toString()}
                  onClick={() => handleClickNotif(notif)}
                  className={`flex flex-col items-start px-4 py-3 cursor-pointer gap-0.5 ${
                    !notif.isRead ? "bg-primary/5" : ""
                  }`}
                  data-ocid={`nav.item.${idx + 1}`}
                >
                  <span className="text-sm font-medium leading-snug">
                    {notifLabel(notif)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {relativeTime(notif.timestamp)}
                  </span>
                </DropdownMenuItem>
              ))
            )}
          </ScrollArea>
        </DropdownMenuContent>
      </DropdownMenu>

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
