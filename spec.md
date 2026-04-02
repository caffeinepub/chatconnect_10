# Wave Chat – Part 1: Backend Stability & Data Persistence

## Current State
- All backend state uses in-memory `Map.empty<K,V>()` with no stable memory hooks
- Every redeployment wipes all user accounts, messages, sessions, and social data
- Session token stored in localStorage becomes invalid after redeploy (frontend doesn't validate on startup)
- Messaging has intermittent failures; inbox sometimes appears empty
- Login function has a structural issue where ban check is misplaced relative to the password check block

## Requested Changes (Diff)

### Add
- `stable var` arrays for every persistent data collection in main.mo
- `system func preupgrade()` – dumps all Maps/Sets to stable arrays before upgrade
- `system func postupgrade()` – rebuilds Maps/Sets from stable arrays after upgrade
- `validateSessionToken` check on app startup in frontend; if token is stale (backend was redeployed), clear localStorage and redirect to login with a friendly message instead of silent errors

### Modify
- Fix the misplaced ban check in `loginLocalAccount` (currently inside the wrong if block)
- MessagesPage: on load, validate session before fetching; show proper error if session expired
- useLocalAuth: add a `validateOnMount` effect that pings `validateSessionToken` and auto-clears if invalid

### Remove
- Nothing removed

## Implementation Plan
1. Rewrite main.mo: add stable arrays for all 20+ collections, implement preupgrade/postupgrade
2. Fix loginLocalAccount ban check placement bug
3. Update useLocalAuth.ts: on mount, call validateSessionToken; if null, clear session + show "Session expired, please log in again" toast
4. Ensure MessagesPage, FeedPage, etc. don't crash on invalid sessions (they already catch errors, but user should see a clear message)
