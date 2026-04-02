import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Principal } from "@icp-sdk/core/principal";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  Crown,
  Loader2,
  LogOut,
  MessageCircle,
  Phone,
  PhoneCall,
  PhoneMissed,
  Search,
  ShieldOff,
  UserCheck,
  UserPlus,
  UserX,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type {
  backendInterface as ExtendedBackend,
  LocalUser,
  User,
} from "../backend.d";
import { BottomNav } from "../components/BottomNav";
import { GlobalCallWatcher } from "../components/GlobalCallWatcher";
import { useActor } from "../hooks/useActor";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import { useLocalAuth } from "../hooks/useLocalAuth";
import {
  useAcceptCallRequestAsLocal,
  useDenyCallRequestAsLocal,
  useGetCallRequestsAsLocal,
  useGetCallerUserProfile,
  useGetUsers,
  useSendCallRequest,
  useSendCallRequestAsLocal,
} from "../hooks/useQueries";
import { playFollowSound } from "../utils/sounds";

const AVATAR_GRADIENTS = [
  "from-purple-500 to-indigo-600",
  "from-teal-400 to-cyan-500",
  "from-orange-400 to-pink-500",
  "from-emerald-400 to-teal-500",
  "from-rose-400 to-purple-500",
];

const LANGUAGE_FILTERS = ["All", "English", "Hindi", "Bengali", "Punjabi"];

function getGradient(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++)
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

