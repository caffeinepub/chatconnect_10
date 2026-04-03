import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  LogOut,
  Mic,
  MicOff,
  Radio,
  Send,
  ShieldAlert,
  Volume2,
  VolumeX,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type {
  backendInterface as ExtendedBackend,
  Message,
} from "../backend.d";
import { BottomNav } from "../components/BottomNav";
import { GlobalCallWatcher } from "../components/GlobalCallWatcher";
import { useActor } from "../hooks/useActor";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import { useLocalAuth } from "../hooks/useLocalAuth";
import {
  useGetCallerUserProfile,
  useGetMessages,
  useGetUsers,
  useSendMessage,
} from "../hooks/useQueries";
import { useVoiceChat } from "../hooks/useVoiceChat";

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

const REACTION_EMOJIS = ["🔥", "❤️", "😂", "👏", "🎵"];

interface FloatingReaction {
  id: number;
  emoji: string;
  x: number;
}

export default function LobbyPage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { room?: string };
  const roomId = search.room ?? "lobby";
  const roomName = search.room
    ? search.room.charAt(0).toUpperCase() + search.room.slice(1)
    : null;
  const roomEmojis: Record<string, string> = {
    music: "🎵",
    chill: "😌",
    gaming: "🎮",
    rants: "💬",
  };
  const roomEmoji = search.room ? (roomEmojis[search.room] ?? "🎙️") : null;
  const { identity, clear } = useInternetIdentity();
  const { localSession, logoutLocal, isLocalLoggedIn, sessionValidated } =
    useLocalAuth();
  const { actor } = useActor();
  const extActor = actor as unknown as ExtendedBackend | null;
  const queryClient = useQueryClient();
  const [messageText, setMessageText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: myProfile, isLoading: profileLoading } =
    useGetCallerUserProfile();
  const { data: iiMessages = [] } = useGetMessages();
  const { data: users = [] } = useGetUsers();
  const sendMessageII = useSendMessage();

  // Voice chat — pass roomId for signal isolation
  const {
    isInChannel,
    isMicMuted,
    isSpeakerMuted,
    participants: voiceParticipants,
    micLevel,
    micPermission,
    joinChannel,
    leaveChannel,
    toggleMic,
    toggleSpeaker,
    requestMicPermission,
  } = useVoiceChat(
    localSession?.token ?? null,
    localSession?.username ?? null,
    roomId,
  );

  // On Air = in channel and mic not muted
  const isOnAir = isInChannel && !isMicMuted;

  // Local messages state
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [isSendingLocal, setIsSendingLocal] = useState(false);

  // Reactions state
  const [reactionTrayOpen, setReactionTrayOpen] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState<
    FloatingReaction[]
  >([]);
  // reaction throttle ref (timestamps only needed)
  const reactionTimestampsRef = useRef<number[]>([]);
  const reactionIdRef = useRef(0);

  // Fetch local messages via polling
  useEffect(() => {
    if (!isLocalLoggedIn || !extActor || !localSession) return;
    const fetchLocalMessages = async () => {
      try {
        const msgs = await extActor.getMessagesAsLocal(localSession.token);
        setLocalMessages(msgs);
      } catch {
        // ignore
      }
    };
    fetchLocalMessages();
    const interval = setInterval(fetchLocalMessages, 1500);
    return () => clearInterval(interval);
  }, [isLocalLoggedIn, extActor, localSession]);

  // Auth guard
  useEffect(() => {
    if (sessionValidated && !identity && !isLocalLoggedIn && !profileLoading) {
      navigate({ to: "/login" });
    }
  }, [sessionValidated, identity, isLocalLoggedIn, profileLoading, navigate]);

  useEffect(() => {
    if (identity && !profileLoading && myProfile === null)
      navigate({ to: "/setup" });
  }, [identity, profileLoading, myProfile, navigate]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  });

  const messages = isLocalLoggedIn ? localMessages : iiMessages;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;
    const text = messageText;
    setMessageText("");
    if (isLocalLoggedIn && localSession && extActor) {
      setIsSendingLocal(true);
      try {
        await extActor.sendMessageAsLocal(localSession.token, text);
        const msgs = await extActor.getMessagesAsLocal(localSession.token);
        setLocalMessages(msgs);
      } catch {
        toast.error("Failed to send message");
        setMessageText(text);
      } finally {
        setIsSendingLocal(false);
      }
    } else {
      try {
        await sendMessageII.mutateAsync(text);
      } catch {
        toast.error("Failed to send message");
        setMessageText(text);
      }
    }
  };

  const handleLogout = async () => {
    if (isInChannel) await leaveChannel();
    if (isLocalLoggedIn) {
      await logoutLocal();
    } else {
      await clear();
      queryClient.clear();
    }
    navigate({ to: "/" });
  };

  const getMessageAuthorName = (msg: Message) => {
    if (msg.authorName) return msg.authorName;
    const user = users.find(
      (u) => u.principal.toString() === msg.author.toString(),
    );
    return user?.fname || user?.name || "Unknown";
  };

  const getUserPhoto = (msg: Message) => {
    const user = users.find(
      (u) => u.principal.toString() === msg.author.toString(),
    );
    return user?.photo?.getDirectURL();
  };

  const isMyMessage = (msg: Message) => {
    if (isLocalLoggedIn && localSession) {
      return msg.authorName === localSession.displayName;
    }
    return (
      identity && msg.author.toString() === identity.getPrincipal().toString()
    );
  };

  const sortedMessages = [...messages].sort((a, b) =>
    a.timestamp < b.timestamp ? -1 : 1,
  );

  const currentDisplayName = isLocalLoggedIn
    ? localSession?.displayName
    : myProfile?.fname || myProfile?.name || "";

  const isSending = isLocalLoggedIn ? isSendingLocal : sendMessageII.isPending;

  // Voice participant splits
  const onAirUsers = voiceParticipants.filter((p) => p.isMicActive);
  const listenerUsers = voiceParticipants.filter((p) => !p.isMicActive);

  const [micDenied, setMicDenied] = useState(false);

  // Handle Join Voice — go directly On Air
  const handleJoinVoice = async () => {
    setMicDenied(false);
    if (micPermission === "denied") {
      setMicDenied(true);
      return;
    }
    try {
      if (micPermission === "prompt" || micPermission === "unknown") {
        const granted = await requestMicPermission();
        if (!granted) {
          setMicDenied(true);
          return;
        }
      }
      await joinChannel();
    } catch {
      setMicDenied(true);
    }
  };

  // Handle reaction send with throttle (max 3 per 5s)
  const handleSendReaction = (emoji: string) => {
    const now = Date.now();
    // Clean up timestamps older than 5s
    reactionTimestampsRef.current = reactionTimestampsRef.current.filter(
      (t) => now - t < 5000,
    );
    if (reactionTimestampsRef.current.length >= 3) {
      toast.error("Slow down! Max 3 reactions per 5 seconds.");
      return;
    }
    reactionTimestampsRef.current.push(now);
    setReactionTrayOpen(false);

    const id = reactionIdRef.current++;
    const x = 20 + Math.random() * 60; // random horizontal position 20–80%
    setFloatingReactions((prev) => [...prev, { id, emoji, x }]);

    // Auto-remove after animation
    setTimeout(() => {
      setFloatingReactions((prev) => prev.filter((r) => r.id !== id));
    }, 1000);
  };

  return (
    <>
      <GlobalCallWatcher />
      <div className="h-[100dvh] bg-background flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-background border-b border-border px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg gradient-hero flex items-center justify-center text-white font-bold text-sm">
              W
            </div>
            <span className="font-display font-bold text-lg">WaveChat</span>
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground ml-1">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              {roomName ? `${roomEmoji} ${roomName} Room` : "Global Lobby"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {currentDisplayName && (
              <span className="hidden md:inline text-xs font-medium text-muted-foreground">
                {currentDisplayName}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="rounded-full w-9 h-9 p-0"
              data-ocid="lobby.close_button"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Mic Permission Banner */}
        {micPermission === "denied" && (
          <div className="bg-amber-50 dark:bg-amber-950 border-b border-amber-200 dark:border-amber-800 px-4 py-2.5 flex items-center gap-3 flex-shrink-0">
            <ShieldAlert className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <p className="text-xs text-amber-800 dark:text-amber-200 flex-1">
              Microphone blocked. Tap the lock icon in your browser's address
              bar and allow mic access.
            </p>
          </div>
        )}

        {/* ── ON AIR STRIP ───────────────────────────────────────── */}
        <div className="bg-background border-b border-border flex-shrink-0">
          {/* Section label */}
          <div className="flex items-center justify-between px-4 pt-2 pb-1">
            <div className="flex items-center gap-1.5">
              <Radio className="h-3.5 w-3.5 text-green-500" />
              <span className="text-xs font-bold uppercase tracking-wide text-green-600 dark:text-green-400">
                On Air
              </span>
              {onAirUsers.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-[10px] font-bold">
                  {onAirUsers.length}
                </span>
              )}
            </div>
          </div>
          {/* On Air avatars — 64px circles with pulsing ring */}
          <div
            className="flex items-end gap-4 px-4 pb-2 overflow-x-auto"
            style={{ scrollbarWidth: "none" }}
          >
            {onAirUsers.map((p) => (
              <button
                key={p.username}
                type="button"
                onClick={() =>
                  navigate({
                    to: "/profile",
                    search: { user: p.username } as any,
                  })
                }
                className="flex flex-col items-center gap-1 flex-shrink-0 group"
                data-ocid="lobby.item.1"
              >
                <div
                  className={`w-16 h-16 rounded-full bg-gradient-to-br ${getGradient(p.username)} flex items-center justify-center text-white text-lg font-bold`}
                  style={{ animation: "mic-pulse 1.4s ease-in-out infinite" }}
                >
                  {p.displayName.slice(0, 2).toUpperCase()}
                </div>
                <span className="text-[10px] text-muted-foreground max-w-[64px] truncate text-center group-hover:text-foreground transition-colors">
                  {p.displayName.slice(0, 10)}
                </span>
              </button>
            ))}
            {/* Plus button — join On Air */}
            {!isInChannel && (
              <button
                type="button"
                onClick={handleJoinVoice}
                className="flex flex-col items-center gap-1 flex-shrink-0"
                data-ocid="voice.primary_button"
              >
                <div className="w-16 h-16 rounded-full border-2 border-dashed border-green-400 dark:border-green-600 flex items-center justify-center text-green-500 text-2xl font-bold hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors">
                  +
                </div>
                <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">
                  Go On Air
                </span>
              </button>
            )}
            {onAirUsers.length === 0 && isInChannel && (
              <span className="text-xs text-muted-foreground py-2">
                No one on air — you're up!
              </span>
            )}
            {onAirUsers.length === 0 && !isInChannel && (
              <span className="text-xs text-muted-foreground py-3">
                Tap + to go on air first
              </span>
            )}
          </div>

          {/* ── LISTENERS STRIP ─────────────────────────────────── */}
          {(listenerUsers.length > 0 || (isInChannel && isMicMuted)) && (
            <div className="px-4 pb-2 border-t border-border/50 pt-1.5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  Listeners
                </span>
                <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                  {listenerUsers.length + (isInChannel && isMicMuted ? 0 : 0)}{" "}
                  listening
                </span>
              </div>
              <div
                className="flex flex-wrap gap-1.5"
                style={{ maxHeight: "56px", overflow: "hidden" }}
              >
                {listenerUsers.map((p) => (
                  <button
                    key={p.username}
                    type="button"
                    onClick={() =>
                      navigate({
                        to: "/profile",
                        search: { user: p.username } as any,
                      })
                    }
                    className={`w-8 h-8 rounded-full bg-gradient-to-br ${getGradient(p.username)} flex items-center justify-center text-white text-xs font-bold hover:opacity-80 transition-opacity`}
                    title={p.displayName}
                    data-ocid="lobby.item.1"
                  >
                    {p.displayName.slice(0, 2).toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── MAIN CHAT AREA ───────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden">
          {/* Desktop sidebar */}
          <aside className="w-56 border-r border-border bg-background flex-shrink-0 hidden md:flex flex-col">
            <div className="p-3 border-b border-border">
              <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                Online
              </h3>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-0.5">
                {users.slice(0, 20).map((user, i) => (
                  <div
                    key={user.principal.toString()}
                    className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-muted/50 transition-colors"
                    data-ocid={`lobby.item.${i + 1}`}
                  >
                    <div className="relative flex-shrink-0">
                      {user.photo ? (
                        <img
                          src={user.photo.getDirectURL()}
                          alt={user.fname}
                          className="w-7 h-7 rounded-full object-cover"
                        />
                      ) : (
                        <div
                          className={`w-7 h-7 rounded-full bg-gradient-to-br ${getGradient(user.principal.toString())} flex items-center justify-center text-white text-xs font-bold`}
                        >
                          {(user.fname || user.name).slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-400 rounded-full border border-background" />
                    </div>
                    <span className="text-xs font-medium truncate">
                      {user.fname || user.name}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </aside>

          {/* Chat messages — scrollable middle section */}
          <main className="flex-1 flex flex-col overflow-hidden">
            <ScrollArea className="flex-1 px-4 py-4">
              <AnimatePresence initial={false}>
                {sortedMessages.length === 0 ? (
                  <div
                    className="flex flex-col items-center justify-center h-48 text-center"
                    data-ocid="lobby.empty_state"
                  >
                    <div className="text-4xl mb-3">💬</div>
                    <h3 className="font-semibold text-base text-foreground mb-1">
                      Welcome to{" "}
                      {roomName ? `${roomEmoji} ${roomName}` : "the Lobby"}!
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      Be the first to say hello
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-w-2xl mx-auto">
                    {sortedMessages.map((msg, i) => {
                      const mine = isMyMessage(msg);
                      const name = getMessageAuthorName(msg);
                      const photo = getUserPhoto(msg);
                      return (
                        <motion.div
                          key={msg.id.toString()}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2 }}
                          className={`flex gap-2.5 items-end ${mine ? "flex-row-reverse" : ""}`}
                          data-ocid={`lobby.item.${i + 1}`}
                        >
                          <Avatar className="w-7 h-7 flex-shrink-0">
                            {photo && <AvatarImage src={photo} />}
                            <AvatarFallback
                              className={`bg-gradient-to-br ${getGradient(msg.author.toString())} text-white text-xs`}
                            >
                              {name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div
                            className={`max-w-[75%] ${
                              mine ? "items-end" : "items-start"
                            } flex flex-col gap-0.5`}
                          >
                            {!mine && (
                              <button
                                type="button"
                                onClick={() =>
                                  navigate({
                                    to: "/profile",
                                    search: { user: msg.authorName } as any,
                                  })
                                }
                                className="text-xs text-muted-foreground px-1 hover:text-foreground transition-colors text-left"
                              >
                                {name}
                              </button>
                            )}
                            <div
                              className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${
                                mine
                                  ? "text-white rounded-br-sm"
                                  : "bg-card border border-border text-foreground rounded-bl-sm"
                              }`}
                              style={
                                mine
                                  ? {
                                      background:
                                        "linear-gradient(135deg, #7C3AED, #22C7B7)",
                                    }
                                  : {}
                              }
                            >
                              {msg.text}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </ScrollArea>

            {/* ── BOTTOM CONTROLS ─────────────────────────────────── */}
            <div
              className="relative border-t border-border bg-background flex-shrink-0 px-3 pt-2"
              style={{
                paddingBottom:
                  "calc(4.5rem + env(safe-area-inset-bottom, 0px))",
              }}
            >
              {/* Floating reactions */}
              <AnimatePresence>
                {floatingReactions.map((r) => (
                  <motion.div
                    key={r.id}
                    className="absolute pointer-events-none text-2xl"
                    style={{
                      left: `${r.x}%`,
                      bottom: "100px",
                      animation: "float-up 1s ease-out forwards",
                    }}
                  >
                    {r.emoji}
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Reaction tray */}
              <AnimatePresence>
                {reactionTrayOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute bottom-full left-0 right-0 mx-3 mb-1 bg-card border border-border rounded-2xl p-3 shadow-lg"
                    data-ocid="lobby.popover"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-muted-foreground">
                        React
                      </span>
                      <button
                        type="button"
                        onClick={() => setReactionTrayOpen(false)}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="flex gap-3 justify-center">
                      {REACTION_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => handleSendReaction(emoji)}
                          className="text-2xl hover:scale-125 transition-transform active:scale-95"
                          data-ocid="lobby.toggle"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Chat input row */}
              <form
                onSubmit={handleSend}
                className="flex gap-2 max-w-2xl mx-auto mb-2"
              >
                <Input
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder={
                    roomName
                      ? `Say something in ${roomName}...`
                      : "Say something to the lobby..."
                  }
                  className="flex-1 rounded-full h-10 px-4"
                  data-ocid="lobby.input"
                />
                <Button
                  type="submit"
                  disabled={!messageText.trim() || isSending}
                  className="rounded-full w-10 h-10 p-0 btn-orange flex-shrink-0"
                  data-ocid="lobby.submit_button"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>

              {/* Voice controls row */}
              <div className="flex items-center gap-2 max-w-2xl mx-auto">
                {/* Main On Air / Listener toggle button */}
                {!isInChannel ? (
                  <button
                    type="button"
                    onClick={handleJoinVoice}
                    className="flex-1 flex items-center justify-center gap-2 h-10 rounded-full text-white text-sm font-semibold transition-all active:scale-98"
                    style={{
                      background:
                        micPermission === "denied"
                          ? "linear-gradient(135deg, #9ca3af, #6b7280)"
                          : "linear-gradient(135deg, #16a34a, #22c55e)",
                    }}
                    data-ocid="voice.primary_button"
                  >
                    <Radio className="h-4 w-4" />
                    Go On Air
                  </button>
                ) : isOnAir ? (
                  <button
                    type="button"
                    onClick={toggleMic}
                    className="flex-1 flex items-center justify-center gap-2 h-10 rounded-full text-white text-sm font-semibold transition-all active:scale-98"
                    style={{
                      background: "linear-gradient(135deg, #7C3AED, #22C7B7)",
                      animation: "mic-pulse 1.4s ease-in-out infinite",
                    }}
                    data-ocid="voice.primary_button"
                  >
                    <Mic className="h-4 w-4" />
                    On Air — Tap to become Listener
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={toggleMic}
                    className="flex-1 flex items-center justify-center gap-2 h-10 rounded-full bg-muted text-foreground text-sm font-semibold border border-border transition-all active:scale-98 hover:bg-muted/80"
                    data-ocid="voice.primary_button"
                  >
                    <MicOff className="h-4 w-4 text-muted-foreground" />
                    Listening — Tap to Go On Air
                  </button>
                )}

                {/* Mic mute toggle (only when in channel) */}
                {isInChannel && (
                  <button
                    type="button"
                    onClick={toggleMic}
                    className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 border transition-colors ${
                      isMicMuted
                        ? "bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-600"
                        : "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-600"
                    }`}
                    title={isMicMuted ? "Unmute mic" : "Mute mic"}
                    data-ocid="voice.toggle"
                  >
                    {isMicMuted ? (
                      <MicOff className="h-4 w-4" />
                    ) : (
                      <Mic className="h-4 w-4" />
                    )}
                  </button>
                )}

                {/* Speaker toggle (only when in channel) */}
                {isInChannel && (
                  <button
                    type="button"
                    onClick={toggleSpeaker}
                    className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 border transition-colors ${
                      isSpeakerMuted
                        ? "bg-muted border-border text-muted-foreground"
                        : "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-600"
                    }`}
                    title={isSpeakerMuted ? "Unmute speaker" : "Mute speaker"}
                    data-ocid="voice.toggle"
                  >
                    {isSpeakerMuted ? (
                      <VolumeX className="h-4 w-4" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                  </button>
                )}

                {/* React button */}
                <button
                  type="button"
                  onClick={() => setReactionTrayOpen((v) => !v)}
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-muted border border-border text-lg hover:bg-muted/80 transition-colors"
                  title="React"
                  data-ocid="lobby.open_modal_button"
                >
                  🎭
                </button>

                {/* Leave voice (only when in channel) */}
                {isInChannel && (
                  <button
                    type="button"
                    onClick={leaveChannel}
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                    title="Leave voice"
                    data-ocid="voice.delete_button"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Mic denied error */}
              {micDenied && (
                <p
                  className="text-xs text-red-500 text-center mt-1"
                  data-ocid="voice.error_state"
                >
                  Microphone access denied. Please allow mic in browser
                  settings.
                </p>
              )}

              {/* Mic level indicator when on air */}
              {isInChannel && !isMicMuted && micLevel > 0 && (
                <div className="mt-1.5 max-w-2xl mx-auto">
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-75"
                      style={{
                        width: `${micLevel}%`,
                        background:
                          micLevel > 60
                            ? "#22c55e"
                            : micLevel > 30
                              ? "#eab308"
                              : "#94a3b8",
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>

        <BottomNav />
      </div>
    </>
  );
}
