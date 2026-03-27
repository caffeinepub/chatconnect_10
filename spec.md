# Wave Chat - Admin Features

## Current State
The app has a placeholder `verifyUser()` backend method that does nothing. There is no verified badge shown in the UI, no ban functionality, and no admin panel. The WILDFIRE username is intended to be the admin account but has no special powers beyond a note in the profile page.

## Requested Changes (Diff)

### Add
- Backend: `grantVerifiedBadge(token, targetUsername)` - admin-only, marks a user as verified
- Backend: `revokeVerifiedBadge(token, targetUsername)` - admin-only, removes verified badge
- Backend: `banLocalUser(token, targetUsername)` - admin-only, bans a user (prevents login)
- Backend: `unbanLocalUser(token, targetUsername)` - admin-only, lifts a ban
- Backend: `isUserVerified(username)` - public query, returns bool
- Backend: `getAllUsersForAdmin(token)` - admin-only, returns list of all local users with verified/banned status
- Backend: `checkIsWildfireAdmin(token)` - returns bool, true only if token belongs to username WILDFIRE
- Backend: login check rejects banned users with error message "Your account has been banned"
- Backend: LocalUser type extended with `isVerified: Bool` and `isBanned: Bool` fields
- Frontend: AdminPanel component - modal/page shown only when logged in as WILDFIRE, lists all users with toggle verified and ban/unban buttons
- Frontend: Verified badge (blue checkmark) shown next to display name on Calling Cards and Profile views
- Frontend: Admin crown/shield badge shown next to WILDFIRE's name everywhere
- Frontend: "Admin Panel" button shown in Profile page only for WILDFIRE

### Modify
- Backend: `loginLocalAccount` - reject if user is banned
- Backend: `LocalUser` record - add `isVerified` and `isBanned` boolean fields
- Backend: `registerLocalAccount` - initialize `isVerified = false`, `isBanned = false`
- Frontend: MyProfilePage - show "Admin Panel" button only when username === "WILDFIRE"
- Frontend: CallingCardsPage - show verified badge next to verified users' names

### Remove
- Backend: old placeholder `verifyUser()` method (replace with real implementation)

## Implementation Plan
1. Extend `LocalUser` type in Motoko with `isVerified: Bool` and `isBanned: Bool`
2. Add `verifiedUsers` and `bannedUsers` sets in backend state
3. Implement `grantVerifiedBadge`, `revokeVerifiedBadge`, `banLocalUser`, `unbanLocalUser` with WILDFIRE-only auth check
4. Implement `isUserVerified(username)` public query
5. Implement `getAllUsersForAdmin(token)` returning extended user data
6. Implement `checkIsWildfireAdmin(token)` helper
7. Patch `loginLocalAccount` to reject banned users
8. Regenerate backend.d.ts with new method signatures
9. Build AdminPanel React component with user list, verify toggles, ban toggles
10. Show verified blue checkmark badge on CallingCardsPage and profile views
11. Show WILDFIRE crown/shield admin badge on profile and calling cards
12. Add "Admin Panel" button to MyProfilePage visible only to WILDFIRE
