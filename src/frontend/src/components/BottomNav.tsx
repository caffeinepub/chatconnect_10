import { Badge } from "@/components/ui/badge";
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
import type { backendInterface as ExtendedBackend } from "../backend.d";
import { useActor } from "../hooks/useActor";
import { useLocalAuth } from "../hooks/useLocalAuth";

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

  // Unread notifications count (for badge only)
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  const fetchNotifCount = useCallback(async () => {
    if (!isLocalLoggedIn || !localSession || !extActor) return;
    try {
      const notifs = await extActor.getNotificationsAsLocal(localSession.token);
      setUnreadNotifCount(notifs.filter((n) => !n.isRead).length);
    } catch {
      // silently ignore
    }
  }, [isLocalLoggedIn, localSession, extActor]);

  useEffect(() => {
    if (!isLocalLoggedIn) return;
    fetchNotifCount();
    const interval = setInterval(fetchNotifCount, 10_000);
    return () => clearInterval(interval);
  }, [isLocalLoggedIn, fetchNotifCount]);

  // Clear notif badge when on notifications page
  useEffect(() => {
    if (location.pathname === "/notifications") {
      setUnreadNotifCount(0);
    }
  }, [location.pathname]);

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

  // Detect incoming calls for pulsing ring on Calls button
  const [hasIncomingCall, setHasIncomingCall] = useState(false);
  useEffect(() => {
    if (!isLocalLoggedIn || !localSession || !extActor) return;
    const checkIncoming = async () => {
      try {
        const reqs = await (extActor as any).getCallRequestsAsLocal(
          localSession.token,
        );
        const pending = reqs.some(
          (r: any) =>
            r.calleeUsername === localSession.username &&
            r.status === "pending",
        );
        setHasIncomingCall(pending);
      } catch {
        // ignore
      }
    };
    checkIncoming();
    const interval = setInterval(checkIncoming, 2000);
    return () => clearInterval(interval);
  }, [isLocalLoggedIn, localSession, extActor]);

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

      {/* Calls */}
      <button
        type="button"
        className={btnClass("/cards")}
        onClick={() => navigate({ to: "/cards" })}
        data-ocid="nav.cards_link"
      >
        <div className="relative">
          <Phone
            className="h-[20px] w-[20px]"
            style={hasIncomingCall ? { color: "#ef4444" } : {}}
          />
          {hasIncomingCall && (
            <span className="absolute inset-0 rounded-full border-2 border-red-500 animate-ping" />
          )}
          {hasIncomingCall && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-background animate-pulse" />
          )}
        </div>
        <span
          className={labelClass}
          style={hasIncomingCall ? { color: "#ef4444" } : {}}
        >
          Calls
        </span>
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

      {/* Alerts (navigates to full notifications page) */}
      <button
        type="button"
        className={`${btnClass("/notifications")} relative`}
        onClick={() => navigate({ to: "/notifications" })}
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
