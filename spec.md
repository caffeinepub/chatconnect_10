# Wave Chat

## Current State
Wave Chat is a mobile-first social/voice chat app. Current features include: username/password auth, lobby chatroom, calling cards with WebRTC voice calls, news feed with likes/comments, private messaging (Inbox), notification bell, profile pages, admin panel (WILDFIRE), verified badges, ban system (no duration), dark mode toggle, online/offline dots on calling cards, bio/about, profile visit counter, custom status, read receipts, typing indicators.

The BottomNav uses `bg-white` (not dark-mode aware). Notification items are simple list rows (no card padding). Feed has no auto-refresh. The ban system has no duration - it's indefinite with no expiry. The AdminPanel's `banLocalUser` takes no duration parameter.

## Requested Changes (Diff)

### Add
- Global dark mode: BottomNav, ServerStatusBanner, all nav chrome must respect dark mode (use `bg-background` not hardcoded `bg-white`)
- Card-style notifications: each notification item becomes a rounded card with more vertical padding (p-4), subtle shadow, unread indicator as left border accent
- Feed auto-refresh: poll `getPostsAsLocal` every 3 seconds (already polls but may not in all code paths - ensure it runs and is fast)
- Green online dot on profile pictures in chat thread headers, conversation list avatars, and calling card avatars
- Voice messages in DMs: hold-to-record button in ChatWindow, preview before send, send as base64 data URI prefixed with `[VOICE]` in the message text field
- Voice messages in Lobby: record button in LobbyPage message area
- Push notifications: use browser Notification API for incoming call requests and new DMs (request permission on login)
- Language tags on all feed posts (already partially done - ensure visible on every post card)
- One-tap profile access: clicking any username or avatar in Feed, Lobby messages, or calling card areas navigates to `/profile?user=<username>`
- Inbox Calling: phone icon button in MessagesPage chat header (when thread is open) - tapping sends a call request to that user
- Ban duration presets in AdminPanel: when banning, show a picker with "10 min", "24 hours", "7 days" before confirming. Pass duration in nanoseconds to new `banLocalUserWithDuration` backend method
- Ban Shield: after login, if user is banned, show a full-screen non-dismissible overlay "You are banned until [formatted date/time]". Check `isUserBanned` and new `getBanExpiry` backend method
- Auto-Unlock: on ban shield screen, poll every 30s; when ban expires, auto-redirect to feed

### Modify
- `AdminUserInfo` type: add `banExpiresAt?: bigint` field
- AdminPanel: replace single "Ban" button with ban-duration picker flow; show ban expiry time next to BANNED badge
- BottomNav: change `bg-white` to `bg-background` and `border-t border-border` stays; ensure text colors use CSS vars
- NotificationBell: redesign items as cards (rounded-xl, p-4, shadow-sm, left border for unread)
- FeedPage: add 3s polling interval on posts

### Remove
- Nothing removed

## Implementation Plan
1. Edit `src/backend/main.mo`: add `banExpiry` map (`Map<Text, Time.Time>`), add `banLocalUserWithDuration(token, username, durationNs)` function that sets expiry, modify `isUserBanned` query to check expiry and auto-remove if expired, add `getBanExpiry(username)` query returning `?Time.Time`, update `AdminUserInfo` to include `banExpiresAt`
2. Edit `src/frontend/src/backend.d.ts`: add `banLocalUserWithDuration`, `getBanExpiry` methods; add `banExpiresAt?: Time` to `AdminUserInfo`
3. Frontend agent handles all UI changes: dark mode in BottomNav/nav chrome, card notifications, feed refresh, online dots in DM avatars, voice messages (record/playback in DMs and Lobby), push notifications, language tags on posts, one-tap profile nav, inbox call button, AdminPanel ban duration UI, BanShield component