function CallingCard({
  user,
  index,
  myPrincipal,
}: { user: User; index: number; myPrincipal: Principal | undefined }) {
  const sendCallRequest = useSendCallRequest();
  const navigate = useNavigate();
  const isMe =
    myPrincipal && user.principal.toString() === myPrincipal.toString();

  const handleCall = async () => {
    try {
      await sendCallRequest.mutateAsync(user.principal);
      toast.success(`Call request sent to ${user.fname || user.name}! 📞`);
    } catch {
      toast.error("Failed to send call request");
    }
  };

  const name = user.fname || user.name || "Unknown";
  const age = user.telephone || "?";
  const gradient = getGradient(user.principal.toString());

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="gradient-card rounded-3xl p-6 text-white border border-white/10 shadow-hero hover:scale-[1.02] transition-transform"
      data-ocid={`cards.item.${index + 1}`}
    >
      <div className="flex flex-col items-center text-center">
        <div className="relative mb-4">
          {user.photo ? (
            <img
              src={user.photo.getDirectURL()}
              alt={name}
              className="w-20 h-20 rounded-full object-cover border-4 border-white/20"
            />
          ) : (
            <div
              className={`w-20 h-20 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-2xl font-bold`}
            >
              {name.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>

        <h3 className="font-display font-semibold text-lg mb-1">{name}</h3>
        <p className="text-white/60 text-sm mb-1">Age {age}</p>
        {isMe ? (
          <span className="text-xs bg-primary/40 text-white px-3 py-0.5 rounded-full mb-3">
            You
          </span>
        ) : (
          <div className="mb-3" />
        )}

        <div className="w-full flex flex-col gap-2">
          <button
            type="button"
            onClick={() =>
              navigate({
                to: "/profile",
                search: { user: user.fname || user.name || "" } as any,
              })
            }
            className="w-full py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            data-ocid={`cards.secondary_button.${index + 1}`}
          >
            View Profile
          </button>
          <button
            type="button"
            onClick={() =>
              navigate({
                to: "/messages",
                search: { user: user.fname || user.name || "" } as any,
              })
            }
            className="w-full py-2 rounded-full bg-primary/80 text-white text-sm font-semibold hover:bg-primary transition-colors flex items-center justify-center gap-2"
            data-ocid={`cards.secondary_button.${index + 1}`}
          >
            <MessageCircle className="h-4 w-4" /> Message
          </button>
          <button
            type="button"
            onClick={handleCall}
            disabled={sendCallRequest.isPending || !!isMe}
            className="w-full py-2 rounded-full text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: "oklch(0.72 0.19 50)" }}
            data-ocid={`cards.primary_button.${index + 1}`}
          >
            {sendCallRequest.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Phone className="h-4 w-4" />
            )}
            {isMe ? "That's You" : "Request Call"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function LocalCallingCard({
  user,
  index,
  myUsername,
  hasPendingOutgoing,
  onCall,
  isCalling,
  extActor,
  token,
  isOnline,
}: {
  user: LocalUser;
  index: number;
  myUsername: string;
  hasPendingOutgoing: boolean;
  onCall: () => void;
  isCalling: boolean;
  extActor: ExtendedBackend | null;
  token: bigint | undefined;
  isOnline: boolean;
}) {
  const navigate = useNavigate();
  const isMe = user.username === myUsername;
  const gradient = getGradient(user.username);

  const [isFollowing, setIsFollowing] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [loadingFollow, setLoadingFollow] = useState(false);
  const [loadingBlock, setLoadingBlock] = useState(false);
  const [followersCount, setFollowersCount] = useState<number | null>(null);
  const [followingCount, setFollowingCount] = useState<number | null>(null);
  const [userBio, setUserBio] = useState<string>("");
  const [isVerified, setIsVerified] = useState(false);
  const [userStatus, setUserStatus] = useState<string>("");
  const [callTopic, setCallTopic] = useState<string>("");
  const [editTopicOpen, setEditTopicOpen] = useState(false);
  const [topicInput, setTopicInput] = useState("");
  const [savingTopic, setSavingTopic] = useState(false);
  const isWildfireAdmin = user.username.toUpperCase() === "WILDFIRE";

  // Load initial follow/block state and follower counts
  useEffect(() => {
    if (!extActor || !token || isMe) return;
    Promise.all([
      extActor.isFollowing(token, user.username).catch(() => false),
      extActor.isBlocked(token, user.username).catch(() => false),
      extActor.getPublicProfileSettings(user.username).catch(() => null),
    ]).then(async ([following, blocked, settings]) => {
      setIsFollowing(following);
      setIsBlocked(blocked);
      if (settings) {
        const [f1, f2] = await Promise.all([
          settings.hideFollowers
            ? Promise.resolve(null)
            : extActor.getFollowers(token, user.username).catch(() => null),
          settings.hideFollowing
            ? Promise.resolve(null)
            : extActor.getFollowing(token, user.username).catch(() => null),
        ]);
        if (f1 !== null) setFollowersCount(f1.length);
        if (f2 !== null) setFollowingCount(f2.length);
      }
    });
  }, [extActor, token, user.username, isMe]);

  // Load bio + verified status + custom status + call topic (batched)
  useEffect(() => {
    if (!extActor || !user.username) return;
    let cancelled = false;
    Promise.all([
      extActor.getUserBio(user.username).catch(() => null),
      extActor.isUserVerified(user.username).catch(() => false),
      extActor.getUserStatus(user.username).catch(() => null),
      extActor.getCallTopic(user.username).catch(() => null),
    ]).then(([bio, verified, status, topic]) => {
      if (cancelled) return;
      setUserBio(bio ? String(bio) : "");
      setIsVerified(Boolean(verified));
      setUserStatus(status ? String(status) : "");
      setCallTopic(topic ? String(topic) : "");
    });
    return () => {
      cancelled = true;
    };
  }, [extActor, user.username]);

  // Record profile visit (fire-and-forget)
  useEffect(() => {
    if (!extActor || !token || isMe) return;
    extActor.recordProfileVisit(token, user.username).catch(() => {});
  }, [extActor, token, user.username, isMe]);

  const handleFollow = async () => {
    if (!extActor || !token) return;
    setLoadingFollow(true);
    try {
      if (isFollowing) {
        await extActor.unfollowUser(token, user.username);
        setIsFollowing(false);
        toast.success(`Unfollowed ${user.displayName}`);
      } else {
        await extActor.followUser(token, user.username);
        setIsFollowing(true);
        playFollowSound();
        toast.success(`Following ${user.displayName}!`);
      }
    } catch {
      toast.error("Action failed");
    } finally {
      setLoadingFollow(false);
    }
  };

  const handleBlock = async () => {
    if (!extActor || !token) return;
    setLoadingBlock(true);
    try {
      if (isBlocked) {
        await extActor.unblockUser(token, user.username);
        setIsBlocked(false);
        toast.success(`Unblocked ${user.displayName}`);
      } else {
        await extActor.blockUser(token, user.username);
        setIsBlocked(true);
        toast.success(`Blocked ${user.displayName}`);
      }
    } catch {
      toast.error("Action failed");
    } finally {
      setLoadingBlock(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="gradient-card rounded-3xl p-6 text-white border border-white/10 shadow-hero hover:scale-[1.02] transition-transform"
      data-ocid={`cards.item.${index + 1}`}
    >
      <div className="flex flex-col items-center text-center">
        <div className="relative mb-4">
          <button
            type="button"
            onClick={() =>
              navigate({
                to: "/profile",
                search: { user: user.username } as any,
              })
            }
            className="focus:outline-none"
          >
            {user.photo ? (
              <img
                src={user.photo.getDirectURL()}
                alt={user.displayName}
                className="w-20 h-20 rounded-full object-cover border-4 border-white/20 hover:opacity-90 transition-opacity"
              />
            ) : (
              <div
                className={`w-20 h-20 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-2xl font-bold hover:opacity-90 transition-opacity`}
              >
                {user.displayName.slice(0, 2).toUpperCase()}
              </div>
            )}
          </button>
          {isOnline && (
            <span className="absolute bottom-1 right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-[#0B102A]" />
          )}
        </div>

        <div className="flex items-center gap-1.5 justify-center mb-1">
          <button
            type="button"
            onClick={() =>
              navigate({
                to: "/profile",
                search: { user: user.username } as any,
              })
            }
            className="font-display font-semibold text-lg hover:underline focus:outline-none"
          >
            {user.displayName}
          </button>
          {isVerified && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 flex-shrink-0 shadow-sm shadow-blue-500/50">
              <svg
                role="img"
                aria-label="verified"
                viewBox="0 0 12 12"
                className="w-3 h-3"
              >
                <polyline
                  points="2,6 5,9 10,3"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          )}
          {isWildfireAdmin && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-bold border border-amber-400/30">
              <Crown className="h-2.5 w-2.5" />
              Admin
            </span>
          )}
        </div>
        <p className="text-white/60 text-sm mb-1">Age {user.age.toString()}</p>
        <p className="text-white/40 text-xs mb-2">@{user.username}</p>
        {userStatus && userStatus !== "" && (
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                userStatus === "Available for calls"
                  ? "bg-green-400"
                  : userStatus === "Busy"
                    ? "bg-red-400"
                    : userStatus === "Away"
                      ? "bg-yellow-400"
                      : userStatus === "Do Not Disturb"
                        ? "bg-gray-400"
                        : "bg-gray-400"
              }`}
            />
            <span className="text-white/50 text-xs">{userStatus}</span>
          </div>
        )}
        {userBio && (
          <p className="text-white/60 text-xs mb-2 leading-relaxed line-clamp-2">
            {userBio}
          </p>
        )}
        {callTopic && (
          <div className="flex items-center gap-1.5 mb-2 bg-white/10 rounded-full px-3 py-1">
            <span className="text-xs">&#x1F4AC;</span>
            <span className="text-white/80 text-xs italic leading-snug line-clamp-1">
              {callTopic}
            </span>
          </div>
        )}
        {isMe && (
          <button
            type="button"
            onClick={() => {
              setTopicInput(callTopic);
              setEditTopicOpen(true);
            }}
            className="text-xs text-white/50 hover:text-white/80 underline mb-2 transition-colors"
            data-ocid={`cards.edit_button.${index + 1}`}
          >
            {callTopic ? "Edit Topic" : "+ Add Call Topic"}
          </button>
        )}

        {/* Followers / Following counts */}
        {!isMe && (followersCount !== null || followingCount !== null) && (
          <div className="flex items-center gap-3 mb-3 text-xs text-white/60">
            {followersCount !== null && (
              <span>
                <span className="font-semibold text-white">
                  {followersCount}
                </span>{" "}
                followers
              </span>
            )}
            {followersCount !== null && followingCount !== null && (
              <span className="text-white/30">•</span>
            )}
            {followingCount !== null && (
              <span>
                <span className="font-semibold text-white">
                  {followingCount}
                </span>{" "}
                following
              </span>
            )}
          </div>
        )}

        {!isMe && <div className="mb-2" />}
        {isMe && (
          <span className="text-xs bg-primary/40 text-white px-3 py-0.5 rounded-full mb-3">
            You
          </span>
        )}

        <div className="w-full flex flex-col gap-2">
          {/* Follow / Block row for non-self */}
          {!isMe && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleFollow}
                disabled={loadingFollow}
                className={`flex-1 py-2 rounded-full text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  isFollowing
                    ? "bg-white/20 hover:bg-white/30 text-white"
                    : "bg-indigo-500/80 hover:bg-indigo-500 text-white"
                } disabled:opacity-50`}
                data-ocid={`cards.toggle.${index + 1}`}
              >
                {loadingFollow ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : isFollowing ? (
                  <UserCheck className="h-3 w-3" />
                ) : (
                  <UserPlus className="h-3 w-3" />
                )}
                {isFollowing ? "Following" : "Follow"}
              </button>
              <button
                type="button"
                onClick={handleBlock}
                disabled={loadingBlock}
                className={`px-3 py-2 rounded-full text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  isBlocked
                    ? "bg-red-500/60 hover:bg-red-500/80 text-white"
                    : "bg-white/10 hover:bg-white/20 text-white/70 hover:text-white"
                } disabled:opacity-50`}
                data-ocid={`cards.delete_button.${index + 1}`}
              >
                {loadingBlock ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : isBlocked ? (
                  <ShieldOff className="h-3 w-3" />
                ) : (
                  <UserX className="h-3 w-3" />
                )}
                {isBlocked ? "Unblock" : "Block"}
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() =>
              navigate({
                to: "/messages",
                search: { user: user.username } as any,
              })
            }
            className="w-full py-2 rounded-full bg-primary/80 text-white text-sm font-semibold hover:bg-primary transition-colors flex items-center justify-center gap-2"
            data-ocid={`cards.secondary_button.${index + 1}`}
          >
            <MessageCircle className="h-4 w-4" /> Message
          </button>
          <button
            type="button"
            onClick={onCall}
            disabled={isCalling || !!isMe}
            className={`w-full py-2 rounded-full text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 ${
              hasPendingOutgoing ? "animate-pulse" : "hover:opacity-90"
            }`}
            style={{
              backgroundColor: hasPendingOutgoing
                ? "oklch(0.72 0.19 50)"
                : "oklch(0.72 0.19 50)",
              boxShadow: hasPendingOutgoing
                ? "0 0 16px 4px oklch(0.72 0.19 50 / 0.6)"
                : undefined,
            }}
            data-ocid={`cards.primary_button.${index + 1}`}
          >
            {isCalling ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : hasPendingOutgoing ? (
              <PhoneCall className="h-4 w-4 animate-bounce" />
            ) : (
              <Phone className="h-4 w-4" />
            )}
            {isMe
              ? "That's You"
              : hasPendingOutgoing
                ? "Calling..."
                : "Request Call"}
          </button>
        </div>
      </div>
      {isMe && (
        <Dialog open={editTopicOpen} onOpenChange={setEditTopicOpen}>
          <DialogContent data-ocid="cards.dialog">
            <DialogHeader>
              <DialogTitle>Edit Call Topic</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="flex flex-wrap gap-2">
                {[
                  "What's on your mind?",
                  "Share a childhood memory",
                  "Sing a song for me",
                  "How's life?",
                  "Tell me something fun",
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setTopicInput(preset)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${topicInput === preset ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                    data-ocid="cards.toggle"
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <Input
                placeholder="Or type a custom topic..."
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                className="rounded-xl"
                data-ocid="cards.input"
              />
            </div>
            <div className="flex justify-between pt-2">
              {callTopic && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={async () => {
                    if (!extActor || !token) return;
                    setSavingTopic(true);
                    try {
                      await extActor.clearCallTopic(token);
                      setCallTopic("");
                      setEditTopicOpen(false);
                    } catch {}
                    setSavingTopic(false);
                  }}
                  data-ocid="cards.delete_button"
                >
                  Clear
                </Button>
              )}
              <div className="flex gap-2 ml-auto">
                <Button
                  variant="ghost"
                  onClick={() => setEditTopicOpen(false)}
                  data-ocid="cards.cancel_button"
                >
                  Cancel
                </Button>
                <Button
                  disabled={!topicInput.trim() || savingTopic}
                  onClick={async () => {
                    if (!extActor || !token || !topicInput.trim()) return;
                    setSavingTopic(true);
                    try {
                      await extActor.setCallTopic(token, topicInput.trim());
                      setCallTopic(topicInput.trim());
                      setEditTopicOpen(false);
                    } catch {}
                    setSavingTopic(false);
                  }}
                  data-ocid="cards.save_button"
                >
                  Save
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </motion.div>
  );
}

export default function CallingCardsPage() {
  const navigate = useNavigate();
  const { identity } = useInternetIdentity();
  const { isLocalLoggedIn, localSession, logoutLocal, sessionValidated } =
    useLocalAuth();
  const { actor, isFetching: actorFetching } = useActor();
  const extActor = actor as unknown as ExtendedBackend | null;
  const carouselRef = useRef<HTMLDivElement>(null);
  const { data: myProfile, isLoading: profileLoading } =
    useGetCallerUserProfile();
  const { data: users = [], isLoading: usersLoading } = useGetUsers();

  const { data: localUsers = [], isLoading: localUsersLoading } = useQuery<
    LocalUser[]
  >({
    queryKey: ["localUsers"],
    queryFn: async () => {
      if (!extActor) return [];
      return extActor.getLocalUsers();
    },
    enabled: !!extActor && !actorFetching,
    refetchInterval: 10000,
  });

  const { data: onlineUsernames = [] } = useQuery<string[]>({
    queryKey: ["onlineUsernames"],
    queryFn: async () => {
      if (!extActor) return [];
      return extActor.getOnlineUsernames();
    },
    enabled: !!extActor && !actorFetching,
    refetchInterval: 15000,
  });

  const { data: callRequests = [] } = useGetCallRequestsAsLocal(
    localSession?.token,
  );

  const acceptCall = useAcceptCallRequestAsLocal();
  const denyCall = useDenyCallRequestAsLocal();
  const sendCallRequestAsLocal = useSendCallRequestAsLocal();

  // Search + language filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("All");

  // Incoming pending requests (someone calling me)
  const incomingRequests = callRequests.filter(
    (cr) =>
      cr.calleeUsername === localSession?.username && cr.status === "pending",
  );

  // Auto-navigate if an outgoing request was accepted
  useEffect(() => {
    const accepted = callRequests.find(
      (cr) =>
        cr.callerUsername === localSession?.username &&
        cr.status === "accepted",
    );
    if (accepted) {
      navigate({ to: `/call/${accepted.id.toString()}` });
    }
  }, [callRequests, localSession, navigate]);

  useEffect(() => {
    if (sessionValidated && !identity && !isLocalLoggedIn && !profileLoading) {
      navigate({ to: "/login" });
    }
  }, [sessionValidated, identity, isLocalLoggedIn, profileLoading, navigate]);

  useEffect(() => {
    if (identity && !profileLoading && myProfile === null)
      navigate({ to: "/setup" });
  }, [identity, profileLoading, myProfile, navigate]);

  const myPrincipal = identity?.getPrincipal();
  const isLoading = usersLoading || localUsersLoading;

  // Filter localUsers by search + language
  const filteredLocalUsers = localUsers.filter((u) => {
    const matchesSearch =
      searchQuery === "" ||
      u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username.toLowerCase().includes(searchQuery.toLowerCase());
    // Language filter is client-side; just check if any language prop exists
    const matchesLang =
      selectedLanguage === "All" ||
      (u as any).languages?.includes(selectedLanguage) ||
      (u as any).language === selectedLanguage;
    return matchesSearch && matchesLang;
  });

  const filteredUsers = users.filter((u) => {
    if (searchQuery === "") return true;
    const name = u.fname || u.name || "";
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const totalCount = filteredUsers.length + filteredLocalUsers.length;

  const handleLocalCall = async (targetUsername: string) => {
    if (!localSession) return;
    try {
      await sendCallRequestAsLocal.mutateAsync({
        token: localSession.token,
        calleeUsername: targetUsername,
      });
      toast.success("Call request sent! 📞");
    } catch {
      toast.error("Failed to send call request");
    }
  };

  const handleAccept = async (id: bigint) => {
    if (!localSession) return;
    try {
      await acceptCall.mutateAsync({ token: localSession.token, id });
      navigate({ to: `/call/${id.toString()}` });
    } catch {
      toast.error("Failed to accept call");
    }
  };

  const handleDeny = async (id: bigint) => {
    if (!localSession) return;
    try {
      await denyCall.mutateAsync({ token: localSession.token, id });
      toast.info("Call declined");
    } catch {
      toast.error("Failed to deny call");
    }
  };

  const handleLogout = async () => {
    try {
      await logoutLocal();
    } catch {}
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-background">
      <GlobalCallWatcher />
      <header className="bg-background border-b border-border px-6 py-3 flex items-center justify-between">
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
            data-ocid="cards.close_button"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-10 pb-24">
        {/* Incoming call notification banners */}
        <AnimatePresence>
          {incomingRequests.map((cr) => {
            const callerUser = localUsers.find(
              (u) => u.username === cr.callerUsername,
            );
            const callerName = callerUser?.displayName || cr.callerUsername;
            return (
              <motion.div
                key={cr.id.toString()}
                initial={{ opacity: 0, y: -20, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.97 }}
                transition={{ duration: 0.25 }}
                className="mb-4 rounded-2xl border border-green-400/30 bg-gradient-to-r from-green-500/20 to-emerald-500/20 backdrop-blur-sm px-5 py-4 flex items-center justify-between gap-4 shadow-lg"
                data-ocid="cards.modal"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-500/30 flex items-center justify-center animate-pulse">
                    <PhoneCall className="h-5 w-5 text-green-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">
                      📞 {callerName} is calling you!
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Incoming call request
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAccept(cr.id)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-green-500 hover:bg-green-600 text-white text-sm font-semibold transition-colors"
                    data-ocid="cards.confirm_button"
                  >
                    <Phone className="h-4 w-4" /> Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeny(cr.id)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-red-500/80 hover:bg-red-600 text-white text-sm font-semibold transition-colors"
                    data-ocid="cards.cancel_button"
                  >
                    <PhoneMissed className="h-4 w-4" /> Deny
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        <div className="flex items-center gap-4 mb-4">
          <div>
            <h1 className="font-display font-bold text-3xl text-foreground">
              Calling Cards
            </h1>
            <p className="text-muted-foreground">
              {localUsers.length + users.length} people in the community
            </p>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or username..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground placeholder:text-muted-foreground"
            data-ocid="cards.search_input"
          />
        </div>

        {/* Language filter chips */}
        <div
          className="flex gap-2 overflow-x-auto pb-2 mb-6"
          style={{ scrollbarWidth: "none" }}
        >
          {LANGUAGE_FILTERS.map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => setSelectedLanguage(lang)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                selectedLanguage === lang
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
              }`}
              data-ocid="cards.tab"
            >
              {lang}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div
            className="flex items-center justify-center py-24"
            data-ocid="cards.loading_state"
          >
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : totalCount === 0 ? (
          <div className="text-center py-24" data-ocid="cards.empty_state">
            <div className="text-6xl mb-4">👥</div>
            <h3 className="font-display font-semibold text-2xl text-foreground mb-2">
              {searchQuery ? "No results found" : "No community members yet"}
            </h3>
            <p className="text-muted-foreground">
              {searchQuery
                ? `No users match "${searchQuery}"`
                : "Be the first! Sign up and create your calling card."}
            </p>
          </div>
        ) : (
          <div className="relative">
            <div
              ref={carouselRef}
              className="flex gap-5 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-4 px-2"
              style={{ scrollbarWidth: "none" }}
            >
              {filteredUsers.map((user, i) => (
                <div
                  key={user.principal.toString()}
                  className="flex-shrink-0 w-72 snap-center"
                >
                  <CallingCard
                    user={user}
                    index={i}
                    myPrincipal={myPrincipal}
                  />
                </div>
              ))}
              {filteredLocalUsers.map((user, i) => {
                const pendingOutgoing = callRequests.find(
                  (cr) =>
                    cr.callerUsername === localSession?.username &&
                    cr.calleeUsername === user.username &&
                    cr.status === "pending",
                );
                return (
                  <div
                    key={user.username}
                    className="flex-shrink-0 w-72 snap-center"
                  >
                    <LocalCallingCard
                      user={user}
                      index={filteredUsers.length + i}
                      myUsername={localSession?.username || ""}
                      hasPendingOutgoing={!!pendingOutgoing}
                      onCall={() => handleLocalCall(user.username)}
                      isCalling={sendCallRequestAsLocal.isPending}
                      extActor={isLocalLoggedIn ? extActor : null}
                      token={localSession?.token}
                      isOnline={onlineUsernames.includes(user.username)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
