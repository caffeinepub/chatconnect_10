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
export type Time = bigint;
export type SessionToken = bigint;

export type CallStatus = "pending" | "accepted" | "ended" | "denied";

export interface CallRequestWithStatus {
    id: bigint;
    timestamp: Time;
    callee: Principal;
    caller: Principal;
    status: CallStatus;
}

export interface CallRequest {
    id: bigint;
    timestamp: Time;
    callee: Principal;
    caller: Principal;
    status: CallStatus;
}

export interface LocalCallRequest {
    id: bigint;
    callerUsername: string;
    calleeUsername: string;
    status: CallStatus;
    timestamp: Time;
}

export interface User {
    fname: string;
    principal: Principal;
    name: string;
    role: UserRole;
    photo?: ExternalBlob;
    telephone: string;
}
export interface Message {
    id: bigint;
    text: string;
    authorName: string;
    author: Principal;
    timestamp: Time;
}
export interface UserProfile {
    fname: string;
    name: string;
    photo?: ExternalBlob;
    telephone: string;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface LocalUser {
    username: string;
    displayName: string;
    passwordHash: string;
    age: bigint;
    photo?: ExternalBlob;
}
export interface Post {
    id: bigint;
    author: Principal;
    authorName: string;
    text: string;
    timestamp: Time;
}
export interface Comment {
    id: bigint;
    postId: bigint;
    author: Principal;
    authorName: string;
    text: string;
    timestamp: Time;
}
export interface VoiceParticipant {
    username: string;
    displayName: string;
    isMicActive: boolean;
}
export interface Signal {
    id: bigint;
    fromUsername: string;
    toUsername: string;
    signalType: string;
    data: string;
    timestamp: Time;
}
export type NotificationType = "like" | "comment" | "callRequest";
export interface AppNotification {
    id: bigint;
    recipientUsername: string;
    notifType: NotificationType;
    actorName: string;
    postId: bigint | null;
    postText: string | null;
    callRequestId: bigint | null;
    timestamp: Time;
    isRead: boolean;
}
export interface DirectMessage {
    id: bigint;
    senderUsername: string;
    recipientUsername: string;
    text: string;
    timestamp: Time;
    isRead: boolean;
}
export interface ConversationSummary {
    otherUsername: string;
    otherDisplayName: string;
    lastMessage: string;
    lastTimestamp: Time;
    unreadCount: bigint;
}
export interface backendInterface {
    // Auth
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    createUser(name: string, fname: string, telephone: string): Promise<void>;
    deleteUser(targetUser: Principal): Promise<void>;
    getCallRequest(id: bigint): Promise<CallRequestWithStatus | null>;
    getCallRequests(): Promise<Array<CallRequestWithStatus>>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getMessage(id: bigint): Promise<Message | null>;
    getMessages(): Promise<Array<Message>>;
    getUser(principal: Principal): Promise<User | null>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    getUsers(): Promise<Array<User>>;
    getUsersCount(): Promise<bigint>;
    isCallerAdmin(): Promise<boolean>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    verifyUser(): Promise<void>;
    // Local account auth
    registerLocalAccount(username: string, passwordHash: string, displayName: string, age: bigint, photo: ExternalBlob | null): Promise<void>;
    loginLocalAccount(username: string, passwordHash: string): Promise<SessionToken>;
    logoutLocalAccount(token: SessionToken): Promise<void>;
    validateSessionToken(token: SessionToken): Promise<string | null>;
    getLocalUserProfile(token: SessionToken): Promise<LocalUser | null>;
    updateLocalUserPhoto(token: SessionToken, photo: ExternalBlob): Promise<void>;
    getLocalUsers(): Promise<Array<LocalUser>>;
    // Messages (lobby)
    sendMessage(text: string): Promise<bigint>;
    sendMessageAsLocal(token: SessionToken, text: string): Promise<bigint>;
    getMessagesAsLocal(token: SessionToken): Promise<Array<Message>>;
    // Direct Messages
    sendDirectMessage(token: SessionToken, recipientUsername: string, text: string): Promise<bigint>;
    getDirectMessages(token: SessionToken, otherUsername: string): Promise<Array<DirectMessage>>;
    getConversations(token: SessionToken): Promise<Array<ConversationSummary>>;
    markDirectMessagesRead(token: SessionToken, otherUsername: string): Promise<void>;
    getUnreadDMCount(token: SessionToken): Promise<bigint>;
    // Posts
    createPost(text: string): Promise<bigint>;
    createPostAsLocal(token: SessionToken, text: string): Promise<bigint>;
    getPosts(): Promise<Array<Post>>;
    getPostsAsLocal(token: SessionToken): Promise<Array<Post>>;
    deletePost(id: bigint): Promise<void>;
    deletePostAsLocal(token: SessionToken, id: bigint): Promise<void>;
    likePost(postId: bigint): Promise<void>;
    likePostAsLocal(token: SessionToken, postId: bigint): Promise<void>;
    unlikePost(postId: bigint): Promise<void>;
    unlikePostAsLocal(token: SessionToken, postId: bigint): Promise<void>;
    getPostLikes(postId: bigint): Promise<Array<string>>;
    getPostLikesAsLocal(token: SessionToken, postId: bigint): Promise<Array<string>>;
    // Comments
    addComment(postId: bigint, text: string): Promise<bigint>;
    addCommentAsLocal(token: SessionToken, postId: bigint, text: string): Promise<bigint>;
    getCommentsForPost(postId: bigint): Promise<Array<Comment>>;
    getCommentsForPostAsLocal(token: SessionToken, postId: bigint): Promise<Array<Comment>>;
    deleteComment(id: bigint): Promise<void>;
    deleteCommentAsLocal(token: SessionToken, id: bigint): Promise<void>;
    // Call requests (Principal-based)
    sendCallRequest(callee: Principal): Promise<bigint>;
    acceptCallRequest(id: bigint): Promise<void>;
    denyCallRequest(id: bigint): Promise<void>;
    endCall(id: bigint): Promise<void>;
    deleteCallRequest(id: bigint): Promise<void>;
    // Call requests (Local/token-based)
    sendCallRequestAsLocal(token: SessionToken, calleeUsername: string): Promise<bigint>;
    getCallRequestsAsLocal(token: SessionToken): Promise<Array<LocalCallRequest>>;
    acceptCallRequestAsLocal(token: SessionToken, id: bigint): Promise<void>;
    denyCallRequestAsLocal(token: SessionToken, id: bigint): Promise<void>;
    endCallAsLocal(token: SessionToken, id: bigint): Promise<void>;
    // Voice channel signaling
    joinVoiceChannel(token: SessionToken): Promise<Array<VoiceParticipant>>;
    leaveVoiceChannel(token: SessionToken): Promise<void>;
    getVoiceParticipants(token: SessionToken): Promise<Array<VoiceParticipant>>;
    sendSignal(token: SessionToken, toUsername: string, signalType: string, data: string): Promise<void>;
    getMySignals(token: SessionToken): Promise<Array<Signal>>;
    setMicActive(token: SessionToken, active: boolean): Promise<void>;
    // Notifications
    getNotificationsAsLocal(token: SessionToken): Promise<Array<AppNotification>>;
    markNotificationReadAsLocal(token: SessionToken, id: bigint): Promise<void>;
    markAllNotificationsReadAsLocal(token: SessionToken): Promise<void>;
}
