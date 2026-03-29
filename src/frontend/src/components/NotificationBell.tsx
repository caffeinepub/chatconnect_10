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

function NotifCard({
  notif,
  idx,
  onClick,
}: { notif: AppNotification; idx: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-xl p-4 mb-2 shadow-sm border transition-colors ${
        !notif.isRead
          ? "border-l-4 border-l-violet-500 bg-violet-500/5 border-border"
          : "border-l-4 border-l-transparent bg-card border-border hover:bg-muted/40"
      }`}
      data-ocid={`nav.item.${idx + 1}`}
    >
      <div className="flex items-start gap-3">
        <span className="text-lg flex-shrink-0 mt-0.5">{notifIcon(notif)}</span>
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

        {open && (
          <>
            <button
              type="button"
              className="fixed inset-0 bg-black/40 z-40 cursor-default"
              onClick={() => setOpen(false)}
              aria-label="Close notifications"
            />
            <div
              className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-2xl shadow-2xl flex flex-col"
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
              <div className="overflow-y-auto flex-1 px-4 py-3">
                {notifications.length === 0 ? (
                  <div
                    className="px-4 py-6 text-center text-sm text-muted-foreground"
                    data-ocid="nav.empty_state"
                  >
                    No notifications yet
                  </div>
                ) : (
                  notifications.map((notif, idx) => (
                    <NotifCard
                      key={notif.id.toString()}
                      notif={notif}
                      idx={idx}
                      onClick={() => handleClickNotif(notif)}
                    />
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </>
    );
  }

  // Desktop dropdown
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
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
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
        <ScrollArea className="max-h-72">
          <div className="px-3 py-3 flex flex-col">
            {notifications.length === 0 ? (
              <div
                className="px-4 py-6 text-center text-sm text-muted-foreground"
                data-ocid="nav.empty_state"
              >
                No notifications yet
              </div>
            ) : (
              notifications.slice(0, 20).map((notif, idx) => (
                <DropdownMenuItem key={notif.id.toString()} asChild>
                  <NotifCard
                    notif={notif}
                    idx={idx}
                    onClick={() => handleClickNotif(notif)}
                  />
                </DropdownMenuItem>
              ))
            )}
          </div>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
