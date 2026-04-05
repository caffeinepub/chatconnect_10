# Wave Chat

## Current State
The chat/inbox system has persistent bugs where messages fail to appear in conversation threads and the inbox list stays empty. Multiple fixes have been attempted but the root causes were not fully resolved.

## Requested Changes (Diff)

### Add
- Backend: `rebuildConversationIndex` helper called in `postupgrade` to reconstruct the index from all stored `directMessages` (guards against index corruption across upgrades)
- Backend: `getConversationsFallback` — if `conversationIndex` is empty for a user but messages exist, fall back to full scan
- Frontend: Explicit error logging for DM fetch failures (no more silent swallow)
- Frontend: `isFetchingMessages` ref guard (like `isFetchingConvosRef`) to prevent concurrent overlapping fetches
- Frontend: `lastFetchedUser` ref to reset messages immediately when switching conversations

### Modify
- Backend `getConversations`: Remove dependency on `conversationIndex` entirely — always do the full scan over `directMessages`. The index is only used as a fast path hint, not a gate. Remove `partners` variable.
- Backend `sendDirectMessage`: Validate `senderUsername !== recipientUsername`; add explicit `await` comment (already present in Motoko)
- Backend `postupgrade`: After restoring `stableDirectMessages`, call a rebuild pass to re-populate `conversationIndex` from all stored messages (handles corrupt/missing index data from old deploys)
- Frontend `fetchMessages`: Replace `Number(a.timestamp - b.timestamp)` BigInt sort with safe comparator (`a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0`)
- Frontend `fetchMessages`: Add `isFetchingMsgsRef` debounce guard
- Frontend `fetchConversations`: Expose errors to console (not just silently swallowed) so debugging is possible
- Frontend `handleSend`: Scroll to bottom after optimistic append
- Frontend `handleSelectUser`: Immediately clear `messages` state and show loader, preventing stale messages from previous conversation bleeding in
- Frontend polling `useEffect` for messages: Use stable ref for `selectedUser` to prevent unnecessary interval restarts

### Remove
- `partners` array in `getConversations` (unused gate that causes confusion)

## Implementation Plan
1. Fix `getConversations` in Motoko to always full-scan (no partners gate)
2. Add `conversationIndex` rebuild pass in `postupgrade`
3. Fix BigInt sort comparator in `MessagesPage.tsx`
4. Add fetch debounce ref for messages polling
5. Fix stale conversation bleed when switching users
6. Add console.error to catch blocks so failures are visible
7. Validate + deploy
