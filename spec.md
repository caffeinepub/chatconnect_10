# Wave Chat

## Current State
Wave Chat is a mobile-first social/chat app with username/password auth, lobby chatroom, calling cards, news feed, private messaging (inbox), notifications, profiles, voice/video calls, and admin panel for WILDFIRE.

## Requested Changes (Diff)

### Add
- Viewport meta tag: `user-scalable=no, maximum-scale=1` to disable manual page zoom
- Admin Panel button under Settings gear icon on profile page (in addition to existing profile page access)

### Modify
- **GlobalCallWatcher**: Remove video call toast popup entirely. Remove the regular incoming call toast popup too. Only keep the floating Accept/Deny banner for voice calls (the existing IncomingCallBanner component). Video call requests should show only via banner, not toast.
- **Dark mode**: Ensure ALL pages have full dark mode coverage — Lobby page white portions, app name/header bars, all sub-menus and settings overlays.
- **Messages/DM**: Fix sendDirectMessage so messages actually get stored and displayed. Fix inbox conversations list to populate.
- **Lobby Voice**: Fix On Air (mic on + speaker on) vs Listeners (speaker only, mic off) distinction. Before joining On Air, explicitly request mic permission. User lands in Listeners on join, moves to On Air only when mic is enabled.
- **Video call**: Fix video stream so both parties can see each other. Ensure remote video track is properly rendered.
- **Profile tap**: Tapping any username or profile picture anywhere (Feed posts, Lobby chat, Inbox, Calling cards) navigates to that user's full profile page — not a calling card popup.

### Remove
- Toast popup for incoming voice calls (keep only floating banner)
- Toast popup for video call requests (keep only floating banner if any)

## Implementation Plan
1. Update `src/frontend/index.html` viewport meta to disable user zoom
2. In `GlobalCallWatcher.tsx`: remove both toast() calls for incoming calls and video call signals — let the existing floating banner handle incoming voice calls
3. Fix dark mode in `LobbyPage.tsx`, `BottomNav.tsx`, and any page with white background sections — ensure `dark:bg-*` classes cover all containers
4. Fix `MessagesPage.tsx`: ensure sendDirectMessage is called with correct params and conversations are fetched properly
5. Fix `LobbyPage.tsx` voice: add mic permission request before On Air, track On Air vs Listeners state correctly
6. Fix `VideoCallScreen.tsx`: ensure video tracks are added to peer connection and remote video renders
7. Add clickable username/avatar navigation to profile in Feed, Lobby chat messages, Inbox, CallingCards
8. Add Admin Panel trigger button inside the Settings sheet on MyProfilePage
