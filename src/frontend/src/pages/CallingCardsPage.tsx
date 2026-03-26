import { Button } from "@/components/ui/button";
import type { Principal } from "@icp-sdk/core/principal";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Loader2,
  MessageCircle,
  Phone,
  PhoneCall,
  PhoneMissed,
  UserCircle,
  Users,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";
import { toast } from "sonner";
import type {
  backendInterface as ExtendedBackend,
  LocalUser,
  User,
} from "../backend.d";
import { GlobalCallWatcher } from "../components/GlobalCallWatcher";
import { MessagesButton } from "../components/MessagesButton";
import { NotificationBell } from "../components/NotificationBell";
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
}: {
  user: LocalUser;
  index: number;
  myUsername: string;
  hasPendingOutgoing: boolean;
  onCall: () => void;
  isCalling: boolean;
}) {
  const navigate = useNavigate();
  const isMe = user.username === myUsername;
  const gradient = getGradient(user.username);

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
        <p className="text-white/40 text-xs mb-3">@{user.username}</p>

        <div className="w-full flex flex-col gap-2">
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
  const { isLocalLoggedIn, localSession } = useLocalAuth();
  const { actor, isFetching: actorFetching } = useActor();
  const extActor = actor as unknown as ExtendedBackend | null;
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
          <Link to="/lobby">
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full gap-2"
              data-ocid="cards.link"
            >
              <MessageCircle className="h-4 w-4" />
              <span className="hidden md:block">Lobby</span>
            </Button>
          </Link>
          <Link to="/cards">
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full gap-2 text-primary"
              data-ocid="cards.tab"
            >
              <Users className="h-4 w-4" />
              <span className="hidden md:block">Calling Cards</span>
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
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
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
          <Link to="/lobby">
            <Button
              variant="ghost"
              className="rounded-full gap-2"
              data-ocid="cards.secondary_button"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Lobby
            </Button>
          </Link>
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
            {users.map((user, i) => (
              <CallingCard
                key={user.principal.toString()}
                user={user}
                index={i}
                myPrincipal={myPrincipal}
              />
            ))}
            {localUsers.map((user, i) => {
              const pendingOutgoing = callRequests.find(
                (cr) =>
                  cr.callerUsername === localSession?.username &&
                  cr.calleeUsername === user.username &&
                  cr.status === "pending",
              );
              return (
                <LocalCallingCard
                  key={user.username}
                  user={user}
                  index={users.length + i}
                  myUsername={localSession?.username || ""}
                  hasPendingOutgoing={!!pendingOutgoing}
                  onCall={() => handleLocalCall(user.username)}
                  isCalling={sendCallRequestAsLocal.isPending}
                />
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
