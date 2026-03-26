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

actor {
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
  var nextId = 0;
  var nextTokenId : Nat = 1;
  var nextSignalId : Nat = 0;
  var nextNotificationId : Nat = 0;
  var nextDmId : Nat = 0;

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
  };

  type SessionToken = Nat;

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

  type NotificationType = { #like; #comment; #callRequest };

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
  };

  include MixinStorage();
  include MixinAuthorization(accessControlState);

  let users = Map.empty<Principal, User>();
  let localUsers = Map.empty<Text, LocalUser>();
  let sessions = Map.empty<SessionToken, Text>();
  let voiceParticipants = Map.empty<Text, VoiceParticipant>();
  let voiceSignals = Map.empty<Nat, Signal>();

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
    callRequestId : ?Nat
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

  // ---- Notifications ----

  public query func getNotificationsAsLocal(token : SessionToken) : async [Notification] {
    let username = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };
    let mine = notifications.values().toArray().filter(
      func(n : Notification) : Bool { n.recipientUsername == username }
    );
    mine
  };

  public shared func markNotificationReadAsLocal(token : SessionToken, id : Nat) : async () {
    let username = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };
    switch (notifications.get(id)) {
      case (?n) {
        if (n.recipientUsername == username) {
          notifications.add(id, { n with isRead = true });
        };
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
    id;
  };

  public query func getDirectMessages(token : SessionToken, otherUsername : Text) : async [DirectMessage] {
    let username = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
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
    // Collect all DMs involving this user
    let myDms = directMessages.values().toArray().filter(
      func(dm : DirectMessage) : Bool {
        dm.senderUsername == username or dm.recipientUsername == username
      }
    );
    // Build conversation map: otherUsername -> (lastMessage, lastTimestamp, unreadCount)
    let convMap = Map.empty<Text, (Text, Time.Time, Nat)>();
    for (dm in myDms.values()) {
      let other = if (dm.senderUsername == username) { dm.recipientUsername } else { dm.senderUsername };
      let unreadIncrement = if (dm.recipientUsername == username and not dm.isRead) { 1 } else { 0 };
      switch (convMap.get(other)) {
        case (null) {
          convMap.add(other, (dm.text, dm.timestamp, unreadIncrement));
        };
        case (?(lastMsg, lastTs, unread)) {
          let newTs = if (dm.timestamp > lastTs) { dm.timestamp } else { lastTs };
          let newMsg = if (dm.timestamp > lastTs) { dm.text } else { lastMsg };
          convMap.add(other, (newMsg, newTs, unread + unreadIncrement));
        };
      };
    };
    convMap.entries().toArray().map(
      func((other, (lastMsg, lastTs, unread)) : (Text, (Text, Time.Time, Nat))) : ConversationSummary {
        let displayName = switch (localUsers.get(other)) {
          case (?u) { u.displayName };
          case (null) { other };
        };
        { otherUsername = other; otherDisplayName = displayName; lastMessage = lastMsg; lastTimestamp = lastTs; unreadCount = unread };
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
        dm.recipientUsername == username and not dm.isRead
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
    voiceParticipants.values().toArray();
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
    switch (validateToken(token)) {
      case (?_) { voiceParticipants.values().toArray() };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };
  };

  public shared func sendSignal(token : SessionToken, toUsername : Text, signalType : Text, data : Text) : async () {
    let fromUsername = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
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
    // Expire signals older than 90 seconds to prevent stale ICE delivery
    let expiryNs : Int = 90_000_000_000;
    let now = Time.now();
    for ((id, s) in voiceSignals.entries().toArray().values()) {
      if (now - s.timestamp > expiryNs) {
        voiceSignals.remove(id);
      };
    };
    let mine = voiceSignals.entries().toArray().filter(
      func((id, s)) { s.toUsername == username }
    ).map(func((id, s)) { s });
    for ((id, _) in voiceSignals.entries().toArray().filter(func((id, s)) { s.toUsername == username }).values()) {
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
    switch (validateToken(token)) {
      case (?_) { posts.values().toArray() };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };
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
                null
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
    switch (validateToken(token)) {
      case (?_) {
        let filtered = comments.values().toArray().filter(func(c) { c.postId == postId });
        let sorted = quicksortComments(filtered);
        sorted;
      };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };
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
                null
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
    switch (validateToken(token)) {
      case (?_) {
        switch (likes.get(postId)) {
          case (?postLikes) { postLikes.values().toArray() };
          case (null) { [] };
        };
      };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };
  };

  // ---- Calls (Principal-based) ----

  public shared ({ caller }) func sendCallRequest(callee : Principal) : async Nat {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can perform this action");
    };
    let id = nextId;
    nextId += 1;
    let callRequest : CallRequest = { id; caller = caller; callee; timestamp = Time.now() };
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
      ?id
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
        cr.callerUsername == username or cr.calleeUsername == username
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
    photo : ?Storage.ExternalBlob
  ) : async () {
    if (localUsers.containsKey(username)) {
      Runtime.trap("Username already exists");
    };
    let localUser : LocalUser = { username; passwordHash; displayName; age; photo };
    localUsers.add(username, localUser);
  };

  public shared func loginLocalAccount(username : Text, passwordHash : Text) : async SessionToken {
    let localUser = switch (localUsers.get(username)) {
      case (?u) { u };
      case (null) { Runtime.trap("Invalid username or password") };
    };
    if (localUser.passwordHash != passwordHash) {
      Runtime.trap("Invalid username or password");
    };
    let token = nextTokenId;
    nextTokenId += 1;
    sessions.add(token, username);
    token;
  };

  public query func validateSessionToken(token : SessionToken) : async ?Text {
    validateToken(token)
  };

  public shared func logoutLocalAccount(token : SessionToken) : async () {
    sessions.remove(token);
  };

  public query func getLocalUserProfile(token : SessionToken) : async ?LocalUser {
    let username = switch (validateToken(token)) {
      case (?u) { u };
      case (null) { return null };
    };
    localUsers.get(username)
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

  public query ({ caller }) func getLocalUsers() : async [LocalUser] {
    localUsers.values().toArray()
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
    switch (validateToken(token)) {
      case (?_) { messages.values().toArray() };
      case (null) { Runtime.trap("Unauthorized: Invalid session token") };
    };
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

  public func verifyUser() : async () { Runtime.trap("Not implemented") };

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
};
