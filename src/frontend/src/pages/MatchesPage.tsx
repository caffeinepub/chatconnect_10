import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useNavigate } from "@tanstack/react-router";
import { Heart, Loader2, MessageCircle, Phone, User } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type {
  backendInterface as BackendInterface,
  LocalUser,
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
  "from-blue-500 to-violet-600",
  "from-amber-400 to-orange-500",
];

function getGradient(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++)
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

function MatchCard({
  user,
  isOnline,
  onCall,
  onMessage,
  onProfile,
  index,
}: {
  user: LocalUser;
  isOnline: boolean;
  onCall: () => void;
  onMessage: () => void;
  onProfile: () => void;
  index: number;
}) {
  const initials = (user.displayName || user.username)
    .slice(0, 2)
    .toUpperCase();
  const gradient = getGradient(user.username);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3"
      data-ocid={`matches.item.${index + 1}`}
    >
      {/* Avatar + name row */}
      <div className="flex items-center gap-3">
        <div className="relative flex-shrink-0">
          <button
            type="button"
            onClick={onProfile}
            className="block"
            data-ocid="matches.link"
          >
            <div
              className={`w-14 h-14 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold text-lg select-none`}
            >
              {initials}
            </div>
          </button>
          {isOnline && (
            <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-card" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={onProfile}
            className="text-left hover:opacity-80 transition-opacity"
          >
            <p className="font-semibold text-foreground truncate">
              {user.displayName || user.username}
            </p>
            <p className="text-xs text-muted-foreground">@{user.username}</p>
          </button>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isOnline ? (
              <span className="text-green-500 font-medium">● Online</span>
            ) : (
              <span>Offline</span>
            )}
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={onCall}
          className="flex-1 rounded-full bg-green-500 hover:bg-green-600 text-white border-0 text-xs font-semibold"
          data-ocid="matches.primary_button"
        >
          <Phone className="h-3.5 w-3.5 mr-1.5" />
          Call
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onMessage}
          className="flex-1 rounded-full text-xs font-semibold border-border"
          data-ocid="matches.secondary_button"
        >
          <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
          Message
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onProfile}
          className="rounded-full h-8 w-8 p-0 flex-shrink-0"
          data-ocid="matches.link"
        >
          <User className="h-3.5 w-3.5" />
        </Button>
      </div>
    </motion.div>
  );
}

export default function MatchesPage() {
  const navigate = useNavigate();
  const { localSession, isLocalLoggedIn, sessionValidated } = useLocalAuth();
  const { actor, isFetching: actorFetching } = useActor();
  const extActor = actor as unknown as BackendInterface | null;

  const [matches, setMatches] = useState<LocalUser[]>([]);
  const [onlineUsernames, setOnlineUsernames] = useState<Set<string>>(
    new Set(),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [callingUser, setCallingUser] = useState<string | null>(null);

  // Auth guard
  useEffect(() => {
    if (sessionValidated && !isLocalLoggedIn) {
      navigate({ to: "/login" });
    }
  }, [sessionValidated, isLocalLoggedIn, navigate]);

  const fetchMatches = useCallback(async () => {
    if (!isLocalLoggedIn || !localSession || !extActor || actorFetching) return;
    try {
      const users = await extActor.getUsersForMatching(localSession.token);
      setMatches(users);
    } catch {
      // ignore — API may not be available
    } finally {
      setIsLoading(false);
    }
  }, [isLocalLoggedIn, localSession, extActor, actorFetching]);

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
    fetchMatches();
    fetchOnline();
    const matchInterval = setInterval(fetchMatches, 10_000);
    const onlineInterval = setInterval(fetchOnline, 30_000);
    return () => {
      clearInterval(matchInterval);
      clearInterval(onlineInterval);
    };
  }, [fetchMatches, fetchOnline]);

  const handleCall = async (username: string) => {
    if (!localSession || !extActor || callingUser) return;
    setCallingUser(username);
    try {
      await extActor.sendCallRequestAsLocal(localSession.token, username);
      toast.success(`Call request sent to ${username}`);
    } catch {
      toast.error("Failed to send call request");
    } finally {
      setTimeout(() => setCallingUser(null), 2000);
    }
  };

  const handleMessage = (username: string) => {
    navigate({ to: "/messages", search: { user: username } as any });
  };

  const handleProfile = (username: string) => {
    navigate({ to: "/profile", search: { user: username } as any });
  };

  return (
    <div
      className="min-h-screen bg-background flex flex-col"
      style={{ paddingBottom: "calc(56px + env(safe-area-inset-bottom, 0px))" }}
    >
      <GlobalCallWatcher />

      {/* Header */}
      <header className="bg-background border-b border-border px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <div className="w-8 h-8 rounded-lg gradient-hero flex items-center justify-center text-white font-bold text-sm">
          W
        </div>
        <div className="flex items-center gap-2">
          <Heart className="h-5 w-5 text-rose-500" />
          <span className="font-display font-bold text-lg">Find Matches</span>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
        {/* Subtitle */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-6"
        >
          <p className="text-sm text-muted-foreground">
            Discover people online now. Send a call request or message to
            connect.
          </p>
        </motion.div>

        {/* Loading skeleton */}
        {isLoading && (
          <div
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            data-ocid="matches.loading_state"
          >
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3"
              >
                <div className="flex items-center gap-3">
                  <Skeleton className="w-14 h-14 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-8 flex-1 rounded-full" />
                  <Skeleton className="h-8 flex-1 rounded-full" />
                  <Skeleton className="h-8 w-8 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && matches.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 gap-4 text-center"
            data-ocid="matches.empty_state"
          >
            <div className="w-20 h-20 rounded-full bg-rose-500/10 flex items-center justify-center">
              <Heart className="h-10 w-10 text-rose-400" />
            </div>
            <p className="font-semibold text-foreground">
              No matches right now
            </p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Check back in a bit — matches are users who have been active in
              the last 10 minutes.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setIsLoading(true);
                fetchMatches();
              }}
              className="rounded-full mt-2"
              data-ocid="matches.secondary_button"
            >
              Refresh
            </Button>
          </motion.div>
        )}

        {/* Match cards */}
        {!isLoading && matches.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {matches.map((user, idx) => (
              <MatchCard
                key={user.username}
                user={user}
                isOnline={onlineUsernames.has(user.username)}
                onCall={() => handleCall(user.username)}
                onMessage={() => handleMessage(user.username)}
                onProfile={() => handleProfile(user.username)}
                index={idx}
              />
            ))}
          </div>
        )}

        {callingUser && (
          <div
            className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-card border border-border rounded-full px-4 py-2 shadow-lg flex items-center gap-2 text-sm"
            data-ocid="matches.toast"
          >
            <Loader2 className="h-4 w-4 animate-spin text-green-500" />
            Calling {callingUser}...
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
