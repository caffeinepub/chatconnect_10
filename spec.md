# Wave Chat

## Current State
Full-stack social/voice chat app with bottom nav, calling cards grid, lobby chatroom, call screen with WebRTC, and profile page.

## Requested Changes (Diff)

### Add
- Lobby: horizontal strip at the top of the chat area showing users currently on mic (from voiceParticipants) with their username/display name
- CallScreen: 5-second "call about to start" countdown animation during the connecting phase (before isConnected becomes true), shown in a visually distinct way (large pulsing countdown)

### Modify
- CallingCardsPage: change cards layout from a grid to a horizontal one-at-a-time carousel (snap scroll or prev/next navigation) so cards appear one by one horizontally
- CallingCardsPage: remove the "Back to Lobby" button from the page header
- BottomNav: remove the "Contact Developer / Dev" button entirely from the bottom nav bar
- MyProfilePage: the contact developer link (srklimon3@gmail.com) is already in the profile page footer area — make it a more prominent styled button/card under the profile card
- LobbyPage: adjust the message input area to have more bottom padding (pb-24 or similar) so it is not hidden behind the BottomNav; move the form slightly upward
- CallScreen: 20-minute timer should only START counting down after `isConnected === true` — reset/hold at CALL_DURATION until connected; stop showing timer during connecting phase

### Remove
- BottomNav: Dev/Contact Developer button
- CallingCardsPage: "Back to Lobby" ArrowLeft button

## Implementation Plan
1. BottomNav.tsx: remove the Contact Developer button (last button in the nav)
2. CallingCardsPage.tsx: remove ArrowLeft/Back to Lobby link; replace the grid layout with a horizontal carousel (use snap-x scroll with one card per snap point, add prev/next arrow buttons)
3. LobbyPage.tsx: add a horizontal "On Mic" user strip above the ScrollArea for chat messages (shows voiceParticipants usernames with mic icon); add pb-24 to bottom input area so it clears the nav bar
4. MyProfilePage.tsx: make the contact developer section a proper styled card/button below the profile card
5. CallScreen.tsx: hold timer at CALL_DURATION until isConnected; add 5-second animated countdown (5→4→3→2→1→"Starting!") that plays during the connecting phase before connection is established
