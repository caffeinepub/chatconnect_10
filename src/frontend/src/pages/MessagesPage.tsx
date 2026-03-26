import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Home,
  Loader2,
  Mail,
  MessageCircle,
  Newspaper,
  Send,
  UserCircle,
  Users,
} from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ConversationSummary,
  DirectMessage,
  backendInterface as ExtendedBackend,
} from "../backend.d";
import { GlobalCallWatcher } from "../components/GlobalCallWatcher";
import { MessagesButton } from "../components/MessagesButton";
import { NotificationBell } from "../components/NotificationBell";
import { useActor } from "../hooks/useActor";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
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

export default function MessagesPage() {
  const navigate = useNavigate();
  const { identity } = useInternetIdentity();
  const { localSession, isLocalLoggedIn, logoutLocal } = useLocalAuth();
  const { actor } = useActor();
  const extActor = actor as unknown as ExtendedBackend | null;

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoadingConvos, setIsLoadingConvos] = useState(true);
  const [isMobileThread, setIsMobileThread] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auth guard
  useEffect(() => {
    if (!identity && !isLocalLoggedIn) {
      navigate({ to: "/login" });
    }
  }, [identity, isLocalLoggedIn, navigate]);

  // Check URL param for pre-selected user
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const user = params.get("user");
    if (user) {
      setSelectedUser(user);
      setIsMobileThread(true);
    }
  }, []);

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    if (!isLocalLoggedIn || !localSession || !extActor) return;
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
  }, [isLocalLoggedIn, localSession, extActor]);

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 5_000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  // Fetch messages for selected conversation
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
    const interval = setInterval(fetchMessages, 2_000);
    return () => clearInterval(interval);
  }, [selectedUser, fetchMessages]);

  // Mark as read when opening conversation
  useEffect(() => {
    if (!selectedUser || !isLocalLoggedIn || !localSession || !extActor) return;
    extActor
      .markDirectMessagesRead(localSession.token, selectedUser)
      .catch(() => {});
  }, [selectedUser, isLocalLoggedIn, localSession, extActor]);

  const handleSelectUser = (username: string) => {
    setSelectedUser(username);
    setIsMobileThread(true);
    setMessages([]);
  };

  const handleSend = async () => {
    if (!messageText.trim() || !selectedUser || !localSession || !extActor)
      return;
    const text = messageText.trim();
    setMessageText("");
    // Optimistic update
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
      fetchMessages();
      fetchConversations();
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setMessageText(text);
    } finally {
      setIsSending(false);
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <GlobalCallWatcher />

      {/* Header */}
      <header className="bg-white border-b border-border px-4 py-3 flex items-center justify-between flex-shrink-0 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg gradient-hero flex items-center justify-center text-white font-bold text-sm">
            W
          </div>
          <span className="font-display font-bold text-lg">WaveChat</span>
        </div>
        <nav className="flex items-center gap-2">
          <Link to="/lobby">
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full gap-2"
              data-ocid="nav.lobby_link"
            >
              <MessageCircle className="h-4 w-4" />
              <span className="hidden md:block">Lobby</span>
            </Button>
          </Link>
          <Link to="/cards">
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full gap-2"
              data-ocid="nav.cards_link"
            >
              <Users className="h-4 w-4" />
              <span className="hidden md:block">Calling Cards</span>
            </Button>
          </Link>
          <Link to="/feed">
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full gap-2"
              data-ocid="nav.feed_link"
            >
              <Newspaper className="h-4 w-4" />
              <span className="hidden md:block">Feed</span>
            </Button>
          </Link>
          <Link to="/cards">
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full gap-2"
              data-ocid="nav.home_link"
            >
              <Home className="h-4 w-4" />
              <span className="hidden md:block">Home</span>
            </Button>
          </Link>
          <NotificationBell />
          <MessagesButton />
          <Link to="/profile">
            <Button
              size="sm"
              className="rounded-full gap-2 bg-gradient-to-r from-purple-500 to-teal-500 text-white hover:opacity-90 border-0"
              data-ocid="nav.profile_link"
            >
              <UserCircle className="h-4 w-4" />
              <span className="hidden md:block">My Profile</span>
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="rounded-full gap-2"
            data-ocid="messages.close_button"
          >
            <span className="hidden md:block">Logout</span>
          </Button>
        </nav>
      </header>

      {/* Main two-panel layout */}
      <main className="flex flex-1 max-w-6xl mx-auto w-full px-4 py-6 gap-4">
        {/* Conversation List */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className={`${
            isMobileThread ? "hidden md:flex" : "flex"
          } flex-col w-full md:w-80 flex-shrink-0 bg-white rounded-2xl border border-border shadow-sm overflow-hidden`}
          data-ocid="messages.panel"
        >
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            <h2 className="font-display font-semibold text-base">Messages</h2>
          </div>

          <ScrollArea className="flex-1">
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
                  <Mail className="h-8 w-8 text-primary/50" />
                </div>
                <p className="text-sm text-muted-foreground">
                  No conversations yet. Message someone from their Calling Card.
                </p>
              </div>
            ) : (
              conversations.map((convo, idx) => (
                <button
                  key={convo.otherUsername}
                  type="button"
                  onClick={() => handleSelectUser(convo.otherUsername)}
                  className={`w-full flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors text-left ${
                    selectedUser === convo.otherUsername ? "bg-primary/5" : ""
                  }`}
                  data-ocid={`messages.item.${idx + 1}`}
                >
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    <AvatarFallback
                      className={`bg-gradient-to-br ${getGradient(convo.otherUsername)} text-white text-sm font-semibold`}
                    >
                      {(convo.otherDisplayName || convo.otherUsername)
                        .slice(0, 2)
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm truncate">
                        {convo.otherDisplayName || convo.otherUsername}
                      </span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {relativeTime(convo.lastTimestamp)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {convo.lastMessage}
                    </p>
                  </div>
                  {Number(convo.unreadCount) > 0 && (
                    <span className="flex-shrink-0 h-5 w-5 rounded-full bg-primary text-white text-[10px] font-semibold flex items-center justify-center">
                      {Number(convo.unreadCount) > 9
                        ? "9+"
                        : Number(convo.unreadCount)}
                    </span>
                  )}
                </button>
              ))
            )}
          </ScrollArea>
        </motion.div>

        {/* Chat Thread */}
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className={`${
            !isMobileThread && !selectedUser ? "hidden md:flex" : "flex"
          } flex-col flex-1 bg-white rounded-2xl border border-border shadow-sm overflow-hidden`}
          data-ocid="messages.card"
        >
          {!selectedUser ? (
            <div className="flex-1 flex flex-col items-center justify-center py-16 gap-3 text-center px-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500/20 to-teal-500/20 flex items-center justify-center">
                <Mail className="h-10 w-10 text-primary/40" />
              </div>
              <p className="text-muted-foreground">
                Select a conversation to start chatting
              </p>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="px-4 py-3 border-b border-border flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="md:hidden rounded-full h-8 w-8 p-0"
                  onClick={() => setIsMobileThread(false)}
                  data-ocid="messages.cancel_button"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Avatar className="h-8 w-8">
                  <AvatarFallback
                    className={`bg-gradient-to-br ${getGradient(selectedUser)} text-white text-xs font-semibold`}
                  >
                    {selectedDisplayName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-sm">{selectedDisplayName}</p>
                  <p className="text-xs text-muted-foreground">
                    @{selectedUser}
                  </p>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 px-4 py-4">
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
                      return (
                        <motion.div
                          key={msg.id.toString()}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, delay: idx < 5 ? 0 : 0 }}
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
                            <p className="text-sm leading-relaxed">
                              {msg.text}
                            </p>
                            <p
                              className={`text-[10px] mt-1 ${
                                isMe ? "text-white/60" : "text-muted-foreground"
                              }`}
                            >
                              {relativeTime(msg.timestamp)}
                            </p>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Send input */}
              <div className="px-4 py-3 border-t border-border flex items-center gap-2">
                <Input
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
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
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-3 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()}. Built with love using{" "}
        <a
          href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
          className="underline hover:text-foreground"
          target="_blank"
          rel="noreferrer"
        >
          caffeine.ai
        </a>
      </footer>
    </div>
  );
}
