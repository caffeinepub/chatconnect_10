import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Inbox,
  Loader2,
  LogOut,
  Mic,
  Phone,
  Send,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type {
  ConversationSummary,
  DirectMessage,
  backendInterface as ExtendedBackend,
} from "../backend.d";
import { BottomNav } from "../components/BottomNav";
import { GlobalCallWatcher } from "../components/GlobalCallWatcher";
import { useActor } from "../hooks/useActor";
import { useLocalAuth } from "../hooks/useLocalAuth";

const AVATAR_GRADIENTS = [
  "from-purple-500 to-indigo-600",
  "from-teal-400 to-cyan-500",
  "from-orange-400 to-pink-500",
  "from-emerald-400 to-teal-500",
  "from-rose-400 to-purple-500",
];

function getGradient(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++)
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

function relativeTime(timestamp: bigint): string {
  const ms = Number(timestamp / BigInt(1_000_000));
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

const VOICE_PREFIX = "[VOICE]:";

function MessageBubble({
  msg,
  isMe,
  onDelete,
  canDelete,
}: {
  msg: DirectMessage;
  isMe: boolean;
  onDelete?: () => void;
  canDelete?: boolean;
}) {
  const isVoice = msg.text.startsWith(VOICE_PREFIX);
  const voiceSrc = isVoice ? msg.text.slice(VOICE_PREFIX.length) : null;

  if (isVoice && voiceSrc) {
    return (
      // biome-ignore lint/a11y/useMediaCaption: user-generated voice message
      <audio
        controls
        src={voiceSrc}
        className="max-w-[220px] h-9"
        style={{ colorScheme: isMe ? "dark" : "light" }}
      />
    );
  }

  return (
    <div className="group relative">
      <p className="text-sm leading-relaxed">{msg.text}</p>
      {canDelete && onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity flex items-center justify-center"
          aria-label="Delete message"
          data-ocid="messages.delete_button"
        >
          <Trash2 className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  );
}

export default function MessagesPage() {
  const navigate = useNavigate();
  const { localSession, isLocalLoggedIn, logoutLocal, sessionValidated } =
    useLocalAuth();
  const { actor, isFetching: actorFetching } = useActor();
  const extActor = actor as unknown as ExtendedBackend | null;

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);
  // isLoadingConvos stays true until actor is ready AND first fetch completes
  const [isLoadingConvos, setIsLoadingConvos] = useState(true);
  const [isMobileThread, setIsMobileThread] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [onlineUsernames, setOnlineUsernames] = useState<Set<string>>(
    new Set(),
  );
  const [isCallSending, setIsCallSending] = useState(false);
  const [pinnedMessage, setPinnedMessage] = useState<DirectMessage | null>(
    null,
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actorReadyRef = useRef(false);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [voicePreviewUrl, setVoicePreviewUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);

  // Auth guard
  useEffect(() => {
    if (sessionValidated && !isLocalLoggedIn) {
      navigate({ to: "/login" });
    }
  }, [sessionValidated, isLocalLoggedIn, navigate]);

  // Track when actor becomes available
  useEffect(() => {
    if (extActor && !actorFetching) {
      actorReadyRef.current = true;
    }
  }, [extActor, actorFetching]);

  // Check URL param for pre-selected user
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const user = params.get("user");
    if (user) {
      setSelectedUser(user);
      setIsMobileThread(true);
    }
  }, []);

  // Fetch online usernames
  const fetchOnline = useCallback(async () => {
    if (!extActor) return;
    try {
      const names = await extActor.getOnlineUsernames();
      setOnlineUsernames(new Set(names));
    } catch {
      // ignore
    }
  }, [extActor]);

  useEffect(() => {
    fetchOnline();
    const interval = setInterval(fetchOnline, 30_000);
    return () => clearInterval(interval);
  }, [fetchOnline]);

  // Fetch conversations — wait for actor to be ready before starting, keep loading true until then
  const fetchConversations = useCallback(async () => {
    if (!isLocalLoggedIn || !localSession) return;
    if (!extActor || actorFetching) {
      // Actor not ready; keep loading state until it becomes available
      return;
    }
    try {
      const convos = await extActor.getConversations(localSession.token);
      setConversations(
        [...convos].sort((a, b) => Number(b.lastTimestamp - a.lastTimestamp)),
      );
    } catch {
      // ignore
    } finally {
      setIsLoadingConvos(false);
    }
  }, [isLocalLoggedIn, localSession, extActor, actorFetching]);

  // Keep loading until actor is ready, then fetch
  useEffect(() => {
    if (!extActor || actorFetching) {
      setIsLoadingConvos(true);
      return;
    }
    fetchConversations();
    const interval = setInterval(fetchConversations, 3_000);
    return () => clearInterval(interval);
  }, [fetchConversations, extActor, actorFetching]);

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    if (!isLocalLoggedIn || !localSession || !extActor || !selectedUser) return;
    try {
      const msgs = await extActor.getDirectMessages(
        localSession.token,
        selectedUser,
      );
      setMessages([...msgs].sort((a, b) => Number(a.timestamp - b.timestamp)));
      setTimeout(
        () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }),
        50,
      );
    } catch {
      // ignore
    }
  }, [isLocalLoggedIn, localSession, extActor, selectedUser]);

  useEffect(() => {
    if (!selectedUser) return;
    fetchMessages();
    const interval = setInterval(fetchMessages, 1_500);
    return () => clearInterval(interval);
  }, [selectedUser, fetchMessages]);

  // Mark as read
  useEffect(() => {
    if (!selectedUser || !isLocalLoggedIn || !localSession || !extActor) return;
    extActor
      .markDirectMessagesRead(localSession.token, selectedUser)
      .catch(() => {});
  }, [selectedUser, isLocalLoggedIn, localSession, extActor]);

  // Typing status
  useEffect(() => {
    if (!selectedUser || !isLocalLoggedIn || !localSession || !extActor) return;
    const pollTyping = async () => {
      try {
        const typing = await (extActor as any).getTypingStatus(
          localSession.token,
          selectedUser,
        );
        setIsTyping(typing);
      } catch {
        // ignore
      }
    };
    pollTyping();
    const interval = setInterval(pollTyping, 2_000);
    return () => clearInterval(interval);
  }, [selectedUser, isLocalLoggedIn, localSession, extActor]);

  // Load pinned message
  useEffect(() => {
    if (!selectedUser || !isLocalLoggedIn || !localSession || !extActor) return;
    (extActor as any)
      .getPinnedMessage?.(localSession.token, selectedUser)
      .then((msg: DirectMessage | null) => {
        if (msg) setPinnedMessage(msg);
      })
      .catch(() => {});
  }, [selectedUser, isLocalLoggedIn, localSession, extActor]);

  // Clean up voice preview URL on unmount
  useEffect(() => {
    return () => {
      if (voicePreviewUrl) URL.revokeObjectURL(voicePreviewUrl);
    };
  }, [voicePreviewUrl]);

  const handleInputChange = (value: string) => {
    setMessageText(value);
    if (!selectedUser || !localSession || !extActor) return;
    (extActor as any)
      .setTypingStatus(localSession.token, selectedUser, true)
      .catch(() => {});
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      (extActor as any)
        .setTypingStatus(localSession.token, selectedUser, false)
        .catch(() => {});
    }, 4_000);
  };

  const handleSelectUser = (username: string) => {
    setSelectedUser(username);
    setIsMobileThread(true);
    setMessages([]);
    setIsTyping(false);
    setPinnedMessage(null);
    setVoiceBlob(null);
    if (voicePreviewUrl) {
      URL.revokeObjectURL(voicePreviewUrl);
      setVoicePreviewUrl(null);
    }
  };

  const handleSend = async () => {
    if (!messageText.trim() || !selectedUser || !localSession || !extActor)
      return;
    const text = messageText.trim();
    setMessageText("");
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    (extActor as any)
      .setTypingStatus(localSession.token, selectedUser, false)
      .catch(() => {});
    const optimistic: DirectMessage = {
      id: BigInt(Date.now()),
      senderUsername: localSession.username,
      recipientUsername: selectedUser,
      text,
      timestamp: BigInt(Date.now()) * BigInt(1_000_000),
      isRead: false,
    };
    setMessages((prev) => [...prev, optimistic]);
    setIsSending(true);
    try {
      await extActor.sendDirectMessage(localSession.token, selectedUser, text);
      // Immediately fetch to replace optimistic with real message
      await fetchMessages();
      fetchConversations();
    } catch {
      // Remove optimistic message on failure
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setMessageText(text);
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteMessage = async (msgId: bigint) => {
    if (!localSession || !extActor) return;
    try {
      await (extActor as any).deleteDirectMessage?.(localSession.token, msgId);
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
    } catch {
      // Ignore if API not available
    }
  };

  const handlePinMessage = async (msgId: bigint) => {
    if (!selectedUser || !localSession || !extActor) return;
    try {
      await (extActor as any).pinDirectMessage?.(
        localSession.token,
        selectedUser,
        msgId,
      );
      const msg = messages.find((m) => m.id === msgId);
      if (msg) setPinnedMessage(msg);
      toast.success("Message pinned");
    } catch {
      // Ignore if API not available
    }
  };

  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setVoiceBlob(blob);
        const url = URL.createObjectURL(blob);
        setVoicePreviewUrl(url);
        // Stop mic tracks
        for (const track of stream.getTracks()) track.stop();
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      toast.error("Could not access microphone");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const sendVoiceMessage = async () => {
    if (!voiceBlob || !selectedUser || !localSession || !extActor) return;
    setIsSending(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUri = reader.result as string;
        const text = `${VOICE_PREFIX}${dataUri}`;
        await extActor.sendDirectMessage(
          localSession.token,
          selectedUser,
          text,
        );
        setVoiceBlob(null);
        if (voicePreviewUrl) {
          URL.revokeObjectURL(voicePreviewUrl);
          setVoicePreviewUrl(null);
        }
        await fetchMessages();
        fetchConversations();
        setIsSending(false);
      };
      reader.readAsDataURL(voiceBlob);
    } catch {
      toast.error("Failed to send voice message");
      setIsSending(false);
    }
  };

  const discardVoice = () => {
    setVoiceBlob(null);
    if (voicePreviewUrl) {
      URL.revokeObjectURL(voicePreviewUrl);
      setVoicePreviewUrl(null);
    }
  };

  // Inbox calling
  const handleCallUser = async () => {
    if (!selectedUser || !localSession || !extActor || isCallSending) return;
    setIsCallSending(true);
    try {
      await extActor.sendCallRequestAsLocal(localSession.token, selectedUser);
      toast.success(`Call request sent to ${selectedDisplayName}`);
    } catch {
      toast.error("Failed to send call request");
    } finally {
      setTimeout(() => setIsCallSending(false), 2000);
    }
  };

  const handleLogout = async () => {
    await logoutLocal();
    navigate({ to: "/login" });
  };

  const selectedConvo = conversations.find(
    (c) => c.otherUsername === selectedUser,
  );
  const selectedDisplayName =
    selectedConvo?.otherDisplayName || selectedUser || "";
  const isSelectedOnline = selectedUser
    ? onlineUsernames.has(selectedUser)
    : false;

  return (
    <div
      className="fixed inset-0 bg-background flex flex-col"
      style={{ paddingBottom: "calc(56px + env(safe-area-inset-bottom, 0px))" }}
    >
      <GlobalCallWatcher />

      {/* Header */}
      <header className="bg-background border-b border-border px-4 py-3 flex items-center justify-between flex-shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg gradient-hero flex items-center justify-center text-white font-bold text-sm">
            W
          </div>
          <span className="font-display font-bold text-lg">WaveChat</span>
        </div>
        <nav className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="rounded-full w-9 h-9 p-0"
            data-ocid="messages.close_button"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </nav>
      </header>

      {/* Main two-panel layout */}
      <div className="flex flex-1 overflow-hidden gap-3 p-3">
        {/* Conversation List */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className={`${
            isMobileThread ? "hidden md:flex" : "flex"
          } flex-col w-full md:w-80 flex-shrink-0 bg-card rounded-2xl border border-border shadow-sm overflow-hidden`}
          data-ocid="messages.panel"
        >
          <div className="px-4 py-3 border-b border-border flex items-center gap-2 flex-shrink-0">
            <Inbox className="h-5 w-5 text-primary" />
            <h2 className="font-display font-semibold text-base">Inbox</h2>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoadingConvos ? (
              <div
                className="flex items-center justify-center py-12"
                data-ocid="messages.loading_state"
              >
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : conversations.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-12 px-4 text-center gap-3"
                data-ocid="messages.empty_state"
              >
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Inbox className="h-8 w-8 text-primary/50" />
                </div>
                <p className="text-sm text-muted-foreground">
                  No conversations yet. Message someone from their Calling Card.
                </p>
              </div>
            ) : (
              conversations.map((convo, idx) => {
                const isSentByMe =
                  convo.lastMessageSender === localSession?.username;
                const isOnline = onlineUsernames.has(convo.otherUsername);
                return (
                  <button
                    key={convo.otherUsername}
                    type="button"
                    onClick={() => handleSelectUser(convo.otherUsername)}
                    className={`w-full flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors text-left ${
                      selectedUser === convo.otherUsername ? "bg-primary/5" : ""
                    }`}
                    data-ocid={`messages.item.${idx + 1}`}
                  >
                    <div className="relative flex-shrink-0">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback
                          className={`bg-gradient-to-br ${getGradient(convo.otherUsername)} text-white text-sm font-semibold`}
                        >
                          {(convo.otherDisplayName || convo.otherUsername)
                            .slice(0, 2)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {isOnline && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-card" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm truncate">
                          {convo.otherDisplayName || convo.otherUsername}
                        </span>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {relativeTime(convo.lastTimestamp)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        {isSentByMe &&
                          (convo.lastMessageIsRead ? (
                            <CheckCheck className="h-3 w-3 text-blue-500 flex-shrink-0" />
                          ) : (
                            <Check className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          ))}
                        <p className="text-xs text-muted-foreground truncate">
                          {convo.lastMessage}
                        </p>
                      </div>
                    </div>
                    {Number(convo.unreadCount) > 0 && (
                      <span className="flex-shrink-0 h-5 w-5 rounded-full bg-primary text-white text-[10px] font-semibold flex items-center justify-center">
                        {Number(convo.unreadCount) > 9
                          ? "9+"
                          : Number(convo.unreadCount)}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </motion.div>

        {/* Chat Thread */}
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className={`${
            !isMobileThread && !selectedUser ? "hidden md:flex" : "flex"
          } flex-col flex-1 bg-card rounded-2xl border border-border shadow-sm overflow-hidden`}
          data-ocid="messages.card"
        >
          {!selectedUser ? (
            <div className="flex-1 flex flex-col items-center justify-center py-16 gap-3 text-center px-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500/20 to-teal-500/20 flex items-center justify-center">
                <Inbox className="h-10 w-10 text-primary/40" />
              </div>
              <p className="text-muted-foreground">
                Select a conversation to start chatting
              </p>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="px-4 py-3 border-b border-border flex items-center gap-3 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="md:hidden rounded-full h-8 w-8 p-0"
                  onClick={() => setIsMobileThread(false)}
                  data-ocid="messages.cancel_button"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="relative">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback
                      className={`bg-gradient-to-br ${getGradient(selectedUser)} text-white text-xs font-semibold`}
                    >
                      {selectedDisplayName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {isSelectedOnline && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-card" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    navigate({
                      to: "/profile",
                      search: { user: selectedUser } as any,
                    })
                  }
                  className="flex-1 text-left hover:opacity-80 transition-opacity"
                  data-ocid="messages.link"
                >
                  <p className="font-semibold text-sm">{selectedDisplayName}</p>
                  {isTyping ? (
                    <p className="text-xs text-primary animate-pulse">
                      typing...
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {isSelectedOnline ? "Online" : `@${selectedUser}`}
                    </p>
                  )}
                </button>
                {/* Call button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCallUser}
                  disabled={isCallSending}
                  className="rounded-full h-9 w-9 p-0 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
                  data-ocid="messages.primary_button"
                >
                  {isCallSending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Phone className="h-4 w-4" />
                  )}
                </Button>
                {/* Video Call button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (!selectedUser || !localSession || !extActor) return;
                    const callId = `${selectedUser}_${Date.now()}`;
                    extActor
                      .sendSignal(
                        localSession.token,
                        selectedUser,
                        "video-call-request",
                        callId,
                      )
                      .catch(() => {});
                    navigate({ to: "/video-call/$callId", params: { callId } });
                  }}
                  className="rounded-full h-9 w-9 p-0 text-violet-600 hover:text-violet-700 hover:bg-violet-50 dark:hover:bg-violet-950"
                  data-ocid="messages.secondary_button"
                >
                  <Video className="h-4 w-4" />
                </Button>
              </div>

              {/* Pinned message banner */}
              {pinnedMessage && (
                <div className="px-4 py-2 bg-primary/5 border-b border-border/60 flex items-start gap-2">
                  <span className="text-xs text-primary font-semibold flex-shrink-0 mt-0.5">
                    📌
                  </span>
                  <p className="text-xs text-muted-foreground truncate flex-1">
                    {pinnedMessage.text.startsWith(VOICE_PREFIX)
                      ? "Voice message"
                      : pinnedMessage.text}
                  </p>
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4">
                <div className="flex flex-col gap-3">
                  {messages.length === 0 ? (
                    <div
                      className="text-center text-sm text-muted-foreground py-8"
                      data-ocid="messages.thread_empty_state"
                    >
                      No messages yet. Say hi!
                    </div>
                  ) : (
                    messages.map((msg, idx) => {
                      const isMe =
                        msg.senderUsername === localSession?.username;
                      const isLast = idx === messages.length - 1;
                      return (
                        <motion.div
                          key={msg.id.toString()}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2 }}
                          className={`flex ${
                            isMe ? "justify-end" : "justify-start"
                          }`}
                          data-ocid={`messages.row.${idx + 1}`}
                        >
                          <div
                            className={`max-w-[70%] px-4 py-2.5 rounded-2xl ${
                              isMe
                                ? "bg-gradient-to-br from-purple-500 to-teal-500 text-white rounded-br-sm"
                                : "bg-muted text-foreground rounded-bl-sm"
                            }`}
                          >
                            {!isMe && (
                              <p className="text-xs font-semibold mb-1 opacity-70">
                                {msg.senderUsername}
                              </p>
                            )}
                            <MessageBubble
                              msg={msg}
                              isMe={isMe}
                              canDelete={isMe}
                              onDelete={() => handleDeleteMessage(msg.id)}
                            />
                            <div
                              className={`flex items-center gap-1 mt-1 ${
                                isMe ? "justify-end" : "justify-start"
                              }`}
                            >
                              {!isMe && (
                                <button
                                  type="button"
                                  onClick={() => handlePinMessage(msg.id)}
                                  className="text-[10px] text-muted-foreground/60 hover:text-primary transition-colors mr-1"
                                  title="Pin message"
                                >
                                  📌
                                </button>
                              )}
                              <p
                                className={`text-[10px] ${
                                  isMe
                                    ? "text-white/60"
                                    : "text-muted-foreground"
                                }`}
                              >
                                {relativeTime(msg.timestamp)}
                              </p>
                              {isMe &&
                                isLast &&
                                (msg.isRead ? (
                                  <CheckCheck className="h-3 w-3 text-blue-300" />
                                ) : (
                                  <Check className="h-3 w-3 text-white/60" />
                                ))}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Voice preview */}
              {voicePreviewUrl && (
                <div className="px-4 py-2 border-t border-border bg-muted/30 flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    Voice message:
                  </span>
                  {/* biome-ignore lint/a11y/useMediaCaption: user-generated */}
                  <audio
                    controls
                    src={voicePreviewUrl}
                    className="flex-1 h-8"
                  />
                  <Button
                    size="sm"
                    onClick={sendVoiceMessage}
                    disabled={isSending}
                    className="rounded-full h-8 px-3 bg-green-500 hover:bg-green-600 text-white border-0 text-xs"
                    data-ocid="messages.submit_button"
                  >
                    {isSending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      "Send"
                    )}
                  </Button>
                  <button
                    type="button"
                    onClick={discardVoice}
                    className="p-1 rounded-full hover:bg-muted transition-colors"
                    data-ocid="messages.cancel_button"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              )}

              {/* Send input */}
              <div className="px-4 py-3 border-t border-border flex items-center gap-2 flex-shrink-0">
                <Input
                  value={messageText}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={`Message ${selectedDisplayName}...`}
                  className="rounded-full flex-1 border-border"
                  data-ocid="messages.input"
                />
                {/* Mic button */}
                <button
                  type="button"
                  onMouseDown={startRecording}
                  onMouseUp={stopRecording}
                  onTouchStart={startRecording}
                  onTouchEnd={stopRecording}
                  disabled={!!voicePreviewUrl}
                  className={`rounded-full h-9 w-9 flex items-center justify-center flex-shrink-0 transition-all ${
                    isRecording
                      ? "bg-red-500 text-white shadow-lg shadow-red-500/30 animate-pulse"
                      : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  } disabled:opacity-40`}
                  title="Hold to record voice message"
                  data-ocid="messages.upload_button"
                >
                  <Mic className="h-4 w-4" />
                </button>
                <Button
                  size="sm"
                  onClick={handleSend}
                  disabled={!messageText.trim() || isSending}
                  className="rounded-full h-9 w-9 p-0 bg-gradient-to-br from-purple-500 to-teal-500 text-white hover:opacity-90 border-0"
                  data-ocid="messages.submit_button"
                >
                  {isSending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </>
          )}
        </motion.div>
      </div>

      <BottomNav />
    </div>
  );
}
