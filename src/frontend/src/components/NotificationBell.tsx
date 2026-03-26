import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type {
  AppNotification,
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
  const nt = notif.notifType as unknown as Record<string, null>;
  const truncated = notif.postText
    ? `${notif.postText.slice(0, 30)}${notif.postText.length > 30 ? "\u2026" : ""}`
    : "";
  if ("like" in nt)
    return `${notif.actorName} liked your post${truncated ? `: ${truncated}` : ""}`;
  if ("comment" in nt)
    return `${notif.actorName} replied to your post${truncated ? `: ${truncated}` : ""}`;
  if ("callRequest" in nt) return `${notif.actorName} is requesting a call`;
  return "New notification";
}

function notifDest(notif: AppNotification): string {
  const nt = notif.notifType as unknown as Record<string, null>;
  if ("callRequest" in nt) return "/cards";
  return "/feed";
}

export function NotificationBell() {
  const { isLocalLoggedIn, localSession } = useLocalAuth();
  const { actor } = useActor();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);

  const extActor = actor as unknown as ExtendedBackend | null;

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

  if (!isLocalLoggedIn) return null;

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleClickNotif = async (notif: AppNotification) => {
    setOpen(false);
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

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full relative"
          data-ocid="nav.bell_button"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 h-4 w-4 min-w-0 p-0 flex items-center justify-center text-[10px] bg-red-500 text-white border-0"
              data-ocid="nav.notification_badge"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80 p-0"
        data-ocid="nav.dropdown_menu"
      >
        <div className="flex items-center justify-between px-4 py-2 border-b border-border">
          <span className="font-semibold text-sm">Notifications</span>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAll}
              className="text-xs text-primary hover:underline"
              data-ocid="nav.mark_all_button"
            >
              Mark all as read
            </button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <div
              className="px-4 py-6 text-center text-sm text-muted-foreground"
              data-ocid="nav.empty_state"
            >
              No notifications yet
            </div>
          ) : (
            notifications.map((notif, idx) => (
              <DropdownMenuItem
                key={notif.id.toString()}
                className={`flex flex-col items-start gap-0.5 px-4 py-3 cursor-pointer text-sm border-b border-border/50 last:border-0 ${
                  !notif.isRead ? "bg-primary/5" : ""
                }`}
                onClick={() => handleClickNotif(notif)}
                data-ocid={`nav.item.${idx + 1}`}
              >
                <span className="leading-snug">{notifLabel(notif)}</span>
                <span className="text-xs text-muted-foreground">
                  {relativeTime(notif.timestamp)}
                </span>
              </DropdownMenuItem>
            ))
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
