import MixinStorage "blob-storage/Mixin";
import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";
import Storage "blob-storage/Storage";
import Iter "mo:core/Iter";
import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Time "mo:core/Time";
import Text "mo:core/Text";
import Array "mo:core/Array";
import Set "mo:core/Set";

actor {
  type SessionToken = Nat;
  type NotificationType = { #like; #comment; #callRequest };

  let accessControlState = AccessControl.initState();
  let messages = Map.empty<Nat, Message>();
  let callRequests = Map.empty<Nat, CallRequest>();
  let acceptedCallIds = Map.empty<Nat, Bool>();
  let localCallRequests = Map.empty<Nat, LocalCallRequest>();
  let posts = Map.empty<Nat, Post>();
  let likes = Map.empty<Nat, Map.Map<Principal, Text>>();
  let comments = Map.empty<Nat, Comment>();
  let notifications = Map.empty<Nat, Notification>();
  let directMessages = Map.empty<Nat, DirectMessage>();
  let conversationIndex = Map.empty<Text, Set.Set<Text>>();
  let verifiedUsers = Set.empty<Text>();
  let bannedUsers = Set.empty<Text>();
  let banExpiry = Map.empty<Text, Time.Time>();
  stable var nextId = 0;
  stable var nextTokenId : Nat = 1;
  stable var nextSignalId : Nat = 0;
  stable var nextNotificationId : Nat = 0;
  stable var nextDmId : Nat = 0;
  let typingStatus = Map.empty<Text, Time.Time>(); // key: "sender_recipient"

  type Message = {
    id : Nat;
    author : Principal;
    authorName : Text;
    text : Text;
    timestamp : Time.Time;
  };

  type Post = {
    id : Nat;
    author : Principal;
    authorName : Text;
    text : Text;
    timestamp : Time.Time;
  };

  type Comment = {
    id : Nat;
    postId : Nat;
    author : Principal;
    authorName : Text;
    text : Text;
    timestamp : Time.Time;
  };

  type User = {
    principal : Principal;
    name : Text;
    fname : Text;
    telephone : Text;
    role : AccessControl.UserRole;
    photo : ?Storage.ExternalBlob;
  };

  type CallStatus = { #pending; #accepted; #ended; #denied };

  type CallRequest = {
    id : Nat;
    caller : Principal;
    callee : Principal;
    timestamp : Time.Time;
  };

  type CallRequestWithStatus = {
    id : Nat;
    caller : Principal;
    callee : Principal;
    timestamp : Time.Time;
    status : CallStatus;
  };

  type LocalCallRequest = {
    id : Nat;
    callerUsername : Text;
    calleeUsername : Text;
    status : CallStatus;
    timestamp : Time.Time;
  };

  type LocalUser = {
    username : Text;
    passwordHash : Text;
    displayName : Text;
    age : Nat;
    photo : ?Storage.ExternalBlob;
    lastNameChange : ?Time.Time;
  };

  type VoiceParticipant = {
    username : Text;
    displayName : Text;
    isMicActive : Bool;
  };

  type Signal = {
    id : Nat;
    fromUsername : Text;
    toUsername : Text;
    signalType : Text;
    data : Text;
    timestamp : Time.Time;
  };

  type Notification = {
    id : Nat;
    recipientUsername : Text;
    notifType : NotificationType;
    actorName : Text;
    postId : ?Nat;
    postText : ?Text;
    callRequestId : ?Nat;
    timestamp : Time.Time;
    isRead : Bool;
  };

  type DirectMessage = {
    id : Nat;
    senderUsername : Text;
    recipientUsername : Text;
    text : Text;
    timestamp : Time.Time;
    isRead : Bool;
  };

  type ConversationSummary = {
    otherUsername : Text;
    otherDisplayName : Text;
    lastMessage : Text;
    lastTimestamp : Time.Time;
    unreadCount : Nat;
    lastMessageSender : Text;
    lastMessageIsRead : Bool;
  };

  type ProfileSettings = {
    hideFollowers : Bool;
    hideFollowing : Bool;
  };

  include MixinStorage();
  include MixinAuthorization(accessControlState);

  let users = Map.empty<Principal, User>();
  let localUsers = Map.empty<Text, LocalUser>();
  let userBios = Map.empty<Text, Text>();
  let sessions = Map.empty<SessionToken, Text>();
  let voiceParticipants = Map.empty<Text, VoiceParticipant>();
  let voiceSignals = Map.empty<Nat, Signal>();
  let lastSeen = Map.empty<Text, Time.Time>();
  let profileVisitors = Map.empty<Text, Set.Set<Text>>();
  let userStatuses = Map.empty<Text, Text>();

  func validateToken(token : SessionToken) : ?Text {
    sessions.get(token)
  };

  func getLocalUserPrincipal(username : Text) : Principal {
    Principal.fromText("2vxsx-fae")
  };

  func createNotification(
    recipientUsername : Text,
    notifType : NotificationType,
    actorName : Text,
    postId : ?Nat,
    postText : ?Text,
    callRequestId : ?Nat,
  ) {
    let id = nextNotificationId;
    nextNotificationId += 1;
    let notif : Notification = {
      id;
      recipientUsername;
      notifType;
      actorName;
      postId;
      postText;
      callRequestId;
      timestamp = Time.now();
      isRead = false;
    };
    notifications.add(id, notif);
  };

  // Helper function to check if userA blocked userB
  func isUserBlocked(userA : Text, userB : Text) : Bool {
    switch (blockList.get(userA)) {
      case (?blocks) { blocks.contains(userB) };
      case (null) { false };
    };
  };

  // Helper function to check if either user blocked the other
  func areUsersBlocked(userA : Text, userB : Text) : Bool {
    isUserBlocked(userA, userB) or isUserBlocked(userB, userA)
  };

  // ---- New Features ----

  // 1. Display name change with 15-day lock
  public shared func updateLocalUserDisplayName(token : SessionToken, newDisplayName : Text) : async Text {
    let username = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };
    let localUser = switch (localUsers.get(username)) {
      case (?u) { u };
      case (null) { Runtime.trap("Local user not found") };
    };
    let now = Time.now();
    let daysInNs : Int = 15 * 24 * 60 * 60 * 1000000000;
    switch (localUser.lastNameChange) {
      case (null) { /* Allow if never changed */ };
      case (?lastChange) {
        let elapsed = now - lastChange;
        if (elapsed < daysInNs) {
          let remainingDays : Nat = ((daysInNs - elapsed) / (24 * 60 * 60 * 1000000000)).toNat();
          return "locked:" # remainingDays.toText();
        };
      };
    };
    let updatedUser : LocalUser = { localUser with displayName = newDisplayName; lastNameChange = ?now };
    localUsers.add(username, updatedUser);
    "ok";
  };

  // 2. Follow/Unfollow system
  let followers = Map.empty<Text, Set.Set<Text>>();
  let following = Map.empty<Text, Set.Set<Text>>();

  public shared func followUser(token : SessionToken, targetUsername : Text) : async () {
    let username = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };
    if (username == targetUsername) {
      Runtime.trap("Cannot follow yourself");
    };
    // Check if blocked
    if (areUsersBlocked(username, targetUsername)) {
      Runtime.trap("Cannot follow: blocked relationship exists");
    };
    // Check if target user exists
    if (not localUsers.containsKey(targetUsername)) {
      Runtime.trap("Target user not found");
    };
    let myFollowing = switch (following.get(username)) {
      case (?f) { f };
      case (null) { Set.empty<Text>() };
    };
    if (myFollowing.contains(targetUsername)) {
      return; // Idempotent: already following, no-op
    };
    myFollowing.add(targetUsername);
    following.add(username, myFollowing);
    let theirFollowers = switch (followers.get(targetUsername)) {
      case (?f) { f };
      case (null) { Set.empty<Text>() };
    };
    theirFollowers.add(username);
    followers.add(targetUsername, theirFollowers);
  };

  public shared func unfollowUser(token : SessionToken, targetUsername : Text) : async () {
    let username = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };
    let myFollowing = switch (following.get(username)) {
      case (?f) { f };
      case (null) { Set.empty<Text>() };
    };
    if (not myFollowing.contains(targetUsername)) {
      return; // Idempotent: not following, no-op
    };
    myFollowing.remove(targetUsername);
    following.add(username, myFollowing);

    let theirFollowers = switch (followers.get(targetUsername)) {
      case (?f) { f };
      case (null) { Set.empty<Text>() };
    };
    theirFollowers.remove(username);
    followers.add(targetUsername, theirFollowers);
  };

  public query func getFollowers(token : SessionToken, username : Text) : async [Text] {
    let callerUsername = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };
    // Check if caller is blocked by the target user
    if (callerUsername != username and isUserBlocked(username, callerUsername)) {
      Runtime.trap("Unauthorized: You are blocked by this user");
    };
    // Check privacy settings
    let settings = switch (profileSettings.get(username)) {
      case (?s) { s };
      case (null) { { hideFollowers = false; hideFollowing = false } };
    };
    // Only allow viewing if: it's your own profile OR followers are not hidden
    if (callerUsername != username and settings.hideFollowers) {
      Runtime.trap("Unauthorized: This user's followers list is private");
    };
    switch (followers.get(username)) {
      case (?f) {
        // Filter out users who have blocked the caller
        f.toArray().filter(func(follower : Text) : Bool {
          not areUsersBlocked(callerUsername, follower)
        })
      };
      case (null) { [] };
    };
  };

  public query func getFollowing(token : SessionToken, username : Text) : async [Text] {
    let callerUsername = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };
    // Check if caller is blocked by the target user
    if (callerUsername != username and isUserBlocked(username, callerUsername)) {
      Runtime.trap("Unauthorized: You are blocked by this user");
    };
    // Check privacy settings
    let settings = switch (profileSettings.get(username)) {
      case (?s) { s };
      case (null) { { hideFollowers = false; hideFollowing = false } };
    };
    // Only allow viewing if: it's your own profile OR following list is not hidden
    if (callerUsername != username and settings.hideFollowing) {
      Runtime.trap("Unauthorized: This user's following list is private");
    };
    switch (following.get(username)) {
      case (?f) {
        // Filter out users who have blocked the caller
        f.toArray().filter(func(followed : Text) : Bool {
          not areUsersBlocked(callerUsername, followed)
        })
      };
      case (null) { [] };
    };
  };

  public query func isFollowing(token : SessionToken, targetUsername : Text) : async Bool {
    let username = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };
    switch (following.get(username)) {
      case (?f) { f.contains(targetUsername) };
      case (null) { false };
    };
  };

  // 3. Block feature
  let blockList = Map.empty<Text, Set.Set<Text>>();

  public shared func blockUser(token : SessionToken, targetUsername : Text) : async () {
    let username = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };
    if (username == targetUsername) {
      Runtime.trap("Cannot block yourself");
    };
    // Check if target user exists
    if (not localUsers.containsKey(targetUsername)) {
      Runtime.trap("Target user not found");
    };
    let myBlocks = switch (blockList.get(username)) {
      case (?b) { b };
      case (null) { Set.empty<Text>() };
    };
    if (myBlocks.contains(targetUsername)) {
      Runtime.trap("Already blocked");
    };
    myBlocks.add(targetUsername);
    blockList.add(username, myBlocks);
    // Remove follow relationships
    switch (followers.get(username)) {
      case (?f) {
        if (f.contains(targetUsername)) {
          f.remove(targetUsername);
          followers.add(username, f);
        };
      };
      case (null) {};
    };
    switch (following.get(targetUsername)) {
      case (?f) {
        if (f.contains(username)) {
          f.remove(username);
          following.add(targetUsername, f);
        };
      };
      case (null) {};
    };
    switch (following.get(username)) {
      case (?f) {
        if (f.contains(targetUsername)) {
          f.remove(targetUsername);
          following.add(username, f);
        };
      };
      case (null) {};
    };
    switch (followers.get(targetUsername)) {
      case (?f) {
        if (f.contains(username)) {
          f.remove(username);
          followers.add(targetUsername, f);
        };
      };
      case (null) {};
    };
  };

  public shared func unblockUser(token : SessionToken, targetUsername : Text) : async () {
    let username = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };
    let myBlocks = switch (blockList.get(username)) {
      case (?b) { b };
      case (null) { Set.empty<Text>() };
    };
    if (not myBlocks.contains(targetUsername)) {
      Runtime.trap("Not blocked");
    };
    myBlocks.remove(targetUsername);
    blockList.add(username, myBlocks);
  };

  public query func getBlockedUsers(token : SessionToken) : async [Text] {
    let username = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };
    switch (blockList.get(username)) {
      case (?b) { b.toArray() };
      case (null) { [] };
    };
  };

  public query func isBlocked(token : SessionToken, targetUsername : Text) : async Bool {
    let username = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };
    switch (blockList.get(username)) {
      case (?b) { b.contains(targetUsername) };
      case (null) { false };
    };
  };

  public query func isBlockedBy(token : SessionToken, targetUsername : Text) : async Bool {
    let username = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };
    switch (blockList.get(targetUsername)) {
      case (?b) { b.contains(username) };
      case (null) { false };
    };
  };

  // 4. Profile settings
  let profileSettings = Map.empty<Text, ProfileSettings>();

  public query func getProfileSettings(token : SessionToken) : async ProfileSettings {
    let username = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };
    switch (profileSettings.get(username)) {
      case (?s) { s };
      case (null) { { hideFollowers = false; hideFollowing = false } };
    };
  };

  public shared func updateProfileSettings(token : SessionToken, hideFollowers : Bool, hideFollowing : Bool) : async () {
    let username = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };
    let settings : ProfileSettings = { hideFollowers; hideFollowing };
    profileSettings.add(username, settings);
  };

  public query func getPublicProfileSettings(username : Text) : async ProfileSettings {
    switch (profileSettings.get(username)) {
      case (?s) { s };
      case (null) { { hideFollowers = false; hideFollowing = false } };
    };
  };

  // ---- Call Topics (New) ----

  let callTopics = Map.empty<Text, Text>();

  public shared func setCallTopic(token : SessionToken, topic : Text) : async () {
    let username = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };

    if (topic.size() > 100) {
      Runtime.trap("Topic must be 100 chars or less");
    };

    callTopics.add(username, topic);
  };

  public query func getCallTopic(username : Text) : async ?Text {
    callTopics.get(username);
  };

  public shared func clearCallTopic(token : SessionToken) : async () {
    let username = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };
    callTopics.remove(username);
  };

  // ---- Notifications ----

  public query func getNotificationsAsLocal(token : SessionToken) : async [Notification] {
    let username = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };
    let mine = notifications.values().toArray().filter(
      func(n : Notification) : Bool { n.recipientUsername == username }
    );
    mine;
  };

  public shared func markNotificationReadAsLocal(token : SessionToken, id : Nat) : async () {
    let username = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };
    switch (notifications.get(id)) {
      case (?n) {
        if (n.recipientUsername != username) {
          Runtime.trap("Unauthorized: Can only mark your own notifications as read");
        };
        notifications.add(id, { n with isRead = true });
      };
      case (null) {};
    };
  };

  public shared func markAllNotificationsReadAsLocal(token : SessionToken) : async () {
    let username = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };
    let mine = notifications.entries().toArray().filter(
      func((id, n) : (Nat, Notification)) : Bool { n.recipientUsername == username and not n.isRead }
    );
    for ((id, n) in mine.values()) {
      notifications.add(id, { n with isRead = true });
    };
  };

  // ---- Direct Messages ----

  public shared func sendDirectMessage(token : SessionToken, recipientUsername : Text, text : Text) : async Nat {
    let senderUsername = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };
    if (not localUsers.containsKey(recipientUsername)) {
      Runtime.trap("Recipient user not found");
    };
    // Check if blocked
    if (areUsersBlocked(senderUsername, recipientUsername)) {
      Runtime.trap("Cannot send message: blocked relationship exists");
    };
    let id = nextDmId;
    nextDmId += 1;
    let dm : DirectMessage = {
      id;
      senderUsername;
      recipientUsername;
      text;
      timestamp = Time.now();
      isRead = false;
    };
    directMessages.add(id, dm);
    // Update conversationIndex for both users (idempotent Set.add)
    let senderConvs = switch (conversationIndex.get(senderUsername)) {
      case (?s) { s };
      case (null) { let s = Set.empty<Text>(); conversationIndex.add(senderUsername, s); s };
    };
    senderConvs.add(recipientUsername);
    let recipientConvs = switch (conversationIndex.get(recipientUsername)) {
      case (?s) { s };
      case (null) { let s = Set.empty<Text>(); conversationIndex.add(recipientUsername, s); s };
    };
    recipientConvs.add(senderUsername);
    id;
  };

  public query func getDirectMessages(token : SessionToken, otherUsername : Text) : async [DirectMessage] {
    let username = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };
    // Check if blocked
    if (areUsersBlocked(username, otherUsername)) {
      return [];
    };
    directMessages.values().toArray().filter(
      func(dm : DirectMessage) : Bool {
        (dm.senderUsername == username and dm.recipientUsername == otherUsername) or
        (dm.senderUsername == otherUsername and dm.recipientUsername == username)
      }
    );
  };

  public query func getConversations(token : SessionToken) : async [ConversationSummary] {
    let username = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };
    // Use conversationIndex for O(1) partner lookup instead of O(n) full scan
    let partners : [Text] = switch (conversationIndex.get(username)) {
      case (?s) { s.toArray() };
      case (null) { [] };
    };
    let result = Map.empty<Text, (Text, Time.Time, Nat, Text, Bool)>();
    // Only scan messages for known conversation partners
    for (dm in directMessages.values().toArray().values()) {
      let other = if (dm.senderUsername == username) { dm.recipientUsername } else if (dm.recipientUsername == username) { dm.senderUsername } else { "" };
      if (other == "") { /* skip unrelated */ } else if (areUsersBlocked(username, other)) { /* skip blocked */ } else {
        let unreadIncrement = if (dm.recipientUsername == username and not dm.isRead) { 1 } else { 0 };
        switch (result.get(other)) {
          case (null) {
            result.add(other, (dm.text, dm.timestamp, unreadIncrement, dm.senderUsername, dm.isRead));
          };
          case (?(lastMsg, lastTs, unread, lastSender, lastRead)) {
            let isNewer = dm.timestamp > lastTs;
            let newTs = if (isNewer) { dm.timestamp } else { lastTs };
            let newMsg = if (isNewer) { dm.text } else { lastMsg };
            let newSender = if (isNewer) { dm.senderUsername } else { lastSender };
            let newRead = if (isNewer) { dm.isRead } else { lastRead };
            result.add(other, (newMsg, newTs, unread + unreadIncrement, newSender, newRead));
          };
        };
      };
    };
    result.entries().toArray().map(
      func((other, (lastMsg, lastTs, unread, lastSender, lastRead)) : (Text, (Text, Time.Time, Nat, Text, Bool))) : ConversationSummary {
        let displayName = switch (localUsers.get(other)) {
          case (?u) { u.displayName };
          case (null) { other };
        };
        { otherUsername = other; otherDisplayName = displayName; lastMessage = lastMsg; lastTimestamp = lastTs; unreadCount = unread; lastMessageSender = lastSender; lastMessageIsRead = lastRead };
      }
    );
  };

  public shared func markDirectMessagesRead(token : SessionToken, otherUsername : Text) : async () {
    let username = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };
    let toMark = directMessages.entries().toArray().filter(
      func((id, dm) : (Nat, DirectMessage)) : Bool {
        dm.senderUsername == otherUsername and dm.recipientUsername == username and not dm.isRead
      }
    );
    for ((id, dm) in toMark.values()) {
      directMessages.add(id, { dm with isRead = true });
    };
  };

  public query func getUnreadDMCount(token : SessionToken) : async Nat {
    let username = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };
    directMessages.values().toArray().filter(
      func(dm : DirectMessage) : Bool {
        dm.recipientUsername == username and not dm.isRead and not areUsersBlocked(username, dm.senderUsername)
      }
    ).size();
  };

  // ---- Voice Channel ----

  public shared func joinVoiceChannel(token : SessionToken) : async [VoiceParticipant] {
    let username = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };
    let localUser = switch (localUsers.get(username)) {
      case (?u) { u };
      case (null) { Runtime.trap("Local user not found") };
    };
    let participant : VoiceParticipant = {
      username;
      displayName = localUser.displayName;
      isMicActive = false;
    };
    voiceParticipants.add(username, participant);
    // Return participants, filtering out blocked users
    voiceParticipants.values().toArray().filter(
      func(p : VoiceParticipant) : Bool {
        not areUsersBlocked(username, p.username)
      }
    );
  };

  public shared func leaveVoiceChannel(token : SessionToken) : async () {
    let username = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };
    voiceParticipants.remove(username);
    let toRemove = voiceSignals.entries().toArray().filter(
      func((id, s)) { s.fromUsername == username or s.toUsername == username }
    );
    for ((id, _) in toRemove.values()) {
      voiceSignals.remove(id);
    };
  };

  public query func getVoiceParticipants(token : SessionToken) : async [VoiceParticipant] {
    let username = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };
    // Filter out blocked users
    voiceParticipants.values().toArray().filter(
      func(p : VoiceParticipant) : Bool {
        not areUsersBlocked(username, p.username)
      }
    );
  };

  public shared func sendSignal(token : SessionToken, toUsername : Text, signalType : Text, data : Text) : async () {
    let fromUsername = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };
    // Check if blocked
    if (areUsersBlocked(fromUsername, toUsername)) {
      Runtime.trap("Cannot send signal: blocked relationship exists");
    };
    let id = nextSignalId;
    nextSignalId += 1;
    let signal : Signal = {
      id;
      fromUsername;
      toUsername;
      signalType;
      data;
      timestamp = Time.now();
    };
    voiceSignals.add(id, signal);
  };

  public shared func getMySignals(token : SessionToken) : async [Signal] {
    let username = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { return [] };
    };
    let expiryNs : Int = 90_000_000_000;
    let now = Time.now();
    for ((id, s) in voiceSignals.entries().toArray().values()) {
      if (now - s.timestamp > expiryNs) {
        voiceSignals.remove(id);
      };
    };
    let mine = voiceSignals.entries().toArray().filter(
      func((id, s)) {
        s.toUsername == username and not areUsersBlocked(username, s.fromUsername)
      }
    ).map(func((id, s)) { s });
    for ((id, _) in voiceSignals.entries().toArray().filter(
      func((id, s)) { s.toUsername == username }
    ).values()) {
      voiceSignals.remove(id);
    };
    mine;
  };

  public shared func setMicActive(token : SessionToken, active : Bool) : async () {
    let username = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };
    switch (voiceParticipants.get(username)) {
      case (?p) {
        voiceParticipants.add(username, { p with isMicActive = active });
      };
      case (null) {};
    };
  };

  // ---- Feed / Posts ----

  public shared ({ caller }) func createPost(text : Text) : async Nat {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can post");
    };
    let authorName = switch (users.get(caller)) {
      case (?user) { user.fname };
      case (null) { "Unknown" };
    };
    let id = nextId;
    nextId += 1;
    let post : Post = { id; author = caller; authorName; text; timestamp = Time.now() };
    posts.add(id, post);
    id;
  };

  public shared func createPostAsLocal(token : SessionToken, text : Text) : async Nat {
    let username = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };
    let localUser = switch (localUsers.get(username)) {
      case (?u) { u };
      case (null) { Runtime.trap("Local user not found") };
    };
    let id = nextId;
    nextId += 1;
    let post : Post = {
      id;
      author = getLocalUserPrincipal(username);
      authorName = localUser.displayName;
      text;
      timestamp = Time.now();
    };
    posts.add(id, post);
    id;
  };

  public query ({ caller }) func getPosts() : async [Post] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view posts");
    };
    posts.values().toArray();
  };

  public query func getPostsAsLocal(token : SessionToken) : async [Post] {
    let username = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };
    // Filter out posts from blocked users
    posts.values().toArray().filter(
      func(post : Post) : Bool {
        // Find the username of the post author
        let authorUsername = localUsers.entries().toArray().filter(
          func((u, lu) : (Text, LocalUser)) : Bool { lu.displayName == post.authorName }
        );
        switch (authorUsername.size()) {
          case (0) { true }; // Keep posts from non-local users
          case (_) {
            let (postAuthor, _) = authorUsername[0];
            not areUsersBlocked(username, postAuthor)
          };
        };
      }
    );
  };

  public shared ({ caller }) func deletePost(id : Nat) : async () {
    switch (posts.get(id)) {
      case (?post) {
        if (post.author != caller and not AccessControl.isAdmin(accessControlState, caller)) {
          Runtime.trap("Unauthorized: Only the author or admin can delete this post");
        };
      };
      case (null) { Runtime.trap("Post not found") };
    };
    posts.remove(id);
    likes.remove(id);
    let commentsToRemove = comments.keys().toArray().filter(
      func(cid) {
        switch (comments.get(cid)) {
          case (?c) { c.postId == id };
          case (null) { false };
        }
      }
    );
    for (cid in commentsToRemove.values()) {
      comments.remove(cid);
    };
  };

  public shared func deletePostAsLocal(token : SessionToken, id : Nat) : async () {
    let username = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };
    let localUser = switch (localUsers.get(username)) {
      case (?u) { u };
      case (null) { Runtime.trap("Local user not found") };
    };
    switch (posts.get(id)) {
      case (?post) {
        if (getLocalUserPrincipal(username) != post.author) {
          Runtime.trap("Unauthorized: Only the author can delete this post");
        };
      };
      case (null) { Runtime.trap("Post not found") };
    };
    posts.remove(id);
    likes.remove(id);
    let commentsToRemove = comments.keys().toArray().filter(
      func(cid) {
        switch (comments.get(cid)) {
          case (?c) { c.postId == id };
          case (null) { false };
        }
      }
    );
    for (cid in commentsToRemove.values()) {
      comments.remove(cid);
    };
  };

  // ---- Comments ----

  func quicksortComments(array : [Comment]) : [Comment] {
    switch (array.size()) {
      case (0) { [] };
      case (1) { array };
      case (_) {
        let pivot = array[array.size() / 2];
        let less = array.filter(func(c) { c.timestamp < pivot.timestamp });
        let greater = array.filter(func(c) { c.timestamp > pivot.timestamp });
        return quicksortComments(less).concat([pivot]).concat(quicksortComments(greater));
      };
    };
  };

  public shared ({ caller }) func addComment(postId : Nat, text : Text) : async Nat {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can comment");
    };
    let authorName = switch (users.get(caller)) {
      case (?user) { user.fname };
      case (null) { "Unknown" };
    };
    let id = nextId;
    nextId += 1;
    let comment : Comment = {
      id;
      postId;
      author = caller;
      authorName;
      text;
      timestamp = Time.now();
    };
    comments.add(id, comment);
    id;
  };

  public shared func addCommentAsLocal(token : SessionToken, postId : Nat, text : Text) : async Nat {
    let username = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };
    let localUser = switch (localUsers.get(username)) {
      case (?u) { u };
      case (null) { Runtime.trap("Local user not found") };
    };
    // Check if post exists and if blocked
    switch (posts.get(postId)) {
      case (?post) {
        let ownerEntry = localUsers.entries().toArray().filter(
          func((u, lu) : (Text, LocalUser)) : Bool { lu.displayName == post.authorName }
        );
        switch (ownerEntry.size()) {
          case (0) {}; // Non-local post author
          case (_) {
            let (ownerUsername, _) = ownerEntry[0];
            if (areUsersBlocked(username, ownerUsername)) {
              Runtime.trap("Cannot comment: blocked relationship exists");
            };
          };
        };
      };
      case (null) { Runtime.trap("Post not found") };
    };
    let id = nextId;
    nextId += 1;
    let comment : Comment = {
      id;
      postId;
      author = getLocalUserPrincipal(username);
      authorName = localUser.displayName;
      text;
      timestamp = Time.now();
    };
    comments.add(id, comment);
    switch (posts.get(postId)) {
      case (?post) {
        let ownerEntry = localUsers.entries().toArray().filter(
          func((u, lu) : (Text, LocalUser)) : Bool { lu.displayName == post.authorName }
        );
        switch (ownerEntry.size()) {
          case (0) {};
          case (_) {
            let (ownerUsername, _) = ownerEntry[0];
            if (ownerUsername != username) {
              createNotification(
                ownerUsername,
                #comment,
                localUser.displayName,
                ?postId,
                ?post.text,
                null,
              );
            };
          };
        };
      };
      case (null) {};
    };
    id;
  };

  public query ({ caller }) func getCommentsForPost(postId : Nat) : async [Comment] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view comments");
    };
    let filtered = comments.values().toArray().filter(func(c) { c.postId == postId });
    let sorted = quicksortComments(filtered);
    sorted;
  };

  public query func getCommentsForPostAsLocal(token : SessionToken, postId : Nat) : async [Comment] {
    let username = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };
    let filtered = comments.values().toArray().filter(
      func(c) {
        if (c.postId != postId) { return false };
        // Filter out comments from blocked users
        let commentAuthorEntry = localUsers.entries().toArray().filter(
          func((u, lu) : (Text, LocalUser)) : Bool { lu.displayName == c.authorName }
        );
        switch (commentAuthorEntry.size()) {
          case (0) { true }; // Keep comments from non-local users
          case (_) {
            let (commentAuthor, _) = commentAuthorEntry[0];
            not areUsersBlocked(username, commentAuthor)
          };
        };
      }
    );
    let sorted = quicksortComments(filtered);
    sorted;
  };

  public shared ({ caller }) func deleteComment(id : Nat) : async () {
    switch (comments.get(id)) {
      case (?comment) {
        if (comment.author != caller and not AccessControl.isAdmin(accessControlState, caller)) {
          Runtime.trap("Unauthorized: Only the author or admin can delete this comment");
        };
      };
      case (null) { Runtime.trap("Comment not found") };
    };
    comments.remove(id);
  };

  public shared func deleteCommentAsLocal(token : SessionToken, id : Nat) : async () {
    let username = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };
    let localUser = switch (localUsers.get(username)) {
      case (?u) { u };
      case (null) { Runtime.trap("Local user not found") };
    };
    switch (comments.get(id)) {
      case (?comment) {
        if (getLocalUserPrincipal(username) != comment.author) {
          Runtime.trap("Unauthorized: Only the author can delete this comment");
        };
      };
      case (null) { Runtime.trap("Comment not found") };
    };
    comments.remove(id);
  };

  // ---- Likes ----

  public shared ({ caller }) func likePost(postId : Nat) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can like posts");
    };
    let user = switch (users.get(caller)) {
      case (?user) { user };
      case (null) { Runtime.trap("User not found") };
    };
    let postLikes = switch (likes.get(postId)) {
      case (?pl) { pl };
      case (null) { Map.empty<Principal, Text>() };
    };
    if (postLikes.containsKey(caller)) { Runtime.trap("Already liked") };
    postLikes.add(caller, user.fname);
    likes.add(postId, postLikes);
  };

  public shared ({ caller }) func unlikePost(postId : Nat) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can unlike posts");
    };
    let postLikes = switch (likes.get(postId)) {
      case (?pl) { pl };
      case (null) { Runtime.trap("No likes found for this post") };
    };
    if (not postLikes.containsKey(caller)) {
      Runtime.trap("You haven't liked this post yet");
    };
    postLikes.remove(caller);
    likes.add(postId, postLikes);
  };

  public query ({ caller }) func getPostLikes(postId : Nat) : async [Text] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view likes");
    };
    switch (likes.get(postId)) {
      case (?postLikes) { postLikes.values().toArray() };
      case (null) { [] };
    };
  };

  public shared func likePostAsLocal(token : SessionToken, postId : Nat) : async () {
    let username = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };
    let localUser = switch (localUsers.get(username)) {
      case (?u) { u };
      case (null) { Runtime.trap("Local user not found") };
    };
    // Check if post exists and if blocked
    switch (posts.get(postId)) {
      case (?post) {
        let ownerEntry = localUsers.entries().toArray().filter(
          func((u, lu) : (Text, LocalUser)) : Bool { lu.displayName == post.authorName }
        );
        switch (ownerEntry.size()) {
          case (0) {}; // Non-local post author
          case (_) {
            let (ownerUsername, _) = ownerEntry[0];
            if (areUsersBlocked(username, ownerUsername)) {
              Runtime.trap("Cannot like: blocked relationship exists");
            };
          };
        };
      };
      case (null) { Runtime.trap("Post not found") };
    };
    let author = getLocalUserPrincipal(username);
    let postLikes = switch (likes.get(postId)) {
      case (?pl) { pl };
      case (null) { Map.empty<Principal, Text>() };
    };
    if (postLikes.containsKey(author)) { Runtime.trap("Already liked") };
    postLikes.add(author, localUser.displayName);
    likes.add(postId, postLikes);
    switch (posts.get(postId)) {
      case (?post) {
        let ownerEntry = localUsers.entries().toArray().filter(
          func((u, lu) : (Text, LocalUser)) : Bool { lu.displayName == post.authorName }
        );
        switch (ownerEntry.size()) {
          case (0) {};
          case (_) {
            let (ownerUsername, _) = ownerEntry[0];
            if (ownerUsername != username) {
              createNotification(
                ownerUsername,
                #like,
                localUser.displayName,
                ?postId,
                ?post.text,
                null,
              );
            };
          };
        };
      };
      case (null) {};
    };
  };

  public shared func unlikePostAsLocal(token : SessionToken, postId : Nat) : async () {
    let username = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };
    let author = getLocalUserPrincipal(username);
    let postLikes = switch (likes.get(postId)) {
      case (?pl) { pl };
      case (null) { Runtime.trap("No likes found for this post") };
    };
    if (not postLikes.containsKey(author)) {
      Runtime.trap("You haven't liked this post yet");
    };
    postLikes.remove(author);
    likes.add(postId, postLikes);
  };

  public query func getPostLikesAsLocal(token : SessionToken, postId : Nat) : async [Text] {
    let username = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };
    switch (likes.get(postId)) {
      case (?postLikes) {
        // Filter out likes from blocked users
        postLikes.entries().toArray().filter(
          func((principal, displayName) : (Principal, Text)) : Bool {
            let likerEntry = localUsers.entries().toArray().filter(
              func((u, lu) : (Text, LocalUser)) : Bool { lu.displayName == displayName }
            );
            switch (likerEntry.size()) {
              case (0) { true }; // Keep likes from non-local users
              case (_) {
                let (liker, _) = likerEntry[0];
                not areUsersBlocked(username, liker)
              };
            };
          }
        ).map(func((_, displayName) : (Principal, Text)) : Text { displayName })
      };
      case (null) { [] };
    };
  };

  // ---- Calls (Principal-based) ----

  public shared ({ caller }) func sendCallRequest(callee : Principal) : async Nat {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can perform this action");
    };
    let id = nextId;
    nextId += 1;
    let callRequest : CallRequest = { id; caller; callee; timestamp = Time.now() };
    callRequests.add(id, callRequest);
    id;
  };

  public shared ({ caller }) func acceptCallRequest(id : Nat) : async () {
    switch (callRequests.get(id)) {
      case (?cr) {
        if (cr.callee != caller) { Runtime.trap("Unauthorized: Only the callee can accept") };
        acceptedCallIds.add(id, true);
      };
      case (null) { Runtime.trap("Call request not found") };
    };
  };

  public shared ({ caller }) func denyCallRequest(id : Nat) : async () {
    switch (callRequests.get(id)) {
      case (?cr) {
        if (cr.callee != caller) { Runtime.trap("Unauthorized: Only the callee can deny") };
        callRequests.remove(id);
      };
      case (null) { Runtime.trap("Call request not found") };
    };
  };

  public shared ({ caller }) func endCall(id : Nat) : async () {
    switch (callRequests.get(id)) {
      case (?cr) {
        if (cr.caller != caller and cr.callee != caller) {
          Runtime.trap("Unauthorized: Only participants can end the call");
        };
        callRequests.remove(id);
        acceptedCallIds.remove(id);
      };
      case (null) { Runtime.trap("Call request not found") };
    };
  };

  public shared ({ caller }) func deleteCallRequest(id : Nat) : async () {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      switch (callRequests.get(id)) {
        case (?callRequest) {
          if (not (callRequest.caller == caller or callRequest.callee == caller)) {
            Runtime.trap("Unauthorized: Only participants in the call request can delete it");
          };
        };
        case (null) { Runtime.trap("Call request not found") };
      };
    };
    callRequests.remove(id);
  };

  public query ({ caller }) func getCallRequest(id : Nat) : async ?CallRequestWithStatus {
    switch (callRequests.get(id)) {
      case (?callRequest) {
        let isParticipant = callRequest.caller == caller or callRequest.callee == caller;
        let isAdmin = AccessControl.isAdmin(accessControlState, caller);
        if (not (isParticipant or isAdmin)) {
          Runtime.trap("Unauthorized: Only participants or admins can view this call request");
        };
        let status : CallStatus = if (acceptedCallIds.containsKey(callRequest.id)) { #accepted } else { #pending };
        ?{ callRequest with status };
      };
      case (null) { null };
    };
  };

  public query ({ caller }) func getCallRequests() : async [CallRequestWithStatus] {
    func addStatus(cr : CallRequest) : CallRequestWithStatus {
      let status : CallStatus = if (acceptedCallIds.containsKey(cr.id)) { #accepted } else { #pending };
      { cr with status };
    };
    if (AccessControl.isAdmin(accessControlState, caller)) {
      callRequests.values().toArray().map(addStatus);
    } else {
      if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
        Runtime.trap("Unauthorized: Only users can view call requests");
      };
      callRequests.values().toArray().filter<CallRequest>(
        func(cr : CallRequest) : Bool { cr.caller == caller or cr.callee == caller }
      ).map(addStatus);
    };
  };

  // ---- Calls (Local/token-based) ----

  public shared func sendCallRequestAsLocal(token : SessionToken, calleeUsername : Text) : async Nat {
    let callerUsername = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };
    if (not localUsers.containsKey(calleeUsername)) {
      Runtime.trap("Callee user not found");
    };
    // Check if blocked
    if (areUsersBlocked(callerUsername, calleeUsername)) {
      Runtime.trap("Cannot send call request: blocked relationship exists");
    };
    let id = nextId;
    nextId += 1;
    let req : LocalCallRequest = {
      id;
      callerUsername;
      calleeUsername;
      status = #pending;
      timestamp = Time.now();
    };
    localCallRequests.add(id, req);
    let callerUser = switch (localUsers.get(callerUsername)) {
      case (?u) { u };
      case (null) { Runtime.trap("Caller user not found") };
    };
    createNotification(
      calleeUsername,
      #callRequest,
      callerUser.displayName,
      null,
      null,
      ?id,
    );
    id;
  };

  public query func getCallRequestsAsLocal(token : SessionToken) : async [LocalCallRequest] {
    let username = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };
    localCallRequests.values().toArray().filter(
      func(cr : LocalCallRequest) : Bool {
        (cr.callerUsername == username or cr.calleeUsername == username) and
        not areUsersBlocked(username, if (cr.callerUsername == username) { cr.calleeUsername } else { cr.callerUsername })
      }
    );
  };

  public shared func acceptCallRequestAsLocal(token : SessionToken, id : Nat) : async () {
    let username = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };
    switch (localCallRequests.get(id)) {
      case (?cr) {
        if (cr.calleeUsername != username) { Runtime.trap("Unauthorized: Only the callee can accept") };
        // Check if blocked
        if (areUsersBlocked(cr.callerUsername, cr.calleeUsername)) {
          Runtime.trap("Cannot accept: blocked relationship exists");
        };
        localCallRequests.add(id, { cr with status = #accepted });
      };
      case (null) { Runtime.trap("Call request not found") };
    };
  };

  public shared func denyCallRequestAsLocal(token : SessionToken, id : Nat) : async () {
    let username = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };
    switch (localCallRequests.get(id)) {
      case (?cr) {
        if (cr.calleeUsername != username) { Runtime.trap("Unauthorized: Only the callee can deny") };
        localCallRequests.remove(id);
      };
      case (null) { Runtime.trap("Call request not found") };
    };
  };

  public shared func endCallAsLocal(token : SessionToken, id : Nat) : async () {
    let username = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };
    switch (localCallRequests.get(id)) {
      case (?cr) {
        if (cr.callerUsername != username and cr.calleeUsername != username) {
          Runtime.trap("Unauthorized: Only participants can end the call");
        };
        localCallRequests.remove(id);
      };
      case (null) { Runtime.trap("Call request not found") };
    };
  };

  // ---- Messages (Lobby) ----

  public shared ({ caller }) func sendMessage(text : Text) : async Nat {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can perform this action");
    };
    let authorName = switch (users.get(caller)) {
      case (?user) { user.name };
      case (null) { "Unknown" };
    };
    let id = nextId;
    nextId += 1;
    let message : Message = { id; author = caller; authorName; text; timestamp = Time.now() };
    messages.add(id, message);
    id;
  };

  public shared func sendMessageAsLocal(token : SessionToken, text : Text) : async Nat {
    let username = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };
    let localUser = switch (localUsers.get(username)) {
      case (?u) { u };
      case (null) { Runtime.trap("Local user not found") };
    };
    let id = nextId;
    nextId += 1;
    let message : Message = {
      id;
      author = getLocalUserPrincipal(username);
      authorName = localUser.displayName;
      text;
      timestamp = Time.now();
    };
    messages.add(id, message);
    id;
  };

  public shared func registerLocalAccount(
    username : Text,
    passwordHash : Text,
    displayName : Text,
    age : Nat,
    photo : ?Storage.ExternalBlob,
  ) : async () {
    let normalizedUsername = username.toLower();
    if (localUsers.containsKey(normalizedUsername)) {
      Runtime.trap("Username already exists");
    };
    let localUser : LocalUser = { username = normalizedUsername; passwordHash; displayName; age; photo; lastNameChange = null };
    localUsers.add(normalizedUsername, localUser);
  };

  public shared func loginLocalAccount(username : Text, passwordHash : Text) : async { token : SessionToken; isAdmin : Bool } {
    let normalizedUsername = username.toLower();
    let localUser = switch (localUsers.get(normalizedUsername)) {
      case (?u) { u };
      case (null) { Runtime.trap("Invalid username or password") };
    };
    if (localUser.passwordHash != passwordHash) {
      Runtime.trap("Invalid username or password");
    };
    if (bannedUsers.contains(normalizedUsername)) {
      // Check if ban has expired
      let stillBanned = switch (banExpiry.get(normalizedUsername)) {
        case (?expiry) { Time.now() < expiry };
        case (null) { true };
      };
      if (stillBanned) {
        Runtime.trap("Your account has been banned by an admin");
      } else {
        bannedUsers.remove(normalizedUsername);
        banExpiry.remove(normalizedUsername);
      };
    };
    let token = nextTokenId;
    nextTokenId += 1;
    sessions.add(token, normalizedUsername);
    let isAdmin = normalizedUsername == "wildfire";
    { token; isAdmin };
  };

  public query func validateSessionToken(token : SessionToken) : async ?Text {
    validateToken(token);
  };

  public shared func logoutLocalAccount(token : SessionToken) : async () {
    sessions.remove(token);
  };

  public query func getLocalUserProfile(token : SessionToken) : async ?LocalUser {
    let username = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { return null };
    };
    localUsers.get(username);
  };

  public shared func updateLocalUserPhoto(token : SessionToken, photo : Storage.ExternalBlob) : async () {
    let username = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };
    let existingUser = switch (localUsers.get(username)) {
      case (?u) { u };
      case (null) { Runtime.trap("Local user not found") };
    };
    let updatedUser : LocalUser = { existingUser with photo = ?photo };
    localUsers.add(username, updatedUser);
  };

  public shared func updateLocalUserBio(token : SessionToken, bio : Text) : async () {
    let username = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };
    userBios.add(username, bio);
  };

  public query func getUserBio(username : Text) : async ?Text {
    userBios.get(username);
  };

  public query ({ caller }) func getLocalUsers() : async [LocalUser] {
    localUsers.values().toArray();
  };

  // Presence: ping to mark user as online
  public shared func pingOnline(token : SessionToken) : async () {
    switch (validateToken(token)) {
      case (?username) { lastSeen.add(username, Time.now()) };
      case (null) {};
    };
  };

  // Presence: get usernames active in last 60 seconds
  public query func getOnlineUsernames() : async [Text] {
    let threshold = Time.now() - 60_000_000_000; // 60 seconds in nanoseconds
    lastSeen.entries()
      .filter(func((_, t) : (Text, Time.Time)) : Bool { t > threshold })
      .map(func((u, _) : (Text, Time.Time)) : Text { u })
      .toArray();
  };

  public shared ({ caller }) func createUser(name : Text, fname : Text, telephone : Text) : async () {
    if (caller.isAnonymous()) {
      Runtime.trap("Unauthorized: Anonymous principals cannot create users");
    };
    let user : User = { principal = caller; name; fname; telephone; role = #user; photo = null };
    if (users.containsKey(caller)) {
      Runtime.trap("User with principal " # caller.toText() # " already exists.");
    };
    users.add(caller, user);
  };

  public shared ({ caller }) func deleteUser(targetUser : Principal) : async () {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Only admins can perform this action");
    };
    users.remove(targetUser);
    let messagesToRemove = Map.empty<Nat, ()>();
    for ((id, message) in messages.entries()) {
      if (message.author == targetUser) { messagesToRemove.add(id, ()) };
    };
    for ((id, _) in messagesToRemove.entries()) { messages.remove(id) };
    let callRequestsToRemove = Map.empty<Nat, ()>();
    for ((id, callRequest) in callRequests.entries()) {
      if (callRequest.caller == targetUser or callRequest.callee == targetUser) {
        callRequestsToRemove.add(id, ());
      };
    };
    for ((id, _) in callRequestsToRemove.entries()) { callRequests.remove(id) };
  };

  public shared ({ caller }) func updateUser(photo : Storage.ExternalBlob) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can perform this action");
    };
    let existingUser = switch (users.get(caller)) {
      case (null) { Runtime.trap("User does not exist") };
      case (?user) { user };
    };
    let updatedUser : User = { existingUser with photo = ?photo };
    users.add(caller, updatedUser);
  };

  public shared ({ caller }) func updateUserWithoutPhoto(name : Text, fname : Text, telephone : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can perform this action");
    };
    let existingUser = switch (users.get(caller)) {
      case (null) { Runtime.trap("User does not exist") };
      case (?user) { user };
    };
    let updatedUser : User = { existingUser with name; fname; telephone };
    users.add(caller, updatedUser);
  };

  public shared ({ caller }) func assignRole(user : Principal, role : AccessControl.UserRole) : async () {
    let existingUser = switch (users.get(user)) {
      case (null) { Runtime.trap("User does not exist") };
      case (?u) { u };
    };
    AccessControl.assignRole(accessControlState, caller, user, role);
    users.add(user, { existingUser with role });
  };

  public query ({ caller }) func getMessage(id : Nat) : async ?Message {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view messages");
    };
    messages.get(id);
  };

  public query ({ caller }) func getMessages() : async [Message] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view messages");
    };
    messages.values().toArray();
  };

  public query func getMessagesAsLocal(token : SessionToken) : async [Message] {
    let username = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };
    // Filter out messages from blocked users
    messages.values().toArray().filter(
      func(msg : Message) : Bool {
        let authorEntry = localUsers.entries().toArray().filter(
          func((u, lu) : (Text, LocalUser)) : Bool { lu.displayName == msg.authorName }
        );
        switch (authorEntry.size()) {
          case (0) { true }; // Keep messages from non-local users
          case (_) {
            let (msgAuthor, _) = authorEntry[0];
            not areUsersBlocked(username, msgAuthor)
          };
        };
      }
    );
  };

  public query ({ caller }) func getUser(principal : Principal) : async ?User {
    if (caller != principal and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile unless you are an admin");
    };
    users.get(principal);
  };

  public query ({ caller }) func getUsers() : async [User] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view user list");
    };
    users.values().toArray();
  };

  public query ({ caller }) func getUsersCount() : async Nat {
    users.size();
  };

  // ---- Admin Features (WILDFIRE only) ----

  func isWildfireToken(token : SessionToken) : Bool {
    switch (validateToken(token)) {
      case (?username) { username.toLower() == "wildfire" };
      case (null) { false };
    };
  };

  public query func checkIsWildfireAdmin(token : SessionToken) : async Bool {
    isWildfireToken(token);
  };

  public query func isUserVerified(username : Text) : async Bool {
    verifiedUsers.contains(username);
  };

  public query func isUserBanned(username : Text) : async Bool {
    if (not bannedUsers.contains(username)) { return false };
    // Check if ban has expired
    switch (banExpiry.get(username)) {
      case (?expiry) {
        if (Time.now() >= expiry) {
          false // Expired - frontend should call unban
        } else { true }
      };
      case (null) { true }; // Indefinite ban
    };
  };

  public query func getBanExpiry(username : Text) : async ?Time.Time {
    banExpiry.get(username);
  };

  public shared func grantVerifiedBadge(token : SessionToken, targetUsername : Text) : async () {
    if (not isWildfireToken(token)) {
      Runtime.trap("Unauthorized: Only the admin can grant verified badges");
    };
    if (not localUsers.containsKey(targetUsername)) {
      Runtime.trap("User not found");
    };
    verifiedUsers.add(targetUsername);
  };

  public shared func revokeVerifiedBadge(token : SessionToken, targetUsername : Text) : async () {
    if (not isWildfireToken(token)) {
      Runtime.trap("Unauthorized: Only the admin can revoke verified badges");
    };
    verifiedUsers.remove(targetUsername);
  };

  public shared func banLocalUser(token : SessionToken, targetUsername : Text) : async () {
    if (not isWildfireToken(token)) {
      Runtime.trap("Unauthorized: Only the admin can ban users");
    };
    let normalizedTarget = targetUsername.toLower();
    if (normalizedTarget == "wildfire") {
      Runtime.trap("Cannot ban the admin account");
    };
    if (not localUsers.containsKey(normalizedTarget)) {
      Runtime.trap("User not found");
    };
    bannedUsers.add(normalizedTarget);
    // Invalidate all sessions for this user
    for ((t, u) in sessions.entries().toArray().values()) {
      if (u == targetUsername) { sessions.remove(t) };
    };
  };

  // Ban with duration in nanoseconds (0 = indefinite)
  public shared func banLocalUserWithDuration(token : SessionToken, targetUsername : Text, durationNs : Nat) : async () {
    if (not isWildfireToken(token)) {
      Runtime.trap("Unauthorized: Only the admin can ban users");
    };
    let normalizedTarget = targetUsername.toLower();
    if (normalizedTarget == "wildfire") {
      Runtime.trap("Cannot ban the admin account");
    };
    if (not localUsers.containsKey(normalizedTarget)) {
      Runtime.trap("User not found");
    };
    bannedUsers.add(normalizedTarget);
    if (durationNs > 0) {
      banExpiry.add(normalizedTarget, Time.now() + durationNs);
    } else {
      banExpiry.remove(normalizedTarget);
    };
    // Invalidate all sessions for this user
    for ((t, u) in sessions.entries().toArray().values()) {
      if (u == normalizedTarget) { sessions.remove(t) };
    };
  };

  public shared func unbanLocalUser(token : SessionToken, targetUsername : Text) : async () {
    if (not isWildfireToken(token)) {
      Runtime.trap("Unauthorized: Only the admin can unban users");
    };
    bannedUsers.remove(targetUsername);
    banExpiry.remove(targetUsername);
  };

  public type AdminUserInfo = {
    username : Text;
    displayName : Text;
    isVerified : Bool;
    isBanned : Bool;
    banExpiresAt : ?Time.Time;
  };

  public query func getAllUsersForAdmin(token : SessionToken) : async [AdminUserInfo] {
    if (not isWildfireToken(token)) {
      Runtime.trap("Unauthorized: Only the admin can view all user data");
    };
    let unsorted = localUsers.entries().toArray().map(
      func((username, user) : (Text, LocalUser)) : AdminUserInfo {
        {
          username;
          displayName = user.displayName;
          isVerified = verifiedUsers.contains(username);
          isBanned = bannedUsers.contains(username);
          banExpiresAt = banExpiry.get(username);
        };
      }
    );
    unsorted.sort(func(a : AdminUserInfo, b : AdminUserInfo) : { #less; #equal; #greater } {
      a.username.compare(b.username)
    });
  };

  public func verifyUser() : async () { Runtime.trap("Deprecated: use grantVerifiedBadge") };

  public type UserProfile = {
    name : Text;
    fname : Text;
    telephone : Text;
    photo : ?Storage.ExternalBlob;
  };

  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access profiles");
    };
    switch (users.get(caller)) {
      case (?user) {
        ?{ name = user.name; fname = user.fname; telephone = user.telephone; photo = user.photo };
      };
      case (null) { null };
    };
  };

  public query ({ caller }) func getUserProfile(user: Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    switch (users.get(user)) {
      case (?u) {
        ?{ name = u.name; fname = u.fname; telephone = u.telephone; photo = u.photo };
      };
      case (null) { null };
    };
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    let existingUser = switch (users.get(caller)) {
      case (null) { Runtime.trap("User does not exist. Please create user first.") };
      case (?user) { user };
    };
    let updatedUser : User = {
      existingUser with
      name = profile.name;
      fname = profile.fname;
      telephone = profile.telephone;
      photo = profile.photo;
    };
    users.add(caller, updatedUser);
  };

  // ---- Profile With Social (follower + following counts in one call) ----

  public query func getProfileWithSocial(token : SessionToken, targetUsername : Text) : async {
    profile : ?LocalUser;
    followerCount : Nat;
    followingCount : Nat;
    isFollowing : Bool;
    isVerified : Bool;
  } {
    let callerUsername = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };
    let profile = localUsers.get(targetUsername);
    let followerCount = switch (followers.get(targetUsername)) {
      case (?f) { f.size() };
      case (null) { 0 };
    };
    let followingCount = switch (following.get(targetUsername)) {
      case (?f) { f.size() };
      case (null) { 0 };
    };
    let isFollowingTarget = switch (following.get(callerUsername)) {
      case (?f) { f.contains(targetUsername) };
      case (null) { false };
    };
    { profile; followerCount; followingCount; isFollowing = isFollowingTarget; isVerified = verifiedUsers.contains(targetUsername) };
  };

  // ---- Profile Visit Counter ----

  public shared func recordProfileVisit(token : SessionToken, visitedUsername : Text) : async () {
    let visitorUsername = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { return };
    };
    if (visitorUsername == visitedUsername) { return };
    if (areUsersBlocked(visitorUsername, visitedUsername)) { return };
    let visitors = switch (profileVisitors.get(visitedUsername)) {
      case (?v) { v };
      case (null) { Set.empty<Text>() };
    };
    visitors.add(visitorUsername);
    profileVisitors.add(visitedUsername, visitors);
  };

  public query func getProfileVisitors(token : SessionToken, username : Text) : async { count : Nat; visitors : [Text] } {
    let callerUsername = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { return { count = 0; visitors = [] } };
    };
    // Only owner can see full list; others just see count
    switch (profileVisitors.get(username)) {
      case (?v) {
        let arr = v.toArray();
        if (callerUsername == username) {
          { count = arr.size(); visitors = arr }
        } else {
          { count = arr.size(); visitors = [] }
        }
      };
      case (null) { { count = 0; visitors = [] } };
    };
  };

  // ---- Custom Status ----

  public shared func setUserStatus(token : SessionToken, status : Text) : async () {
    let username = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };
    userStatuses.add(username, status);
  };

  public query func getUserStatus(username : Text) : async ?Text {
    userStatuses.get(username);
  };

  // ===== STABLE MEMORY (persists across upgrades) =====

  stable var stableLocalUsers : [(Text, LocalUser)] = [];
  stable var stableSessions : [(Nat, Text)] = [];
  stable var stableMessages : [(Nat, Message)] = [];
  stable var stablePosts : [(Nat, Post)] = [];
  stable var stableDirectMessages : [(Nat, DirectMessage)] = [];
  stable var stableComments : [(Nat, Comment)] = [];
  stable var stableNotifications : [(Nat, Notification)] = [];
  stable var stableLocalCallRequests : [(Nat, LocalCallRequest)] = [];
  stable var stableVerifiedUsers : [Text] = [];
  stable var stableBannedUsers : [Text] = [];
  stable var stableBanExpiry : [(Text, Time.Time)] = [];
  stable var stableFollowers : [(Text, [Text])] = [];
  stable var stableFollowing : [(Text, [Text])] = [];
  stable var stableConversationIndex : [(Text, [Text])] = [];
  stable var stableBlockList : [(Text, [Text])] = [];
  stable var stableProfileSettings : [(Text, ProfileSettings)] = [];
  stable var stableCallTopics : [(Text, Text)] = [];
  stable var stableUserBios : [(Text, Text)] = [];
  stable var stableUserStatuses : [(Text, Text)] = [];
  stable var stableProfileVisitors : [(Text, [Text])] = [];
  stable var stableLastSeen : [(Text, Time.Time)] = [];
  stable var stableLikesFlat : [(Nat, Text, Text)] = [];

  system func preupgrade() {
    stableLocalUsers := localUsers.entries().toArray();
    stableSessions := sessions.entries().toArray();
    stableMessages := messages.entries().toArray();
    stablePosts := posts.entries().toArray();
    stableDirectMessages := directMessages.entries().toArray();
    stableComments := comments.entries().toArray();
    stableNotifications := notifications.entries().toArray();
    stableLocalCallRequests := localCallRequests.entries().toArray();
    stableVerifiedUsers := verifiedUsers.toArray();
    stableBannedUsers := bannedUsers.toArray();
    stableBanExpiry := banExpiry.entries().toArray();
    // Convert Map<Text, Set<Text>> to [(Text, [Text])] using explicit loops
    var tmpFollowers : [(Text, [Text])] = [];
    for ((k, v) in followers.entries()) {
      tmpFollowers := tmpFollowers.concat([(k, v.toArray())]);
    };
    stableFollowers := tmpFollowers;
    var tmpFollowing : [(Text, [Text])] = [];
    for ((k, v) in following.entries()) {
      tmpFollowing := tmpFollowing.concat([(k, v.toArray())]);
    };
    stableFollowing := tmpFollowing;
    var tmpConversationIndex : [(Text, [Text])] = [];
    for ((k, v) in conversationIndex.entries()) {
      tmpConversationIndex := tmpConversationIndex.concat([(k, v.toArray())]);
    };
    stableConversationIndex := tmpConversationIndex;
    var tmpBlockList : [(Text, [Text])] = [];
    for ((k, v) in blockList.entries()) {
      tmpBlockList := tmpBlockList.concat([(k, v.toArray())]);
    };
    stableBlockList := tmpBlockList;
    stableProfileSettings := profileSettings.entries().toArray();
    stableCallTopics := callTopics.entries().toArray();
    stableUserBios := userBios.entries().toArray();
    stableUserStatuses := userStatuses.entries().toArray();
    var tmpProfileVisitors : [(Text, [Text])] = [];
    for ((k, v) in profileVisitors.entries()) {
      tmpProfileVisitors := tmpProfileVisitors.concat([(k, v.toArray())]);
    };
    stableProfileVisitors := tmpProfileVisitors;
    stableLastSeen := lastSeen.entries().toArray();
    // Flatten likes: (postId, principal.toText(), displayName)
    var flatLikes : [(Nat, Text, Text)] = [];
    for ((postId, likeMap) in likes.entries()) {
      for ((principal, name) in likeMap.entries()) {
        flatLikes := flatLikes.concat([(postId, principal.toText(), name)]);
      };
    };
    stableLikesFlat := flatLikes;
  };

  system func postupgrade() {
    for ((k, v) in stableLocalUsers.values()) { localUsers.add(k, v) };
    for ((k, v) in stableSessions.values()) { sessions.add(k, v) };
    for ((k, v) in stableMessages.values()) { messages.add(k, v) };
    for ((k, v) in stablePosts.values()) { posts.add(k, v) };
    for ((k, v) in stableDirectMessages.values()) { directMessages.add(k, v) };
    for ((k, v) in stableComments.values()) { comments.add(k, v) };
    for ((k, v) in stableNotifications.values()) { notifications.add(k, v) };
    for ((k, v) in stableLocalCallRequests.values()) { localCallRequests.add(k, v) };
    for (u in stableVerifiedUsers.values()) { verifiedUsers.add(u) };
    for (u in stableBannedUsers.values()) { bannedUsers.add(u) };
    for ((k, v) in stableBanExpiry.values()) { banExpiry.add(k, v) };
    for ((k, arr) in stableFollowers.values()) {
      let s = Set.empty<Text>();
      for (u in arr.values()) { s.add(u) };
      followers.add(k, s);
    };
    for ((k, arr) in stableFollowing.values()) {
      let s = Set.empty<Text>();
      for (u in arr.values()) { s.add(u) };
      following.add(k, s);
    };
    for ((k, arr) in stableConversationIndex.values()) {
      let s = Set.empty<Text>();
      for (u in arr.values()) { s.add(u) };
      conversationIndex.add(k, s);
    };
    for ((k, arr) in stableBlockList.values()) {
      let s = Set.empty<Text>();
      for (u in arr.values()) { s.add(u) };
      blockList.add(k, s);
    };
    for ((k, v) in stableProfileSettings.values()) { profileSettings.add(k, v) };
    for ((k, v) in stableCallTopics.values()) { callTopics.add(k, v) };
    for ((k, v) in stableUserBios.values()) { userBios.add(k, v) };
    for ((k, v) in stableUserStatuses.values()) { userStatuses.add(k, v) };
    for ((k, arr) in stableProfileVisitors.values()) {
      let s = Set.empty<Text>();
      for (u in arr.values()) { s.add(u) };
      profileVisitors.add(k, s);
    };
    for ((k, v) in stableLastSeen.values()) { lastSeen.add(k, v) };
    // Restore likes
    for ((postId, principalText, name) in stableLikesFlat.values()) {
      let p = Principal.fromText(principalText);
      let postLikes = switch (likes.get(postId)) {
        case (?pl) { pl };
        case (null) {
          let newMap = Map.empty<Principal, Text>();
          likes.add(postId, newMap);
          newMap;
        };
      };
      postLikes.add(p, name);
    };
    // Clear stable arrays after restore to free memory
    stableLocalUsers := [];
    stableSessions := [];
    stableMessages := [];
    stablePosts := [];
    stableDirectMessages := [];
    stableComments := [];
    stableNotifications := [];
    stableLocalCallRequests := [];
    stableVerifiedUsers := [];
    stableBannedUsers := [];
    stableBanExpiry := [];
    stableFollowers := [];
    stableFollowing := [];
    stableConversationIndex := [];
    stableBlockList := [];
    stableProfileSettings := [];
    stableCallTopics := [];
    stableUserBios := [];
    stableUserStatuses := [];
    stableProfileVisitors := [];
    stableLastSeen := [];
    stableLikesFlat := [];
  };


};
