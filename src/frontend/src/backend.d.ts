import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export class ExternalBlob {
    getBytes(): Promise<Uint8Array<ArrayBuffer>>;
    getDirectURL(): string;
    static fromURL(url: string): ExternalBlob;
    static fromBytes(blob: Uint8Array<ArrayBuffer>): ExternalBlob;
    withUploadProgress(onProgress: (percentage: number) => void): ExternalBlob;
}
export interface Signal {
    id: bigint;
    data: string;
    toUsername: string;
    timestamp: Time;
    fromUsername: string;
    signalType: string;
}
export interface VoiceParticipant {
    username: string;
    displayName: string;
    isMicActive: boolean;
}
export type Time = bigint;
export interface Comment {
    id: bigint;
    text: string;
    authorName: string;
    author: Principal;
    timestamp: Time;
    postId: bigint;
}
export interface User {
    fname: string;
    principal: Principal;
    name: string;
    role: UserRole;
    photo?: ExternalBlob;
    telephone: string;
}
export interface LocalCallRequest {
    id: bigint;
    status: CallStatus;
    callerUsername: string;
    timestamp: Time;
    calleeUsername: string;
}
export interface MessageReaction {
    emoji: string;
    timestamp: Time;
    reactorUsername: string;
}
export interface LocalUser {
    age: bigint;
    username: string;
    displayName: string;
    lastNameChange?: Time;
    passwordHash: string;
    photo?: ExternalBlob;
}
export interface CallRequestWithStatus {
    id: bigint;
    status: CallStatus;
    timestamp: Time;
    callee: Principal;
    caller: Principal;
}
export interface Post {
    id: bigint;
    text: string;
    authorName: string;
    author: Principal;
    timestamp: Time;
}
export type SessionToken = bigint;
export interface Notification {
    id: bigint;
    postText?: string;
    callRequestId?: bigint;
    actorName: string;
    notifType: NotificationType;
    isRead: boolean;
    timestamp: Time;
    recipientUsername: string;
    postId?: bigint;
}
export interface Message {
    id: bigint;
    text: string;
    authorName: string;
    author: Principal;
    timestamp: Time;
}
export interface AdminUserInfo {
    username: string;
    displayName: string;
    banExpiresAt?: Time;
    email?: string;
    isVerified: boolean;
    isBanned: boolean;
}
export interface ProfileSettings {
    hideFollowers: boolean;
    hideFollowing: boolean;
}
export interface ConversationSummary {
    lastMessageIsRead: boolean;
    lastMessageSender: string;
    otherUsername: string;
    lastMessage: string;
    unreadCount: bigint;
    lastTimestamp: Time;
    otherDisplayName: string;
}
export interface UserProfile {
    fname: string;
    name: string;
    photo?: ExternalBlob;
    telephone: string;
}
export interface DirectMessage {
    id: bigint;
    text: string;
    senderUsername: string;
    isRead: boolean;
    timestamp: Time;
    recipientUsername: string;
}
export enum CallStatus {
    pending = "pending",
    denied = "denied",
    ended = "ended",
    accepted = "accepted"
}
export enum NotificationType {
    like = "like",
    comment = "comment",
    callRequest = "callRequest"
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    acceptCallRequest(id: bigint): Promise<void>;
    acceptCallRequestAsLocal(token: SessionToken, id: bigint): Promise<void>;
    addComment(postId: bigint, text: string): Promise<bigint>;
    addCommentAsLocal(token: SessionToken, postId: bigint, text: string): Promise<bigint>;
    addMessageReaction(token: SessionToken, msgId: bigint, emoji: string): Promise<void>;
    assignRole(user: Principal, role: UserRole): Promise<void>;
    banLocalUser(token: SessionToken, targetUsername: string): Promise<void>;
    banLocalUserWithDuration(token: SessionToken, targetUsername: string, durationNs: bigint): Promise<void>;
    blockUser(token: SessionToken, targetUsername: string): Promise<void>;
    checkIsWildfireAdmin(token: SessionToken): Promise<boolean>;
    clearCallTopic(token: SessionToken): Promise<void>;
    createPost(text: string): Promise<bigint>;
    createPostAsLocal(token: SessionToken, text: string): Promise<bigint>;
    createUser(name: string, fname: string, telephone: string): Promise<void>;
    deleteCallRequest(id: bigint): Promise<void>;
    deleteComment(id: bigint): Promise<void>;
    deleteCommentAsLocal(token: SessionToken, id: bigint): Promise<void>;
    deleteDirectMessage(token: SessionToken, msgId: bigint): Promise<void>;
    deletePost(id: bigint): Promise<void>;
    deletePostAsLocal(token: SessionToken, id: bigint): Promise<void>;
    deleteUser(targetUser: Principal): Promise<void>;
    denyCallRequest(id: bigint): Promise<void>;
    denyCallRequestAsLocal(token: SessionToken, id: bigint): Promise<void>;
    endCall(id: bigint): Promise<void>;
    endCallAsLocal(token: SessionToken, id: bigint): Promise<void>;
    followUser(token: SessionToken, targetUsername: string): Promise<void>;
    getAllUsersForAdmin(token: SessionToken): Promise<Array<AdminUserInfo>>;
    getBanExpiry(username: string): Promise<Time | null>;
    getBlockedUsers(token: SessionToken): Promise<Array<string>>;
    getCallRequest(id: bigint): Promise<CallRequestWithStatus | null>;
    getCallRequests(): Promise<Array<CallRequestWithStatus>>;
    getCallRequestsAsLocal(token: SessionToken): Promise<Array<LocalCallRequest>>;
    getCallTopic(username: string): Promise<string | null>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCommentsForPost(postId: bigint): Promise<Array<Comment>>;
    getCommentsForPostAsLocal(token: SessionToken, postId: bigint): Promise<Array<Comment>>;
    getConversations(token: SessionToken): Promise<Array<ConversationSummary>>;
    getDirectMessages(token: SessionToken, otherUsername: string): Promise<Array<DirectMessage>>;
    getFollowers(token: SessionToken, username: string): Promise<Array<string>>;
    getFollowing(token: SessionToken, username: string): Promise<Array<string>>;
    getLocalUserProfile(token: SessionToken): Promise<LocalUser | null>;
    getLocalUsers(): Promise<Array<LocalUser>>;
    getMessage(id: bigint): Promise<Message | null>;
    getMessageReactions(token: SessionToken, msgId: bigint): Promise<Array<MessageReaction>>;
    getMessages(): Promise<Array<Message>>;
    getMessagesAsLocal(token: SessionToken): Promise<Array<Message>>;
    getMySignals(token: SessionToken): Promise<Array<Signal>>;
    getNotificationsAsLocal(token: SessionToken): Promise<Array<Notification>>;
    getOnlineUsernames(): Promise<Array<string>>;
    getPinnedMessage(token: SessionToken, otherUsername: string): Promise<DirectMessage | null>;
    getPostLikes(postId: bigint): Promise<Array<string>>;
    getPostLikesAsLocal(token: SessionToken, postId: bigint): Promise<Array<string>>;
    getPosts(): Promise<Array<Post>>;
    getPostsAsLocal(token: SessionToken): Promise<Array<Post>>;
    getProfileSettings(token: SessionToken): Promise<ProfileSettings>;
    getProfileVisitors(token: SessionToken, username: string): Promise<{
        visitors: Array<string>;
        count: bigint;
    }>;
    getProfileWithSocial(token: SessionToken, targetUsername: string): Promise<{
        isVerified: boolean;
        isFollowing: boolean;
        followerCount: bigint;
        followingCount: bigint;
        profile?: LocalUser;
    }>;
    getPublicProfileSettings(username: string): Promise<ProfileSettings>;
    getReshareCount(postId: bigint): Promise<bigint>;
    getTypingStatus(token: SessionToken, otherUsername: string): Promise<boolean>;
    getUnreadDMCount(token: SessionToken): Promise<bigint>;
    getUser(principal: Principal): Promise<User | null>;
    getUserBadges(username: string): Promise<Array<string>>;
    getUserBio(username: string): Promise<string | null>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    getUserStatus(username: string): Promise<string | null>;
    getUsers(): Promise<Array<User>>;
    getUsersCount(): Promise<bigint>;
    getUsersForMatching(token: SessionToken): Promise<Array<LocalUser>>;
    getVoiceParticipants(token: SessionToken): Promise<Array<VoiceParticipant>>;
    grantVerifiedBadge(token: SessionToken, targetUsername: string): Promise<void>;
    isBlocked(token: SessionToken, targetUsername: string): Promise<boolean>;
    isBlockedBy(token: SessionToken, targetUsername: string): Promise<boolean>;
    isFollowing(token: SessionToken, targetUsername: string): Promise<boolean>;
    isUserBanned(username: string): Promise<boolean>;
    isUserVerified(username: string): Promise<boolean>;
    joinVoiceChannel(token: SessionToken): Promise<Array<VoiceParticipant>>;
    leaveVoiceChannel(token: SessionToken): Promise<void>;
    likePost(postId: bigint): Promise<void>;
    likePostAsLocal(token: SessionToken, postId: bigint): Promise<void>;
    loginLocalAccount(username: string, passwordHash: string): Promise<{
        token: SessionToken;
        isAdmin: boolean;
    }>;
    logoutLocalAccount(token: SessionToken): Promise<void>;
    markAllNotificationsReadAsLocal(token: SessionToken): Promise<void>;
    markDirectMessagesRead(token: SessionToken, otherUsername: string): Promise<void>;
    markNotificationReadAsLocal(token: SessionToken, id: bigint): Promise<void>;
    pinDirectMessage(token: SessionToken, otherUsername: string, msgId: bigint): Promise<void>;
    pingOnline(token: SessionToken): Promise<void>;
    recordProfileVisit(token: SessionToken, visitedUsername: string): Promise<void>;
    registerLocalAccount(username: string, passwordHash: string, displayName: string, age: bigint, photo: ExternalBlob | null): Promise<void>;
    removeMessageReaction(token: SessionToken, msgId: bigint, emoji: string): Promise<void>;
    resetPasswordAsAdmin(token: SessionToken, targetUsername: string, newPasswordHash: string): Promise<void>;
    resharePost(token: SessionToken, originalPostId: bigint): Promise<bigint>;
    revokeVerifiedBadge(token: SessionToken, targetUsername: string): Promise<void>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    sendCallRequest(callee: Principal): Promise<bigint>;
    sendCallRequestAsLocal(token: SessionToken, calleeUsername: string): Promise<bigint>;
    sendDirectMessage(token: SessionToken, recipientUsername: string, text: string): Promise<bigint>;
    sendMessage(text: string): Promise<bigint>;
    sendMessageAsLocal(token: SessionToken, text: string): Promise<bigint>;
    sendSignal(token: SessionToken, toUsername: string, signalType: string, data: string): Promise<void>;
    setCallTopic(token: SessionToken, topic: string): Promise<void>;
    setMicActive(token: SessionToken, active: boolean): Promise<void>;
    setTypingStatus(token: SessionToken, otherUsername: string, isTyping: boolean): Promise<void>;
    setUserEmail(token: SessionToken, email: string): Promise<void>;
    setUserStatus(token: SessionToken, status: string): Promise<void>;
    trackCallActivity(token: SessionToken): Promise<void>;
    unbanLocalUser(token: SessionToken, targetUsername: string): Promise<void>;
    unblockUser(token: SessionToken, targetUsername: string): Promise<void>;
    unfollowUser(token: SessionToken, targetUsername: string): Promise<void>;
    unlikePost(postId: bigint): Promise<void>;
    unlikePostAsLocal(token: SessionToken, postId: bigint): Promise<void>;
    updateLocalUserBio(token: SessionToken, bio: string): Promise<void>;
    updateLocalUserDisplayName(token: SessionToken, newDisplayName: string): Promise<string>;
    updateLocalUserPhoto(token: SessionToken, photo: ExternalBlob): Promise<void>;
    updateProfileSettings(token: SessionToken, hideFollowers: boolean, hideFollowing: boolean): Promise<void>;
    updateUser(photo: ExternalBlob): Promise<void>;
    updateUserWithoutPhoto(name: string, fname: string, telephone: string): Promise<void>;
    validateSessionToken(token: SessionToken): Promise<string | null>;
    verifyUser(): Promise<void>;
}
