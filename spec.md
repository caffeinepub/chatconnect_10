# Wave Chat – Phase 1: Core Architecture & Critical Debugging

## Current State

The app has a Motoko backend with stable memory hooks and a React frontend. Three critical systems are broken:

1. **Inbox**: Messages are stored in a flat `Map<Nat, DirectMessage>` with no per-user index. `getConversations` does O(n) full-table scans. Frontend has no debounce on polling so concurrent fetches create React state races. Loading state logic leaves the inbox stuck on empty when actor initializes slowly.

2. **Admin**: `isWildfireToken()` uses `username == "WILDFIRE"` (exact case-sensitive match). `registerLocalAccount` stores usernames as-is without normalization. A user registering as `wildfire` triggers admin panel rendering (frontend check is `toUpperCase() === "WILDFIRE"`) but every backend admin call traps with Unauthorized. `loginLocalAccount` returns only a `SessionToken` bigint — no `isAdmin` field.

3. **Followers/Following**: Two in-memory indexes (`followers`, `following`) exist and are correctly maintained atomically. But the profile page for OTHER users never fetches their follower/following counts — it only fetches for the current logged-in user. `getProfile` does not return follower/following counts, requiring a separate round trip.

## Requested Changes (Diff)

### Add
- `conversationIndex: Map<Text, Set<Text>>` — per-user index of conversation partners, updated on every `sendDirectMessage`, serialized in stable memory
- `isAdmin: Bool` field returned in login response (as a record `{ token: SessionToken; isAdmin: Bool }`)
- `getProfileWithSocial(token, targetUsername)` — returns profile + follower count + following count + isFollowing in a single call
- Stable var for `stableConversationIndex: [(Text, [Text])]`

### Modify
- `registerLocalAccount`: normalize username to lowercase before storing
- `loginLocalAccount`: return `{ token: SessionToken; isAdmin: Bool }` instead of bare `SessionToken`
- `isWildfireToken`: compare `Text.toLower(username) == "wildfire"`
- `sendDirectMessage`: update `conversationIndex` for both sender and recipient on every send
- `getConversations`: use `conversationIndex` instead of full O(n) scan
- `getAllUsersForAdmin`: sort results by `createdAt` for deterministic order
- `getFollowers` / `getFollowing`: accept target username directly (no token required for public social graph lookup)
- Frontend `MessagesPage`: add debounce flag to prevent concurrent fetch overlaps; ensure `isLoadingConvos` is set to false after actor becomes ready
- Frontend `MyProfilePage`: fetch followers/following for the viewed user (not always current user) when viewing another user's profile
- Frontend `AdminPanel`: retry logic on `getAllUsersForAdmin`, show error state with retry button
- Frontend `useLocalAuth`: read `isAdmin` from login response and store in session
- All frontend canister calls: wrap in `try/catch` with retry(3) logic

### Remove
- Case-sensitive `== "WILDFIRE"` string comparison in backend
- `setIsLoadingConvos(true)` in early-return branches of `fetchConversations` that never get unset

## Implementation Plan

1. **Backend (main.mo)**:
   - Add `stableConversationIndex: [(Text, [Text])]` stable var
   - Add `conversationIndex: Map<Text, Set<Text>>` in-memory map
   - Normalize username to lowercase in `registerLocalAccount`
   - Change `isWildfireToken` to use case-insensitive comparison
   - Modify `loginLocalAccount` return type to `{ token: SessionToken; isAdmin: Bool }`
   - Modify `sendDirectMessage` to update `conversationIndex` for both users
   - Modify `getConversations` to use `conversationIndex` for O(1) lookup
   - Add `getProfileWithSocial` function returning profile + social counts
   - Sort `getAllUsersForAdmin` results by username for determinism
   - Serialize/restore `conversationIndex` in preupgrade/postupgrade

2. **Frontend**:
   - Update `backend.d.ts` to reflect new `loginLocalAccount` return type
   - Update `useLocalAuth.ts` to read `{ token, isAdmin }` from login and store `isAdmin`
   - Update `MessagesPage.tsx`: debounce flag, fix loading state, actor guard
   - Update `MyProfilePage.tsx`: fetch followers/following for viewed user, use `getProfileWithSocial`
   - Update `AdminPanel.tsx`: retry logic, better error state
   - Add global `actorReady` guard pattern in a shared util
   - Wrap all canister calls in try/catch with retry
