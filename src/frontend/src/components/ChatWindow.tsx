import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Mic,
  MoreVertical,
  Paperclip,
  Phone,
  Search,
  Send,
  Smile,
  Video,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { CONVERSATIONS, type Message, USERS } from "../data/mockData";

interface ChatWindowProps {
  conversationId: string | null;
  onVoiceCall: (userId: string) => void;
}

export function ChatWindow({ conversationId, onVoiceCall }: ChatWindowProps) {
  const [conversations, setConversations] = useState(CONVERSATIONS);
  const [inputText, setInputText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const conv = conversations.find((c) => c.id === conversationId);
  const user = conv ? USERS.find((u) => u.id === conv.userId) : null;

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conv?.messages.length]);

  const handleSend = () => {
    const text = inputText.trim();
    if (!text || !conv) return;
    const newMsg: Message = {
      id: `m${Date.now()}`,
      senderId: "me",
      text,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      read: true,
    };
    setConversations((prev) =>
      prev.map((c) =>
        c.id === conv.id
          ? {
              ...c,
              messages: [...c.messages, newMsg],
              lastMessage: text,
              lastTime: "now",
            }
          : c,
      ),
    );
    setInputText("");
  };

  if (!conv || !user) {
    return (
      <div
        className="flex-1 flex flex-col items-center justify-center rounded-2xl shadow-panel"
        style={{ background: "#1A232E", border: "1px solid #2A3442" }}
        data-ocid="chat.empty_state"
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
          style={{ background: "#222C38" }}
        >
          <Send className="w-7 h-7" style={{ color: "#2F6FE3" }} />
        </div>
        <p className="text-base font-semibold" style={{ color: "#E7EEF7" }}>
          Select a conversation
        </p>
        <p className="text-sm mt-1" style={{ color: "#6F7F93" }}>
          Choose someone to start chatting
        </p>
      </div>
    );
  }

  return (
    <div
      className="flex-1 flex flex-col rounded-2xl shadow-panel overflow-hidden"
      style={{ background: "#1A232E", border: "1px solid #2A3442" }}
    >
      {/* Chat header */}
      <header
        className="flex items-center gap-3 px-5 py-4 flex-shrink-0"
        style={{ borderBottom: "1px solid #2A344250" }}
      >
        <div className="relative">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold"
            style={{ background: user.color }}
          >
            {user.initials}
          </div>
          <span
            className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2"
            style={{
              background:
                user.status === "online"
                  ? "#2ECC71"
                  : user.status === "away"
                    ? "#F39C12"
                    : "#6F7F93",
              borderColor: "#1A232E",
            }}
          />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">{user.name}</p>
          <p
            className="text-xs"
            style={{ color: user.status === "online" ? "#2ECC71" : "#9AA8BA" }}
          >
            {user.status === "online"
              ? "Active now"
              : user.status === "away"
                ? "Away"
                : "Offline"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <IconButton
            icon={<Phone className="w-4 h-4" />}
            onClick={() => onVoiceCall(user.id)}
            label="Voice call"
            ocid="chat.primary_button"
          />
          <IconButton
            icon={<Video className="w-4 h-4" />}
            label="Video call"
            ocid="chat.secondary_button"
          />
          <IconButton
            icon={<Search className="w-4 h-4" />}
            label="Search"
            ocid="chat.search_input"
          />
          <IconButton
            icon={<MoreVertical className="w-4 h-4" />}
            label="More"
            ocid="chat.toggle"
          />
        </div>
      </header>

      {/* Messages */}
      <ScrollArea className="flex-1 px-5 py-4">
        <div className="flex flex-col gap-3">
          <DateSeparator label="Today" />
          <AnimatePresence initial={false}>
            {conv.messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
          </AnimatePresence>
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Composer */}
      <div
        className="px-5 py-4 flex-shrink-0"
        style={{ borderTop: "1px solid #2A344250" }}
      >
        <div
          className="flex items-center gap-3 px-4 py-2.5 rounded-full"
          style={{ background: "#222C38", border: "1px solid #2A3442" }}
        >
          <button
            type="button"
            className="flex-shrink-0 transition-opacity hover:opacity-70"
            aria-label="Attach file"
            data-ocid="chat.upload_button"
          >
            <Paperclip className="w-4 h-4" style={{ color: "#6F7F93" }} />
          </button>
          <button
            type="button"
            className="flex-shrink-0 transition-opacity hover:opacity-70"
            aria-label="Emoji"
          >
            <Smile className="w-4 h-4" style={{ color: "#6F7F93" }} />
          </button>
          <input
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: "#E7EEF7" }}
            placeholder="Type message…"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            data-ocid="chat.input"
          />
          <button
            type="button"
            className="flex-shrink-0 transition-opacity hover:opacity-70"
            aria-label="Voice"
          >
            <Mic className="w-4 h-4" style={{ color: "#6F7F93" }} />
          </button>
          <button
            type="button"
            onClick={handleSend}
            className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110 disabled:opacity-40"
            style={{ background: inputText.trim() ? "#2F6FE3" : "#2A3442" }}
            disabled={!inputText.trim()}
            aria-label="Send message"
            data-ocid="chat.submit_button"
          >
            <Send className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isMe = message.senderId === "me";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.18 }}
      className={`flex ${isMe ? "justify-end" : "justify-start"}`}
    >
      <div
        className="max-w-[65%] px-4 py-2.5 rounded-2xl"
        style={{
          background: isMe ? "#2A3440" : "#2E67D3",
          borderBottomRightRadius: isMe ? 4 : undefined,
          borderBottomLeftRadius: !isMe ? 4 : undefined,
        }}
      >
        <p className="text-sm leading-relaxed" style={{ color: "#E7EEF7" }}>
          {message.text}
        </p>
        <p
          className="text-[11px] mt-1"
          style={{ color: isMe ? "#6F7F93" : "#b0c8f0" }}
        >
          {message.timestamp}
        </p>
      </div>
    </motion.div>
  );
}

function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-2">
      <div className="flex-1 h-px" style={{ background: "#2A344250" }} />
      <span className="text-xs font-medium px-2" style={{ color: "#6F7F93" }}>
        {label}
      </span>
      <div className="flex-1 h-px" style={{ background: "#2A344250" }} />
    </div>
  );
}

function IconButton({
  icon,
  onClick,
  label,
  ocid,
}: {
  icon: React.ReactNode;
  onClick?: () => void;
  label: string;
  ocid?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10"
      style={{ background: "#1E2834", border: "1px solid #2A3442" }}
      aria-label={label}
      data-ocid={ocid}
    >
      <span style={{ color: "#9AA8BA" }}>{icon}</span>
    </button>
  );
}
