# Wave Chat – Full Upgrade Build (vNext)

## Current State

Wave Chat is a Wakie-style social voice platform with:
- Username/password auth with stable memory
- Feed page with posts, likes, comments, auto-refresh
- Lobby (global chatroom) with WebRTC voice, On Air/Listeners tabs
- Multiple themed voice rooms (Music, Chill, Gaming, Rants) accessible from Feed
- Calling cards with horizontal carousel, follow/block, call topics, online indicator
- Private messaging (Inbox) with voice messages, read receipts, typing indicators
- Notifications page
- Profile page with bio, visitors, custom status, settings gear, dark mode toggle
- Admin panel (WILDFIRE) with ban/verify tools
- Theme engine (Light/Dark + 6 animated themes)
- Bottom nav: Feed → Inbox → Calls → Lobby → Alerts → Profile
- GlobalCallWatcher, ServerStatusBanner

## Requested Changes (Diff)

### Add
1. **Stable memory / data persistence** – Backend must use `stable var` for all maps so data survives redeployments. Already partially done but messages were still being lost.
2. **Inbox message reliability** – Fix: messages must send successfully, conversations must load, messages must persist after refresh.
3. **Feed auto-refresh** – Feed should poll every 2s (non-blocking async), not require manual action.
4. **Calling card performance** – Batch all per-card data fetches with `Promise.all`; lazy-load; remove arrow navigation buttons (swipe stays).
5. **Lobby voice bug fix** – Reconnection loop fix: prevent re-processing old signals; deduplicate ICE; ensure audio actually transmits. Use stable `processSignalsRef`.
6. **Lobby UI** – Only the message list scrolls (not the whole page). On Air = mic + speaker on. Listeners = speaker only.
7. **Voice room independence** – Themed rooms (Music, Chill, Gaming, Rants) each use their own signal namespace (roomId prefix on `toUsername`) so they are independent from main lobby.
8. **Call quality** – WebRTC: 100ms polling, iceCandidatePoolSize=10, autoGainControl=false, echoCancellation=true, noiseSuppression=true. Pre-gather ICE. "Connecting..." animation until `iceConnectionState === 'connected'`. Call timer only starts after connection confirmed.
9. **Connecting animation** – Call screen shows 5s countdown pre-call timer, then "Connecting..." pulsing animation until WebRTC is confirmed connected, then starts 20-min countdown.
10. **Video call fix** – Both parties see video; fix local preview attachment; fix signaling for video offers/answers.
11. **Admin system fix** – WILDFIRE check is case-insensitive. Gold crown badge on profile page AND everywhere. Admin panel button in BOTH profile page AND settings gear. Ban/verify/add-admin tools fully functional.
12. **Dark mode full coverage** – Login, Signup, Lobby, calling card header, app name bar, all pages use CSS token colors (no hardcoded white/gray).
13. **Session persistence** – No redirect to login on app reload if token is still valid. Validate token silently before auth guard triggers.
14. **Zoom disabled** – `<meta name="viewport">` must include `user-scalable=no, maximum-scale=1.0`.
15. **Profile page** – WILDFIRE crown badge shown prominently on own profile page. Tapping any username or avatar anywhere opens the full profile page (not a calling card popup).
16. **Language filter** – Users can select languages spoken (English, Hindi, Bengali, Punjabi) on their profile. Calling cards and Feed show a language filter. Backend stores language preferences.
17. **User search** – Dedicated search on Calling Cards page to find users by username or display name.
18. **Trending posts** – Feed shows top-liked posts in last 24h at the top of the Feed.
19. **Activity badges** – "Active Caller" and "Top Poster" auto-awarded to users based on usage; shown on profile and calling cards.
20. **Mutual followers count** – When viewing someone else's profile, show mutual followers count.
21. **Message delete/unsend** – Users can delete their own DMs.
22. **Pin messages** – Users can pin a message in a DM thread; pinned message shown at top of chat.
23. **Sound effects** – In-app sound effects for: new message (soft chime), like (pop), follow (success tone). Using Web Audio API (no file assets needed).
24. **Haptic feedback** – `navigator.vibrate()` on mobile for: incoming call, new DM notification.
25. **Push notifications** – Browser `Notification` API for incoming calls and new DMs.
26. **Background audio** – Calls and lobby voice continue when screen locked or app minimized. MediaSession API set.
27. **Server offline banner** – Auto-ping with backoff; shows recovery notice. Already present, keep it.
28. **Notification center** – Full-page properly formatted, card-style notifications. Already done, keep improved.

