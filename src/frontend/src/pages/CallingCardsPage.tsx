import { Button } from "@/components/ui/button";
import type { Principal } from "@icp-sdk/core/principal";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Loader2,
  LogOut,
  MessageCircle,
  Phone,
  PhoneCall,
  PhoneMissed,
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

function CallingCard({
  user,
  index,
  myPrincipal,
}: { user: User; index: number; myPrincipal: Principal | undefined }) {
  const sendCallRequest = useSendCallRequest();
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
          <span className="absolute bottom-1 right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-[#0B102A]" />
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
            onClick={() => {
              window.location.href = `/messages?user=${encodeURIComponent(user.fname || user.name || "")}`;
            }}
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
}: {
  user: LocalUser;
  index: number;
  myUsername: string;
  hasPendingOutgoing: boolean;
  onCall: () => void;
  isCalling: boolean;
  extActor: ExtendedBackend | null;
  token: bigint | undefined;
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
          {user.photo ? (
            <img
              src={user.photo.getDirectURL()}
              alt={user.displayName}
              className="w-20 h-20 rounded-full object-cover border-4 border-white/20"
            />
          ) : (
            <div
              className={`w-20 h-20 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-2xl font-bold`}
            >
              {user.displayName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <span className="absolute bottom-1 right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-[#0B102A]" />
        </div>

        <h3 className="font-display font-semibold text-lg mb-1">
          {user.displayName}
        </h3>
        <p className="text-white/60 text-sm mb-1">Age {user.age.toString()}</p>
        <p className="text-white/40 text-xs mb-2">@{user.username}</p>

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
    </motion.div>
  );
}

export default function CallingCardsPage() {
  const navigate = useNavigate();
  const { identity } = useInternetIdentity();
  const { isLocalLoggedIn, localSession, logoutLocal } = useLocalAuth();
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

  const { data: callRequests = [] } = useGetCallRequestsAsLocal(
    localSession?.token,
  );

  const acceptCall = useAcceptCallRequestAsLocal();
  const denyCall = useDenyCallRequestAsLocal();
  const sendCallRequestAsLocal = useSendCallRequestAsLocal();

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
    if (!identity && !isLocalLoggedIn && !profileLoading) {
      navigate({ to: "/login" });
    }
  }, [identity, isLocalLoggedIn, profileLoading, navigate]);

  useEffect(() => {
    if (identity && !profileLoading && myProfile === null)
      navigate({ to: "/setup" });
  }, [identity, profileLoading, myProfile, navigate]);

  const myPrincipal = identity?.getPrincipal();
  const totalCount = users.length + localUsers.length;
  const isLoading = usersLoading || localUsersLoading;

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
      <header className="bg-white border-b border-border px-6 py-3 flex items-center justify-between">
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

        <div className="flex items-center gap-4 mb-8">
          <div>
            <h1 className="font-display font-bold text-3xl text-foreground">
              Calling Cards
            </h1>
            <p className="text-muted-foreground">
              {totalCount} people in the community
            </p>
          </div>
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
              No community members yet
            </h3>
            <p className="text-muted-foreground mb-6">
              Be the first! Sign up and create your calling card.
            </p>
            <Link to="/signup">
              <Button
                className="rounded-full px-8 btn-orange"
                data-ocid="cards.primary_button"
              >
                Join WaveChat
              </Button>
            </Link>
          </div>
        ) : (
          <div className="relative">
            <div
              ref={carouselRef}
              className="flex gap-5 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-4 px-2"
              style={{ scrollbarWidth: "none" }}
            >
              {users.map((user, i) => (
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
              {localUsers.map((user, i) => {
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
                      index={users.length + i}
                      myUsername={localSession?.username || ""}
                      hasPendingOutgoing={!!pendingOutgoing}
                      onCall={() => handleLocalCall(user.username)}
                      isCalling={sendCallRequestAsLocal.isPending}
                      extActor={isLocalLoggedIn ? extActor : null}
                      token={localSession?.token}
                    />
                  </div>
                );
              })}
            </div>
            {/* Left arrow */}
            <button
              type="button"
              onClick={() => {
                if (carouselRef.current) {
                  carouselRef.current.scrollBy({
                    left: -300,
                    behavior: "smooth",
                  });
                }
              }}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 w-9 h-9 rounded-full bg-white shadow-md border border-border flex items-center justify-center text-foreground hover:bg-muted transition-colors z-10 text-xl font-bold"
              aria-label="Previous"
            >
              &#8249;
            </button>
            {/* Right arrow */}
            <button
              type="button"
              onClick={() => {
                if (carouselRef.current) {
                  carouselRef.current.scrollBy({
                    left: 300,
                    behavior: "smooth",
                  });
                }
              }}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 w-9 h-9 rounded-full bg-white shadow-md border border-border flex items-center justify-center text-foreground hover:bg-muted transition-colors z-10 text-xl font-bold"
              aria-label="Next"
            >
              &#8250;
            </button>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
