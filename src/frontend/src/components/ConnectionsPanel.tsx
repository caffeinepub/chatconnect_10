import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChevronLeft,
  ChevronRight,
  PhoneCall,
  UserCircle2,
  Users,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { USERS } from "../data/mockData";

interface ConnectionsPanelProps {
  onVoiceCall: (userId: string) => void;
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

export function ConnectionsPanel({ onVoiceCall }: ConnectionsPanelProps) {
  const [cardIndex, setCardIndex] = useState(0);
  const [direction, setDirection] = useState(1);

  const handlePrev = () => {
    setDirection(-1);
    setCardIndex((i) => (i - 1 + USERS.length) % USERS.length);
  };
  const handleNext = () => {
    setDirection(1);
    setCardIndex((i) => (i + 1) % USERS.length);
  };

  const currentUser = USERS[cardIndex];
  const recommended = USERS.filter((_, i) => i !== cardIndex).slice(0, 4);

  return (
    <aside
      className="flex flex-col h-full rounded-2xl shadow-panel overflow-hidden"
      style={{
        background: "#1A232E",
        border: "1px solid #2A3442",
        width: 300,
        minWidth: 300,
      }}
    >
      {/* Header */}
      <div
        className="px-5 pt-5 pb-4"
        style={{ borderBottom: "1px solid #2A344250" }}
      >
        <p className="text-base font-bold text-white">New Connections</p>
        <p className="text-xs mt-0.5" style={{ color: "#6F7F93" }}>
          Connect with New Users
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-5 py-4">
          {/* Call Card */}
          <div
            className="rounded-2xl p-5 flex flex-col items-center gap-3 relative overflow-hidden"
            style={{ background: "#222C38", border: "1px solid #2A3442" }}
            data-ocid="connections.card"
          >
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={currentUser.id}
                custom={direction}
                initial={{ opacity: 0, x: direction * 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -direction * 40 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="flex flex-col items-center gap-3 w-full"
              >
                {/* Avatar */}
                <div className="relative">
                  <div
                    className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold"
                    style={{
                      background: currentUser.color,
                      boxShadow: `0 0 0 4px ${currentUser.color}33`,
                    }}
                  >
                    {currentUser.initials}
                  </div>
                  <span
                    className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full border-2"
                    style={{
                      background:
                        currentUser.status === "online"
                          ? "#2ECC71"
                          : currentUser.status === "away"
                            ? "#F39C12"
                            : "#6F7F93",
                      borderColor: "#222C38",
                    }}
                  />
                </div>

                {/* Info */}
                <div className="text-center">
                  <p className="text-base font-bold text-white">
                    {currentUser.name}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "#9AA8BA" }}>
                    {currentUser.role}
                  </p>
                  <p className="text-xs" style={{ color: "#6F7F93" }}>
                    {currentUser.handle}
                  </p>
                </div>

                {/* Mutual connections */}
                <div
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full"
                  style={{ background: "#1A232E", border: "1px solid #2A3442" }}
                >
                  <Users className="w-3.5 h-3.5" style={{ color: "#9AA8BA" }} />
                  <span className="text-xs" style={{ color: "#9AA8BA" }}>
                    {currentUser.mutualConnections} mutual connections
                  </span>
                </div>

                {/* Presence */}
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{
                      background:
                        currentUser.status === "online"
                          ? "#2ECC71"
                          : currentUser.status === "away"
                            ? "#F39C12"
                            : "#6F7F93",
                    }}
                  />
                  <span
                    className="text-xs"
                    style={{
                      color:
                        currentUser.status === "online" ? "#2ECC71" : "#9AA8BA",
                    }}
                  >
                    {currentUser.status === "online"
                      ? "Active Now"
                      : currentUser.status === "away"
                        ? "Away"
                        : "Offline"}
                  </span>
                </div>

                {/* Action buttons */}
                <div className="flex flex-col gap-2 w-full mt-1">
                  <button
                    type="button"
                    onClick={() => onVoiceCall(currentUser.id)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ background: "#2F6FE3" }}
                    data-ocid="connections.primary_button"
                  >
                    <PhoneCall className="w-4 h-4" />
                    Request Voice Call
                  </button>
                  <button
                    type="button"
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors hover:bg-white/5"
                    style={{
                      background: "#1E2834",
                      border: "1px solid #2A3442",
                      color: "#9AA8BA",
                    }}
                    data-ocid="connections.secondary_button"
                  >
                    <UserCircle2 className="w-4 h-4" />
                    View Profile
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Pagination controls */}
            <div className="flex items-center gap-3 mt-1">
              <button
                type="button"
                onClick={handlePrev}
                className="w-7 h-7 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
                style={{ background: "#1E2834", border: "1px solid #2A3442" }}
                aria-label="Previous"
                data-ocid="connections.pagination_prev"
              >
                <ChevronLeft
                  className="w-3.5 h-3.5"
                  style={{ color: "#9AA8BA" }}
                />
              </button>
              <div className="flex gap-1.5">
                {USERS.map((u, i) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      setDirection(i > cardIndex ? 1 : -1);
                      setCardIndex(i);
                    }}
                    className="rounded-full transition-all"
                    style={{
                      width: i === cardIndex ? 16 : 6,
                      height: 6,
                      background: i === cardIndex ? "#2F6FE3" : "#2A3442",
                    }}
                    aria-label={`Go to card ${i + 1}`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={handleNext}
                className="w-7 h-7 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
                style={{ background: "#1E2834", border: "1px solid #2A3442" }}
                aria-label="Next"
                data-ocid="connections.pagination_next"
              >
                <ChevronRight
                  className="w-3.5 h-3.5"
                  style={{ color: "#9AA8BA" }}
                />
              </button>
            </div>
          </div>

          {/* Recommended */}
          <div className="mt-5">
            <p
              className="text-xs font-semibold uppercase tracking-wider mb-3"
              style={{ color: "#6F7F93" }}
            >
              Recommended
            </p>
            <div className="flex flex-col gap-0.5">
              {recommended.map((u, i) => (
                <HoverRow key={u.id} ocid={`connections.item.${i + 1}`}>
                  <div className="relative">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ background: u.color }}
                    >
                      {u.initials}
                    </div>
                    <span
                      className="absolute bottom-0 right-0 w-2 h-2 rounded-full border"
                      style={{
                        background:
                          u.status === "online"
                            ? "#2ECC71"
                            : u.status === "away"
                              ? "#F39C12"
                              : "#6F7F93",
                        borderColor: "#1A232E",
                      }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {u.name}
                    </p>
                    <p
                      className="text-xs truncate"
                      style={{ color: "#6F7F93" }}
                    >
                      {u.role}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onVoiceCall(u.id)}
                    className="w-7 h-7 rounded-full flex items-center justify-center transition-colors hover:opacity-80 flex-shrink-0"
                    style={{
                      background: "#2F6FE320",
                      border: "1px solid #2F6FE350",
                    }}
                    aria-label={`Call ${u.name}`}
                    data-ocid={`connections.button.${i + 1}`}
                  >
                    <PhoneCall
                      className="w-3 h-3"
                      style={{ color: "#2F6FE3" }}
                    />
                  </button>
                </HoverRow>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
}
