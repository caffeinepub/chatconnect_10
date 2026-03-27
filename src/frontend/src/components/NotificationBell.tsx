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
import { Bell, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type {
  Notification as AppNotification,
  backendInterface as ExtendedBackend,
} from "../backend.d";
import { useIsMobile } from "../hooks/use-mobile";
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

interface NotifPanelContentProps {
  notifications: AppNotification[];
  unreadCount: number;
  onMarkAll: () => void;
  onClickNotif: (notif: AppNotification) => void;
}

function NotifPanelContent({
  notifications,
  unreadCount,
  onMarkAll,
  onClickNotif,
}: NotifPanelContentProps) {
  return (
    <>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="font-semibold text-sm">Notifications</span>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={onMarkAll}
            className="text-xs text-primary hover:underline"
            data-ocid="nav.mark_all_button"
          >
            Mark all as read
          </button>
        )}
      </div>
      <div className="overflow-y-auto flex-1">
        {notifications.length === 0 ? (
          <div
            className="px-4 py-6 text-center text-sm text-muted-foreground"
            data-ocid="nav.empty_state"
          >
            No notifications yet
          </div>
        ) : (
          notifications.map((notif, idx) => (
            <button
              key={notif.id.toString()}
              type="button"
              className={`w-full flex flex-col items-start gap-0.5 px-4 py-3 cursor-pointer text-sm border-b border-border/50 last:border-0 text-left hover:bg-muted/50 transition-colors ${
                !notif.isRead ? "bg-primary/5" : ""
              }`}
              onClick={() => onClickNotif(notif)}
              data-ocid={`nav.item.${idx + 1}`}
            >
              <span className="leading-snug">{notifLabel(notif)}</span>
              <span className="text-xs text-muted-foreground">
                {relativeTime(notif.timestamp)}
              </span>
            </button>
          ))
        )}
      </div>
    </>
  );
}

export function NotificationBell() {
  const { isLocalLoggedIn, localSession } = useLocalAuth();
  const { actor } = useActor();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
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

  const triggerButton = (
    <Button
      variant="ghost"
      size="sm"
      className="rounded-full relative"
      data-ocid="nav.bell_button"
      onClick={isMobile ? () => setOpen((o) => !o) : undefined}
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
  );

  if (isMobile) {
    return (
      <>
        {triggerButton}

        {/* Mobile bottom sheet overlay */}
        {open && (
          <>
            {/* Backdrop */}
            <button
              type="button"
              className="fixed inset-0 bg-black/40 z-40 cursor-default"
              onClick={() => setOpen(false)}
              aria-label="Close notifications"
            />
            {/* Sheet */}
            <div
              className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-2xl shadow-2xl flex flex-col"
              style={{
                maxHeight: "70vh",
                paddingBottom: "env(safe-area-inset-bottom, 0)",
              }}
              data-ocid="nav.popover"
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-2 pb-1">
                <div className="w-10 h-1 rounded-full bg-border" />
              </div>
              <div className="flex items-center justify-between px-4 py-2 border-b border-border">
                <span className="font-semibold text-sm">Notifications</span>
                <div className="flex items-center gap-2">
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
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="p-1 rounded-full hover:bg-muted transition-colors"
                    data-ocid="nav.close_button"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              </div>
              <div className="overflow-y-auto flex-1">
                {notifications.length === 0 ? (
                  <div
                    className="px-4 py-6 text-center text-sm text-muted-foreground"
                    data-ocid="nav.empty_state"
                  >
                    No notifications yet
                  </div>
                ) : (
                  notifications.map((notif, idx) => (
                    <button
                      key={notif.id.toString()}
                      type="button"
                      className={`w-full flex flex-col items-start gap-0.5 px-4 py-3 cursor-pointer text-sm border-b border-border/50 last:border-0 text-left hover:bg-muted/50 transition-colors ${
                        !notif.isRead ? "bg-primary/5" : ""
                      }`}
                      onClick={() => handleClickNotif(notif)}
                      data-ocid={`nav.item.${idx + 1}`}
                    >
                      <span className="leading-snug">{notifLabel(notif)}</span>
                      <span className="text-xs text-muted-foreground">
                        {relativeTime(notif.timestamp)}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </>
    );
  }

  // Desktop: keep existing dropdown
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
        <NotifPanelContent
          notifications={notifications}
          unreadCount={unreadCount}
          onMarkAll={handleMarkAll}
          onClickNotif={handleClickNotif}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
