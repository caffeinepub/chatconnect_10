import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Compass, Hash, MessageCircle, Users } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { CONVERSATIONS, CURRENT_USER, GROUPS, USERS } from "../data/mockData";
import type { Conversation } from "../data/mockData";

interface SidebarProps {
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    online: "#2ECC71",
    away: "#F39C12",
    offline: "#6F7F93",
  };
  return (
    <span
      className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
      style={{ background: colors[status] ?? colors.offline }}
    />
  );
}

function UserAvatar({
  initials,
  color,
  size = 36,
}: { initials: string; color: string; size?: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0"
      style={{
        width: size,
        height: size,
        background: color,
        fontSize: size * 0.36,
      }}
    >
      {initials}
    </div>
  );
}

function HoverRow({
  children,
  ocid,
}: { children: React.ReactNode; ocid: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.div
      whileHover={{ x: 2 }}
      className="flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-colors"
      style={{ background: hovered ? "#222C38" : "transparent" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      data-ocid={ocid}
    >
      {children}
    </motion.div>
  );
}

export function Sidebar({
  activeConversationId,
  onSelectConversation,
}: SidebarProps) {
  return (
    <aside
      className="flex flex-col h-full rounded-2xl shadow-panel overflow-hidden"
      style={{
        background: "#1A232E",
        border: "1px solid #2A3442",
        width: 280,
        minWidth: 280,
      }}
    >
      {/* Brand */}
      <div
        className="px-5 pt-5 pb-4"
        style={{ borderBottom: "1px solid #2A344250" }}
      >
        <div className="flex items-center gap-2 mb-4">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "#2F6FE3" }}
          >
            <MessageCircle className="w-4 h-4 text-white" />
          </div>
          <span className="text-base font-bold text-white tracking-tight">
            ChatConnect
          </span>
        </div>
        {/* Current user tile */}
        <div
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
          style={{ background: "#222C38" }}
        >
          <UserAvatar
            initials={CURRENT_USER.initials}
            color={CURRENT_USER.color}
            size={36}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {CURRENT_USER.name}
            </p>
            <p className="text-xs" style={{ color: "#9AA8BA" }}>
              {CURRENT_USER.handle}
            </p>
          </div>
          <StatusDot status="online" />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-4 pt-4 pb-2">
          {/* Messages section */}
          <SectionLabel
            icon={<MessageCircle className="w-3.5 h-3.5" />}
            label="Messages"
          />
          <div className="flex flex-col gap-0.5 mt-1">
            {CONVERSATIONS.map((conv, i) => {
              const user = USERS.find((u) => u.id === conv.userId)!;
              const isActive = conv.id === activeConversationId;
              return (
                <ConversationRow
                  key={conv.id}
                  conv={conv}
                  userName={user.name}
                  userInitials={user.initials}
                  userColor={user.color}
                  userStatus={user.status}
                  isActive={isActive}
                  onClick={() => onSelectConversation(conv.id)}
                  ocid={`sidebar.item.${i + 1}`}
                />
              );
            })}
          </div>

          {/* Groups section */}
          <SectionLabel
            icon={<Users className="w-3.5 h-3.5" />}
            label="Groups"
            className="mt-5"
          />
          <div className="flex flex-col gap-0.5 mt-1">
            {GROUPS.map((group, i) => (
              <HoverRow key={group.id} ocid={`sidebar.item.${i + 6}`}>
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ background: group.color }}
                >
                  {group.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {group.name}
                  </p>
                  <p className="text-xs truncate" style={{ color: "#9AA8BA" }}>
                    {group.lastMessage}
                  </p>
                </div>
                <span className="text-xs" style={{ color: "#6F7F93" }}>
                  {group.lastTime}
                </span>
              </HoverRow>
            ))}
          </div>

          {/* Discover section */}
          <SectionLabel
            icon={<Compass className="w-3.5 h-3.5" />}
            label="Discover"
            className="mt-5"
          />
          <div className="flex flex-col gap-0.5 mt-1">
            {["#general", "#design-talk", "#dev-ops"].map((channel, i) => (
              <HoverRow key={channel} ocid={`sidebar.item.${i + 9}`}>
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: "#222C38", border: "1px solid #2A3442" }}
                >
                  <Hash className="w-4 h-4" style={{ color: "#6F7F93" }} />
                </div>
                <p className="text-sm font-medium" style={{ color: "#9AA8BA" }}>
                  {channel}
                </p>
              </HoverRow>
            ))}
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
}

function SectionLabel({
  icon,
  label,
  className = "",
}: { icon: React.ReactNode; label: string; className?: string }) {
  return (
    <div className={`flex items-center gap-1.5 px-2 ${className}`}>
      <span style={{ color: "#6F7F93" }}>{icon}</span>
      <span
        className="text-xs font-semibold uppercase tracking-wider"
        style={{ color: "#6F7F93" }}
      >
        {label}
      </span>
    </div>
  );
}

function ConversationRow({
  conv,
  userName,
  userInitials,
  userColor,
  userStatus,
  isActive,
  onClick,
  ocid,
}: {
  conv: Conversation;
  userName: string;
  userInitials: string;
  userColor: string;
  userStatus: string;
  isActive: boolean;
  onClick: () => void;
  ocid: string;
}) {
  return (
    <motion.button
      type="button"
      whileHover={{ x: isActive ? 0 : 2 }}
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors"
      style={{ background: isActive ? "#222C38" : "transparent" }}
      data-ocid={ocid}
    >
      <div className="relative">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
          style={{ background: userColor }}
        >
          {userInitials}
        </div>
        <span
          className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2"
          style={{
            background:
              userStatus === "online"
                ? "#2ECC71"
                : userStatus === "away"
                  ? "#F39C12"
                  : "#6F7F93",
            borderColor: "#1A232E",
          }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-semibold truncate"
          style={{ color: isActive ? "#E7EEF7" : "#C4CFD9" }}
        >
          {userName}
        </p>
        <p className="text-xs truncate" style={{ color: "#6F7F93" }}>
          {conv.lastMessage}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="text-xs" style={{ color: "#6F7F93" }}>
          {conv.lastTime}
        </span>
        {conv.unread > 0 && (
          <Badge
            className="text-white text-[10px] px-1.5 py-0 h-4 rounded-full"
            style={{ background: "#2F6FE3", minWidth: 16 }}
          >
            {conv.unread}
          </Badge>
        )}
      </div>
    </motion.button>
  );
}
