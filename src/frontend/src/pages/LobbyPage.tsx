import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  LogOut,
  Mic,
  MicOff,
  Radio,
  Send,
  ShieldAlert,
  Users,
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

export default function LobbyPage() {
  const navigate = useNavigate();
  const { identity, clear } = useInternetIdentity();
  const { localSession, logoutLocal, isLocalLoggedIn } = useLocalAuth();
  const { actor } = useActor();
  const extActor = actor as unknown as ExtendedBackend | null;
  const queryClient = useQueryClient();
  const [messageText, setMessageText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // "On Air" / "Listeners" tab
  const [voiceTab, setVoiceTab] = useState<"mic" | "online">("mic");

  const { data: myProfile, isLoading: profileLoading } =
    useGetCallerUserProfile();
  const { data: iiMessages = [] } = useGetMessages();
  const { data: users = [] } = useGetUsers();
  const sendMessageII = useSendMessage();

  // Voice chat
  const {
    isInChannel,
    isMicMuted,
    isSpeakerMuted,
    participants: voiceParticipants,
    micLevel,
    isMicTesting,
    micPermission,
    joinChannel,
    leaveChannel,
    toggleMic,
    toggleSpeaker,
    testMic,
    requestMicPermission,
  } = useVoiceChat(localSession?.token ?? null, localSession?.username ?? null);

  // Local messages state
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [isSendingLocal, setIsSendingLocal] = useState(false);

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
    if (!identity && !isLocalLoggedIn && !profileLoading) {
      navigate({ to: "/login" });
    }
  }, [identity, isLocalLoggedIn, profileLoading, navigate]);

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
  const onlineUsers = users.slice(0, 12);

  const currentDisplayName = isLocalLoggedIn
    ? localSession?.displayName
    : myProfile?.fname || myProfile?.name || "";

  const isSending = isLocalLoggedIn ? isSendingLocal : sendMessageII.isPending;

  // Voice tab data — renamed labels
  const onMicUsers = voiceParticipants.filter((p) => p.isMicActive);
  const onlineVoiceUsers = voiceParticipants;
  const tabUsers = voiceTab === "mic" ? onMicUsers : onlineVoiceUsers;

  // Handle Join Voice with permission check
  const handleJoinVoice = async () => {
    if (micPermission === "denied") {
      toast.error(
        "Microphone blocked. Tap the lock icon in your browser address bar and allow mic access.",
      );
      return;
    }
    if (micPermission === "prompt" || micPermission === "unknown") {
      // Request permission first — browser will show native prompt
      const granted = await requestMicPermission();
      if (!granted) return;
    }
    await joinChannel();
  };

  return (
    <TooltipProvider>
      <GlobalCallWatcher />
      <div className="h-screen bg-background flex flex-col">
        <header className="bg-background border-b border-border px-6 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg gradient-hero flex items-center justify-center text-white font-bold text-sm">
              W
            </div>
            <span className="font-display font-bold text-lg">WaveChat</span>
            <span className="hidden md:flex items-center gap-1.5 text-sm text-muted-foreground ml-4">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Global Lobby
            </span>
            {currentDisplayName && (
              <span className="hidden md:inline text-sm font-medium text-foreground ml-2">
                · {currentDisplayName}
              </span>
            )}
          </div>
          <nav className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="rounded-full w-9 h-9 p-0"
              data-ocid="lobby.close_button"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </nav>
        </header>

        {/* Mic Permission Banner */}
        {micPermission === "denied" && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center gap-3 flex-shrink-0">
            <ShieldAlert className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <p className="text-xs text-amber-800 flex-1">
              Microphone blocked. To use voice chat, tap the lock icon in your
              browser's address bar and allow mic access.
            </p>
          </div>
        )}

        {/* Mic Permission Prompt Banner (not yet asked) */}
        {(micPermission === "prompt" || micPermission === "unknown") &&
          !isInChannel && (
            <div className="bg-violet-50 border-b border-violet-200 px-4 py-2.5 flex items-center gap-3 flex-shrink-0">
              <Mic className="h-4 w-4 text-violet-600 flex-shrink-0" />
              <p className="text-xs text-violet-800 flex-1">
                Tap <strong>Join Voice</strong> to enable mic and join the voice
                channel.
              </p>
              <button
                type="button"
                onClick={handleJoinVoice}
                className="text-xs font-semibold text-violet-700 bg-violet-100 hover:bg-violet-200 px-3 py-1 rounded-full transition-colors flex-shrink-0"
              >
                Allow Mic
              </button>
            </div>
          )}

        {/* Voice Status Strip — only on Lobby page, two tabs */}
        <div className="bg-background border-b border-border flex-shrink-0">
          {/* Tab bar */}
          <div className="flex items-center gap-0 border-b border-border/50">
            <button
              type="button"
              onClick={() => setVoiceTab("mic")}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
                voiceTab === "mic"
                  ? "border-green-500 text-green-700"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              data-ocid="lobby.tab"
            >
              <Radio className="h-3 w-3" />
              On Air
              {onMicUsers.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold">
                  {onMicUsers.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setVoiceTab("online")}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
                voiceTab === "online"
                  ? "border-violet-500 text-violet-700"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              data-ocid="lobby.tab"
            >
              <Users className="h-3 w-3" />
              Listeners
              {onlineVoiceUsers.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 text-[10px] font-bold">
                  {onlineVoiceUsers.length}
                </span>
              )}
            </button>
          </div>
          {/* Pill list */}
          <div
            className="flex items-center gap-2 px-4 py-2 overflow-x-auto"
            style={{ scrollbarWidth: "none" }}
          >
            {tabUsers.length === 0 ? (
              <span className="text-xs text-muted-foreground">
                {voiceTab === "mic"
                  ? "No one on air right now"
                  : "No listeners yet"}
              </span>
            ) : (
              tabUsers.map((p) => (
                <span
                  key={p.username}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
                    voiceTab === "mic"
                      ? "bg-green-100 text-green-700"
                      : "bg-violet-100 text-violet-700"
                  }`}
                >
                  {voiceTab === "mic" && (
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  )}
                  {p.displayName}
                </span>
              ))
            )}
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <aside className="w-64 border-r border-border bg-background flex-shrink-0 hidden md:flex flex-col">
            <div className="p-4 border-b border-border">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                Online Users
              </h3>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-1">
                {onlineUsers.length === 0 ? (
                  <p
                    className="text-muted-foreground text-sm px-2 py-4 text-center"
                    data-ocid="lobby.empty_state"
                  >
                    No users yet
                  </p>
                ) : (
                  onlineUsers.map((user, i) => (
                    <div
                      key={user.principal.toString()}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/50 transition-colors"
                      data-ocid={`lobby.item.${i + 1}`}
                    >
                      <div className="relative">
                        {user.photo ? (
                          <img
                            src={user.photo.getDirectURL()}
                            alt={user.fname}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div
                            className={`w-8 h-8 rounded-full bg-gradient-to-br ${getGradient(user.principal.toString())} flex items-center justify-center text-white text-xs font-bold`}
                          >
                            {(user.fname || user.name)
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                        )}
                        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-white" />
                      </div>
                      <span className="text-sm font-medium truncate">
                        {user.fname || user.name}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* Voice Channel Section */}
              <div className="p-3 border-t border-border mt-2">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                    Voice Channel
                  </h3>
                  {voiceParticipants.length > 0 && (
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse flex-shrink-0" />
                  )}
                </div>
                {voiceParticipants.length === 0 ? (
                  <p className="text-muted-foreground text-xs px-1 py-1">
                    No one in voice
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {voiceParticipants.map((p) => (
                      <div
                        key={p.username}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/40"
                      >
                        <div
                          className={`w-7 h-7 rounded-full bg-gradient-to-br ${getGradient(p.username)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}
                        >
                          {p.displayName.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="text-xs font-medium truncate flex-1">
                          {p.displayName}
                        </span>
                        {p.isMicActive ? (
                          <Mic className="h-3 w-3 text-green-500 flex-shrink-0" />
                        ) : (
                          <MicOff className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </aside>

          <main className="flex-1 flex flex-col overflow-hidden">
            <ScrollArea className="flex-1 p-6">
              <AnimatePresence initial={false}>
                {sortedMessages.length === 0 ? (
                  <div
                    className="flex flex-col items-center justify-center h-64 text-center"
                    data-ocid="lobby.empty_state"
                  >
                    <div className="text-5xl mb-4">💬</div>
                    <h3 className="font-display font-semibold text-xl text-foreground mb-2">
                      Welcome to the Lobby!
                    </h3>
                    <p className="text-muted-foreground">
                      Be the first to say hello to the community
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 max-w-3xl mx-auto">
                    {sortedMessages.map((msg, i) => {
                      const mine = isMyMessage(msg);
                      const name = getMessageAuthorName(msg);
                      const photo = getUserPhoto(msg);
                      return (
                        <motion.div
                          key={msg.id.toString()}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.25 }}
                          className={`flex gap-3 items-end ${mine ? "flex-row-reverse" : ""}`}
                          data-ocid={`lobby.item.${i + 1}`}
                        >
                          <Avatar className="w-8 h-8 flex-shrink-0">
                            {photo && <AvatarImage src={photo} />}
                            <AvatarFallback
                              className={`bg-gradient-to-br ${getGradient(msg.author.toString())} text-white text-xs`}
                            >
                              {name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div
                            className={`max-w-sm lg:max-w-md ${mine ? "items-end" : "items-start"} flex flex-col gap-1`}
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
                              className={`px-4 py-2.5 rounded-2xl text-sm ${mine ? "text-white rounded-br-sm" : "bg-card border border-border text-foreground rounded-bl-sm"}`}
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

            {/* Bottom controls + input, sits ABOVE the bottom nav bar */}
            <div
              className="p-4 border-t border-border bg-white flex-shrink-0"
              style={{
                paddingBottom:
                  "calc(4.5rem + env(safe-area-inset-bottom, 0px))",
              }}
            >
              {/* Message Input */}
              <form
                onSubmit={handleSend}
                className="flex gap-3 max-w-3xl mx-auto mb-2"
              >
                <Input
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Say something to the lobby..."
                  className="flex-1 rounded-full h-11 px-5"
                  data-ocid="lobby.input"
                />
                <Button
                  type="submit"
                  disabled={!messageText.trim() || isSending}
                  className="rounded-full w-11 h-11 p-0 btn-orange flex-shrink-0"
                  data-ocid="lobby.submit_button"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>

              {/* Voice Controls Row */}
              <div className="flex items-center gap-2 max-w-3xl mx-auto mb-2">
                {!isInChannel ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      onClick={handleJoinVoice}
                      className="rounded-full h-9 px-4 gap-2 text-sm font-medium text-white flex-shrink-0"
                      style={{
                        background:
                          micPermission === "denied"
                            ? "linear-gradient(135deg, #9ca3af, #6b7280)"
                            : "linear-gradient(135deg, #7C3AED, #22C7B7)",
                      }}
                      data-ocid="voice.primary_button"
                    >
                      <Radio className="h-4 w-4" />
                      Join Voice
                    </Button>

                    {/* Test Mic Button */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={testMic}
                          disabled={isMicTesting}
                          className={`flex items-center gap-1.5 h-9 px-3 rounded-full text-xs font-medium border transition-all flex-shrink-0 ${
                            isMicTesting
                              ? "bg-amber-50 border-amber-300 text-amber-700 cursor-not-allowed"
                              : "bg-muted/50 border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                          }`}
                          data-ocid="voice.secondary_button"
                        >
                          <Mic className="h-3.5 w-3.5" />
                          {isMicTesting ? "Testing..." : "Test Mic"}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        Test your microphone before joining voice
                      </TooltipContent>
                    </Tooltip>

                    {/* Mic level bar during test */}
                    {isMicTesting && (
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{
                              background:
                                micLevel > 60
                                  ? "#22c55e"
                                  : micLevel > 30
                                    ? "#f59e0b"
                                    : "#7C3AED",
                            }}
                            animate={{ width: `${micLevel}%` }}
                            transition={{ duration: 0.05 }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {micLevel > 10 ? "🎤 Detected!" : "Speak..."}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {/* Mic Toggle */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={toggleMic}
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                              isMicMuted
                                ? "bg-muted text-muted-foreground hover:bg-muted/80"
                                : "bg-green-500 text-white shadow-lg shadow-green-500/30 hover:bg-green-600"
                            } ring-2 ${
                              isMicMuted
                                ? "ring-transparent"
                                : "ring-green-400/50"
                            }`}
                            data-ocid="voice.toggle"
                          >
                            {isMicMuted ? (
                              <MicOff className="h-4 w-4" />
                            ) : (
                              <Mic className="h-4 w-4" />
                            )}
                          </button>
                          {/* Live mic level ring when active */}
                          {!isMicMuted && micLevel > 10 && (
                            <motion.div
                              className="absolute inset-0 rounded-full border-2 border-green-400 pointer-events-none"
                              animate={{ scale: 1 + micLevel / 400 }}
                              transition={{ duration: 0.05 }}
                            />
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {isMicMuted ? "Unmute Mic" : "Mute Mic"}
                      </TooltipContent>
                    </Tooltip>

                    {/* Speaker Toggle */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={toggleSpeaker}
                          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                            isSpeakerMuted
                              ? "bg-muted text-muted-foreground hover:bg-muted/80"
                              : "bg-blue-500 text-white hover:bg-blue-600"
                          }`}
                          data-ocid="voice.secondary_button"
                        >
                          {isSpeakerMuted ? (
                            <VolumeX className="h-4 w-4" />
                          ) : (
                            <Volume2 className="h-4 w-4" />
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {isSpeakerMuted ? "Unmute Speaker" : "Mute Speaker"}
                      </TooltipContent>
                    </Tooltip>

                    {/* Leave Voice */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={leaveChannel}
                      className="rounded-full h-8 px-3 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      data-ocid="voice.cancel_button"
                    >
                      Leave
                    </Button>
                  </div>
                )}

                {isInChannel && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                    {voiceParticipants.length} listening
                  </span>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
      <BottomNav />
    </TooltipProvider>
  );
}
