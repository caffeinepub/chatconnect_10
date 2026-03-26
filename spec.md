# ChatConnect

## Current State
Full-stack chat/social app with username/password auth, lobby chat, calling cards, voice calls, feed (posts/likes/comments), notifications, and My Profile. Nav bar has Home, Lobby, Feed, Cards, Notifications bell, My Profile. No private direct messaging between users.

## Requested Changes (Diff)

### Add
- `DirectMessage` type in backend: id, senderUsername, recipientUsername, text, timestamp, isRead
- Backend methods:
  - `sendDirectMessage(token, recipientUsername, text)` -> Nat (message id)
  - `getConversations(token)` -> list of conversation summaries (otherUsername, lastMessage, lastTimestamp, unreadCount)
  - `getDirectMessages(token, otherUsername)` -> list of DirectMessage
  - `markDirectMessagesRead(token, otherUsername)` -> void
  - `getUnreadDMCount(token)` -> Nat
- Frontend `/messages` route with MessagesPage component
- MessagesPage: inbox view (list of conversations), click to open chat thread with full message history, real-time polling every 2s
- Send direct message from within MessagesPage and from a user's calling card
- Messages button in top nav bar on ALL pages (Lobby, Feed, CallingCards), showing blinking badge with unread count

### Modify
- All nav bars (LobbyPage, FeedPage, CallingCardsPage, MyProfilePage) to add Messages nav button with unread count badge
- App.tsx to add `/messages` route
- CallingCardsPage: add "Message" button on each calling card to start a DM with that user

### Remove
- Nothing removed

## Implementation Plan
1. Regenerate Motoko backend with DirectMessage type and all DM methods
2. Update backend.d.ts with new types and method signatures
3. Create MessagesPage component with inbox + thread view
4. Add unread DM count polling hook used across all nav bars
5. Add Messages button to all nav bars
6. Add "Message" button on calling cards
7. Add /messages route to App.tsx
