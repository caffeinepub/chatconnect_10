// Browser push notification utilities

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  } catch {
    return false;
  }
}

export function showCallNotification(callerName: string) {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  try {
    const n = new Notification("Incoming Call — Wave Chat", {
      body: `${callerName} is calling you`,
      icon: "/favicon.ico",
      tag: "wave-chat-call",
      requireInteraction: true,
    });
    setTimeout(() => n.close(), 20_000);
  } catch {
    // ignore
  }
}

export function showMessageNotification(senderName: string, preview: string) {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  // Don't show when the tab is in focus
  if (document.visibilityState === "visible") return;
  try {
    const n = new Notification(`New message from ${senderName}`, {
      body: preview.slice(0, 80) || "(voice message)",
      icon: "/favicon.ico",
      tag: "wave-chat-dm",
    });
    setTimeout(() => n.close(), 5_000);
  } catch {
    // ignore
  }
}
