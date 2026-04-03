# Wave Chat – Phase 2: Voice UX Redesign & Audio Infrastructure

## Current State
- Backend is stable (v59) with persistent storage, inbox fixes, admin tools, follower/following indexes
- LobbyPage has On Air / Listeners tabs with round avatars and a + button to join voice
- useVoiceChat hook handles WebRTC with 100ms signal polling, ICE candidates, reconnection logic
- Voice participants shown with 48px circles in a horizontal strip at top of lobby
- FeedPage has voice room cards (Music, Chill, Gaming, Rants) that route to /lobby?room=X
- MessagesPage has working DM with delete/pin/read receipts/typing indicator
- MyProfilePage has followers/following counts, language settings, admin panel access
- ThemeEngine is in ThemeContext.tsx with 8 CSS-animated themes
- BottomNav is ordered: Feed → Inbox → Calls → Lobby → Alerts → Profile

## Requested Changes (Diff)

### Add
1. **Wakie-style On Air / Listener Stage UI in LobbyPage:**
   - Top section: Full-width strip of 64px circular avatars for On Air speakers with animated green ring pulse (CSS keyframe pulse, not AudioContext—keep it simple and performant)
   - Middle section: Compact grid of 32px listener avatars with count badge (e.g. "12 listening")
   - Bottom section: Large "Go On Air" / "Leave Air" toggle button + row of controls: Mute, Speaker, React (emoji tray), placeholder Gift button
   - Chat input pinned above controls row, always visible
   - Only the message list scrolls, not the page

2. **Speaker vs Listener stage states:**
   - LISTENER: joined room, speaker on, mic off, shown in listener grid
   - ON_AIR: mic on + speaker on, shown in On Air strip
   - User taps large "Go On Air" button → becomes ON_AIR
   - User taps "Leave Air" → becomes LISTENER (stays in room but mic off)
   - No moderator approval flow needed (keep it simple for now)

3. **Live Reactions in Lobby:**
   - Row of 5 emoji buttons (🔥 ❤️ 😂 👏 🎵) in a tray that slides up from a React button
   - Max 3 reactions per user per 5 seconds (frontend throttle)
   - Reactions float upward from bottom of screen using CSS keyframe animation
   - Reactions are local-only (no backend call needed) for performance

4. **Discovery Feed strip in FeedPage:**
   - Horizontal scrollable strip above the voice room cards showing "Live Now" rooms
   - Each live room card shows room name, emoji, and listener count (from voiceParticipants count)
   - Tapping a live room card navigates to /lobby?room=X
   - Score-based sorting: listenerCount * 2 (simple, no backend changes needed)

5. **Room-specific voice isolation:**
   - useVoiceChat needs a `roomId` parameter (e.g. "lobby", "music", "chill", "gaming", "rants")
   - sendSignal calls should include the room in toUsername prefix or a separate room parameter
   - Participants in different rooms should not receive each other's signals
   - Backend already has sendSignal(token, toUsername, signalType, data) — use a room-prefixed channel: store room in signal toUsername as "room:music:username" format OR add a separate roomId field to signal routing
   - Since backend doesn't have a room field on signals, use a workaround: prefix toUsername with room ID in signal routing, or use separate signal "channels" by adding room to the join/leave calls
   - Simplest approach: join/leave voice channel passes room name via a new `joinVoiceRoom(token, roomId)` call — BUT backend doesn't support this yet
   - ALTERNATIVE (no backend change): use signal data prefix to tag which room a signal belongs to; participants filter signals by room tag
   - Use the signal data prefix approach: when sending signals, prepend `{"room":"music","data":{...}}` — filter on receive to only process signals matching current room

### Modify
1. **LobbyPage voice controls layout:**
   - Replace current small +/Join buttons with large "Go On Air" toggle button (full-width or prominent center button)
   - On Air strip: increase avatar size from 48px to 64px, add CSS animated pulse ring for active speakers
   - Listener section: replace the Listeners tab with a compact grid below the On Air strip
   - Remove the tab switcher (On Air / Listeners) — show both simultaneously: On Air strip at top, Listeners compact grid below it
   - Voice controls (Mute, Speaker, Leave) pinned at bottom above nav

2. **useVoiceChat hook:**
   - Add `roomId` prop so signal processing filters by room
   - Signal data should be tagged with roomId so cross-room signals are ignored
   - When joining a room, pass roomId to joinVoiceChannel (or handle it via signal tagging)

3. **FeedPage voice rooms section:**
   - Add "Live Now" discovery strip above the 4 voice room cards
   - Keep existing room cards but add live participant counts fetched from backend

### Remove
- Remove the On Air / Listeners tab switcher in LobbyPage (show both sections simultaneously)
- Remove Test Mic button from lobby (keep it accessible but less prominent)

## Implementation Plan
1. Update `useVoiceChat` hook to accept `roomId` parameter; tag all signals with room prefix in data payload; filter incoming signals to only process those matching current room
2. Rewrite LobbyPage voice UI: 64px On Air strip (no tabs), compact listener grid, large Go On Air/Leave Air toggle button, emoji reaction tray with floating animations, pinned chat input above bottom controls
3. Update FeedPage to show "Live Now" discovery strip with live participant counts
4. Keep all existing message polling, auth guards, dark mode, theme engine, and BottomNav unchanged
5. No backend changes required for this phase