### Modify
- Backend: add `stable var` storage for all collections; add `userLanguages` map; add `dmPinned` map; backend functions for language preferences, pin message, delete DM, search users, get trending posts, activity badge tracking.
- FeedPage: trending section at top, 2s non-blocking polling, language filter chip row.
- CallingCardsPage: remove arrow buttons, keep swipe; add search bar; language filter; batch data loads.
- LobbyPage: only message area scrolls; voice room routing uses roomId in signal toUsername.
- MessagesPage: fix message loading/sending; add delete/unsend; add pin message; improve reliability.
- MyProfilePage: show crown badge on own profile for WILDFIRE; show language selection; show activity badges; show mutual followers count when viewing others.
- AdminPanel: ensure ban/verify/add-admin fully functional; add admin role granting.
- BottomNav: keep existing order (Feed→Inbox→Calls→Lobby→Alerts→Profile).
- index.html: add `user-scalable=no` to viewport meta.

### Remove
- Left/right arrow navigation buttons on calling cards carousel (keep horizontal swipe).
- Extra call toast popup (the small toast that appears for incoming calls); keep the floating banner.

## Implementation Plan

### Backend
1. Add stable vars for all collections: localUsers, sessions, posts, comments, likes, notifications, directMessages, followers, following, blockList, voiceSignals, profileVisitors, userBios, userStatuses, callTopics, profileSettings, verifiedUsers, bannedUsers, banExpiry, callTopics, lastSeen, voiceParticipants.
2. Add `stable var userLanguages = Map<Text, [Text]>` – setUserLanguages, getUserLanguages.
3. Add `dmPinned` map: `stable var dmPinned = Map<Text, Nat>` (key = conversation key, value = message id).
4. Add `pinDirectMessage(token, otherUsername, messageId)`, `getPinnedMessage(token, otherUsername)`.
5. Add `deleteDirectMessage(token, messageId)` – can only delete own messages.
6. Add `searchUsers(query)` – returns matching LocalUser array.
7. Add `getTrendingPosts(token)` – returns top-liked posts in last 24h.
8. Add activity tracking: `callCount` per user, `postCount` per user; badges auto-awarded.
9. Add `getUserActivityBadges(username)` – returns ["Active Caller", "Top Poster"] based on counts.
10. Add `getMutualFollowers(token, targetUsername)` – intersection of my followers and their followers.
11. Ensure all Maps/Sets are declared as `stable var` so data persists across upgrades.

### Frontend
1. index.html: add `user-scalable=no, maximum-scale=1.0` to viewport.
2. FeedPage: add trending section, language filter chips, 2s non-blocking poll.
3. CallingCardsPage: remove arrows, add search bar, language filter, batch data, show activity badges.
4. LobbyPage: fix scroll layout, voice room namespacing, reconnection fix.
5. MessagesPage: fix reliability, add delete/unsend, pin message UI.
6. MyProfilePage: WILDFIRE crown on own profile, language selection, activity badges, mutual followers.
7. AdminPanel: ensure all tools work; add addAdmin/removeAdmin buttons.
8. Sound effects utility: Web Audio API tones for message/like/follow.
9. Haptic feedback: wrap navigator.vibrate calls.
10. Push notification helper: request permission, show notification for calls/DMs.
11. Dark mode: audit all pages, replace any hardcoded bg-white/bg-gray-* with bg-background/bg-card tokens.
12. Profile page: WILDFIRE gets special crown section at top of own profile.
