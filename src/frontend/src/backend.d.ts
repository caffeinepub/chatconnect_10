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
export interface DirectMessage {
    id: bigint;
    text: string;
    senderUsername: string;
    isRead: boolean;
    timestamp: Time;
    recipientUsername: string;
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
export interface ProfileSettings {
    hideFollowers: boolean;
    hideFollowing: boolean;
}
export interface ConversationSummary {
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
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    assignRole(user: Principal, role: UserRole): Promise<void>;
    blockUser(token: SessionToken, targetUsername: string): Promise<void>;
    createPost(text: string): Promise<bigint>;
    createPostAsLocal(token: SessionToken, text: string): Promise<bigint>;
    createUser(name: string, fname: string, telephone: string): Promise<void>;
    deleteCallRequest(id: bigint): Promise<void>;
    deleteComment(id: bigint): Promise<void>;
    deleteCommentAsLocal(token: SessionToken, id: bigint): Promise<void>;
    deletePost(id: bigint): Promise<void>;
    deletePostAsLocal(token: SessionToken, id: bigint): Promise<void>;
    deleteUser(targetUser: Principal): Promise<void>;
    denyCallRequest(id: bigint): Promise<void>;
    denyCallRequestAsLocal(token: SessionToken, id: bigint): Promise<void>;
    endCall(id: bigint): Promise<void>;
    endCallAsLocal(token: SessionToken, id: bigint): Promise<void>;
    followUser(token: SessionToken, targetUsername: string): Promise<void>;
    getBlockedUsers(token: SessionToken): Promise<Array<string>>;
    getCallRequest(id: bigint): Promise<CallRequestWithStatus | null>;
    getCallRequests(): Promise<Array<CallRequestWithStatus>>;
    getCallRequestsAsLocal(token: SessionToken): Promise<Array<LocalCallRequest>>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getCommentsForPost(postId: bigint): Promise<Array<Comment>>;
    getCommentsForPostAsLocal(token: SessionToken, postId: bigint): Promise<Array<Comment>>;
    getConversations(token: SessionToken): Promise<Array<ConversationSummary>>;
    getDirectMessages(token: SessionToken, otherUsername: string): Promise<Array<DirectMessage>>;
    getFollowers(token: SessionToken, username: string): Promise<Array<string>>;
    getFollowing(token: SessionToken, username: string): Promise<Array<string>>;
    getLocalUserProfile(token: SessionToken): Promise<LocalUser | null>;
    getLocalUsers(): Promise<Array<LocalUser>>;
    getMessage(id: bigint): Promise<Message | null>;
    getMessages(): Promise<Array<Message>>;
    getMessagesAsLocal(token: SessionToken): Promise<Array<Message>>;
    getMySignals(token: SessionToken): Promise<Array<Signal>>;
    getNotificationsAsLocal(token: SessionToken): Promise<Array<Notification>>;
    getPostLikes(postId: bigint): Promise<Array<string>>;
    getPostLikesAsLocal(token: SessionToken, postId: bigint): Promise<Array<string>>;
    getPosts(): Promise<Array<Post>>;
    getPostsAsLocal(token: SessionToken): Promise<Array<Post>>;
    getProfileSettings(token: SessionToken): Promise<ProfileSettings>;
    getPublicProfileSettings(username: string): Promise<ProfileSettings>;
    getUnreadDMCount(token: SessionToken): Promise<bigint>;
    getUser(principal: Principal): Promise<User | null>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    getUsers(): Promise<Array<User>>;
    getUsersCount(): Promise<bigint>;
    getVoiceParticipants(token: SessionToken): Promise<Array<VoiceParticipant>>;
    isBlocked(token: SessionToken, targetUsername: string): Promise<boolean>;
    isBlockedBy(token: SessionToken, targetUsername: string): Promise<boolean>;
    isCallerAdmin(): Promise<boolean>;
    isFollowing(token: SessionToken, targetUsername: string): Promise<boolean>;
    joinVoiceChannel(token: SessionToken): Promise<Array<VoiceParticipant>>;
    leaveVoiceChannel(token: SessionToken): Promise<void>;
    likePost(postId: bigint): Promise<void>;
    likePostAsLocal(token: SessionToken, postId: bigint): Promise<void>;
    loginLocalAccount(username: string, passwordHash: string): Promise<SessionToken>;
    logoutLocalAccount(token: SessionToken): Promise<void>;
    markAllNotificationsReadAsLocal(token: SessionToken): Promise<void>;
    markDirectMessagesRead(token: SessionToken, otherUsername: string): Promise<void>;
    markNotificationReadAsLocal(token: SessionToken, id: bigint): Promise<void>;
    registerLocalAccount(username: string, passwordHash: string, displayName: string, age: bigint, photo: ExternalBlob | null): Promise<void>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    sendCallRequest(callee: Principal): Promise<bigint>;
    sendCallRequestAsLocal(token: SessionToken, calleeUsername: string): Promise<bigint>;
    sendDirectMessage(token: SessionToken, recipientUsername: string, text: string): Promise<bigint>;
    sendMessage(text: string): Promise<bigint>;
    sendMessageAsLocal(token: SessionToken, text: string): Promise<bigint>;
    sendSignal(token: SessionToken, toUsername: string, signalType: string, data: string): Promise<void>;
    setMicActive(token: SessionToken, active: boolean): Promise<void>;
    unblockUser(token: SessionToken, targetUsername: string): Promise<void>;
    unfollowUser(token: SessionToken, targetUsername: string): Promise<void>;
    unlikePost(postId: bigint): Promise<void>;
    unlikePostAsLocal(token: SessionToken, postId: bigint): Promise<void>;
    updateLocalUserDisplayName(token: SessionToken, newDisplayName: string): Promise<string>;
    updateLocalUserPhoto(token: SessionToken, photo: ExternalBlob): Promise<void>;
    updateProfileSettings(token: SessionToken, hideFollowers: boolean, hideFollowing: boolean): Promise<void>;
    updateUser(photo: ExternalBlob): Promise<void>;
    updateUserWithoutPhoto(name: string, fname: string, telephone: string): Promise<void>;
    validateSessionToken(token: SessionToken): Promise<string | null>;
    verifyUser(): Promise<void>;
}
