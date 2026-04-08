import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  ChevronDown,
  ChevronUp,
  Crown,
  Flame,
  Heart,
  Loader2,
  LogOut,
  MessageCircle,
  Radio,
  Repeat2,
  Send,
  Trash2,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type {
  Comment,
  LocalUser,
  Post,
  SessionToken,
  VoiceParticipant,
} from "../backend.d";
import { BottomNav } from "../components/BottomNav";
import { GlobalCallWatcher } from "../components/GlobalCallWatcher";
import { useActor } from "../hooks/useActor";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import { useLocalAuth } from "../hooks/useLocalAuth";
import { useCreatePost, useGetPosts } from "../hooks/useQueries";
import { playLikeSound } from "../utils/sounds";

type ActorExt = {
  getPostsAsLocal(token: SessionToken): Promise<Post[]>;
  createPostAsLocal(token: SessionToken, text: string): Promise<bigint>;
  deletePostAsLocal(token: SessionToken, id: bigint): Promise<void>;
  deletePost(id: bigint): Promise<void>;
  likePostAsLocal(token: SessionToken, postId: bigint): Promise<void>;
  unlikePostAsLocal(token: SessionToken, postId: bigint): Promise<void>;
  getPostLikesAsLocal(token: SessionToken, postId: bigint): Promise<string[]>;
  likePost(postId: bigint): Promise<void>;
  unlikePost(postId: bigint): Promise<void>;
  getPostLikes(postId: bigint): Promise<string[]>;
  addCommentAsLocal(
    token: SessionToken,
    postId: bigint,
    text: string,
  ): Promise<bigint>;
  addComment(postId: bigint, text: string): Promise<bigint>;
  getCommentsForPostAsLocal(
    token: SessionToken,
    postId: bigint,
  ): Promise<Comment[]>;
  getCommentsForPost(postId: bigint): Promise<Comment[]>;
  deleteCommentAsLocal(token: SessionToken, id: bigint): Promise<void>;
  deleteComment(id: bigint): Promise<void>;
  getVoiceParticipants(token: SessionToken): Promise<VoiceParticipant[]>;
  resharePost(token: SessionToken, originalPostId: bigint): Promise<bigint>;
  getReshareCount(postId: bigint): Promise<bigint>;
};

const AVATAR_GRADIENTS = [
  "from-purple-500 to-indigo-600",
  "from-teal-400 to-cyan-500",
  "from-orange-400 to-pink-500",
  "from-emerald-400 to-teal-500",
  "from-rose-400 to-purple-500",
];

const LANGUAGE_FILTERS = ["All", "English", "Hindi", "Bengali", "Punjabi"];

const VOICE_ROOMS = [
  {
    id: "music",
    name: "Music",
    emoji: "🎵",
    gradient: "from-pink-500 to-rose-600",
    desc: "Share tunes",
  },
  {
    id: "chill",
    name: "Chill",
    emoji: "😌",
    gradient: "from-teal-400 to-cyan-500",
    desc: "Relax & talk",
  },
  {
    id: "gaming",
    name: "Gaming",
    emoji: "🎮",
    gradient: "from-violet-500 to-indigo-600",
    desc: "Gaming chat",
  },
  {
    id: "rants",
    name: "Rants",
    emoji: "💬",
    gradient: "from-orange-400 to-amber-500",
    desc: "Vent & share",
  },
];

function getGradient(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++)
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

function formatRelativeTime(timestampNs: bigint): string {
  const nowMs = Date.now();
  const thenMs = Number(timestampNs / 1_000_000n);
  const diffSec = Math.floor((nowMs - thenMs) / 1000);
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

interface PostState {
  likes: string[];
  likedByMe: boolean;
  likesLoaded: boolean;
  likeLoading: boolean;
  repliesOpen: boolean;
  comments: Comment[];
  commentsLoaded: boolean;
  commentsLoading: boolean;
  replyText: string;
  replySubmitting: boolean;
  deleteLoading: boolean;
  reshareLoading: boolean;
  reshareCount: number;
}

function defaultPostState(): PostState {
  return {
    likes: [],
    likedByMe: false,
    likesLoaded: false,
    likeLoading: false,
    repliesOpen: false,
    comments: [],
    commentsLoaded: false,
    commentsLoading: false,
    replyText: "",
    replySubmitting: false,
    deleteLoading: false,
    reshareLoading: false,
    reshareCount: 0,
  };
}

export default function FeedPage() {
  const navigate = useNavigate();
  const { identity, clear } = useInternetIdentity();
  const { localSession, logoutLocal, isLocalLoggedIn, sessionValidated } =
    useLocalAuth();
  const { actor } = useActor();
  const queryClient = useQueryClient();
  const [postText, setPostText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localPosts, setLocalPosts] = useState<Post[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [postStates, setPostStates] = useState<Record<string, PostState>>({});
  const [selectedLanguage, setSelectedLanguage] = useState("All");
  const [verifiedUsers, setVerifiedUsers] = useState<Set<string>>(new Set());

  // Live Now: room participant counts
  const [roomCounts, setRoomCounts] = useState<Record<string, number>>({});

  const isFetchingRef = useRef(false);

  const { data: iiPosts = [] } = useGetPosts();
  const createPostII = useCreatePost();

  const getActor = useCallback(() => actor as unknown as ActorExt, [actor]);

  // Auth guard
  useEffect(() => {
    if (sessionValidated && !identity && !isLocalLoggedIn) {
      navigate({ to: "/login" });
    }
  }, [sessionValidated, identity, isLocalLoggedIn, navigate]);

  // Fetch local posts via polling with overlap guard
  useEffect(() => {
    if (!isLocalLoggedIn || !actor || !localSession) return;
    const a = actor as unknown as ActorExt;
    const fetchPosts = async () => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;
      try {
        const posts = await a.getPostsAsLocal(localSession.token);
        setLocalPosts(posts);
      } catch {
        // ignore
      } finally {
        isFetchingRef.current = false;
      }
    };
    fetchPosts();
    const interval = setInterval(fetchPosts, 2000);
    return () => clearInterval(interval);
  }, [isLocalLoggedIn, actor, localSession]);

  // Load verified status for all users
  useEffect(() => {
    if (!actor) return;
    const a = actor as unknown as ActorExt & {
      getLocalUsers(): Promise<LocalUser[]>;
      isUserVerified(username: string): Promise<boolean>;
    };
    a.getLocalUsers()
      .then(async (users) => {
        const checks = await Promise.all(
          users.map((u) =>
            a
              .isUserVerified(u.username)
              .then((v) => ({
                username: u.username,
                displayName: u.displayName,
                verified: v,
              }))
              .catch(() => ({
                username: u.username,
                displayName: u.displayName,
                verified: false,
              })),
          ),
        );
        const verSet = new Set<string>();
        for (const c of checks) {
          if (c.verified) {
            verSet.add(c.displayName);
            verSet.add(c.username);
          }
        }
        setVerifiedUsers(verSet);
      })
      .catch(() => {});
  }, [actor]);

  // Fetch Live Now room participant counts every 15s
  useEffect(() => {
    if (!actor || !localSession) return;
    const a = actor as unknown as ActorExt;
    const fetchCounts = async () => {
      try {
        const participants = await a.getVoiceParticipants(localSession.token);
        // All participants are in the same shared voice channel;
        // distribute count across rooms based on active participants as an approximation
        // Real room isolation only exists via signal tagging on the frontend
        const count = participants.length;
        // Show all live count on a random room for demo (or show total across rooms)
        // Since backend has no room concept, we show the total as "Live" count
        const counts: Record<string, number> = {};
        for (const room of VOICE_ROOMS) {
          counts[room.id] = 0;
        }
        // Distribute participants across rooms heuristically (just show total on first active)
        if (count > 0) {
          counts.music = count;
        }
        setRoomCounts(counts);
      } catch {
        // ignore
      }
    };
    fetchCounts();
    const interval = setInterval(fetchCounts, 15000);
    return () => clearInterval(interval);
  }, [actor, localSession]);

  const posts = isLocalLoggedIn ? localPosts : iiPosts;
  const sortedPosts = [...posts].sort((a, b) =>
    a.timestamp > b.timestamp ? -1 : 1,
  );

  // Compute trending posts: top 3 by likes in last 24h
  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const trendingPosts = [...sortedPosts]
    .filter((p) => now - Number(p.timestamp / 1_000_000n) < oneDayMs)
    .sort((a, b) => {
      const aLikes = postStates[a.id.toString()]?.likes.length ?? 0;
      const bLikes = postStates[b.id.toString()]?.likes.length ?? 0;
      return bLikes - aLikes;
    })
    .slice(0, 3);

  const getOrInitPostState = useCallback(
    (postId: string): PostState => postStates[postId] ?? defaultPostState(),
    [postStates],
  );

  const updatePostState = useCallback(
    (postId: string, update: Partial<PostState>) => {
      setPostStates((prev) => ({
        ...prev,
        [postId]: { ...(prev[postId] ?? defaultPostState()), ...update },
      }));
    },
    [],
  );

  // Load likes for a post
  const loadLikes = useCallback(
    async (postId: bigint) => {
      const key = postId.toString();
      if (!actor) return;
      const a = getActor();
      try {
        let likes: string[];
        if (isLocalLoggedIn && localSession) {
          likes = await a.getPostLikesAsLocal(localSession.token, postId);
        } else {
          likes = await a.getPostLikes(postId);
        }
        const myName = isLocalLoggedIn ? (localSession?.displayName ?? "") : "";
        updatePostState(key, {
          likes,
          likedByMe: likes.includes(myName),
          likesLoaded: true,
        });
      } catch {
        // ignore
      }
    },
    [actor, getActor, isLocalLoggedIn, localSession, updatePostState],
  );

  // Load reshare count for a post
  const loadReshareCount = useCallback(
    async (postId: bigint) => {
      const key = postId.toString();
      if (!actor) return;
      const a = getActor();
      try {
        const count = await a.getReshareCount(postId);
        updatePostState(key, { reshareCount: Number(count) });
      } catch {
        // ignore
      }
    },
    [actor, getActor, updatePostState],
  );

  // Load likes on mount for all posts
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional shallow dep
  useEffect(() => {
    if (!actor || sortedPosts.length === 0) return;
    for (const post of sortedPosts) {
      const key = post.id.toString();
      if (!postStates[key]?.likesLoaded) {
        loadLikes(post.id);
        loadReshareCount(post.id);
      }
    }
  }, [actor, sortedPosts.length, loadLikes, loadReshareCount]);

  const handleToggleLike = async (postId: bigint) => {
    const key = postId.toString();
    const state = getOrInitPostState(key);
    if (state.likeLoading) return;
    const a = getActor();
    updatePostState(key, { likeLoading: true });
    const wasLiked = state.likedByMe;
    try {
      if (isLocalLoggedIn && localSession) {
        if (wasLiked) {
          await a.unlikePostAsLocal(localSession.token, postId);
        } else {
          await a.likePostAsLocal(localSession.token, postId);
          playLikeSound();
        }
      } else {
        if (wasLiked) {
          await a.unlikePost(postId);
        } else {
          await a.likePost(postId);
          playLikeSound();
        }
      }
      await loadLikes(postId);
    } catch {
      toast.error("Failed to update like.");
    } finally {
      updatePostState(key, { likeLoading: false });
    }
  };

  const loadComments = async (postId: bigint) => {
    const key = postId.toString();
    if (!actor) return;
    const a = getActor();
    updatePostState(key, { commentsLoading: true });
    try {
      let comments: Comment[];
      if (isLocalLoggedIn && localSession) {
        comments = await a.getCommentsForPostAsLocal(
          localSession.token,
          postId,
        );
      } else {
        comments = await a.getCommentsForPost(postId);
      }
      updatePostState(key, {
        comments,
        commentsLoaded: true,
        commentsLoading: false,
      });
    } catch {
      updatePostState(key, { commentsLoading: false });
    }
  };

  const handleToggleReplies = async (postId: bigint) => {
    const key = postId.toString();
    const state = getOrInitPostState(key);
    const opening = !state.repliesOpen;
    updatePostState(key, { repliesOpen: opening });
    if (opening && !state.commentsLoaded) {
      await loadComments(postId);
    }
  };

  const handleAddComment = async (postId: bigint) => {
    const key = postId.toString();
    const state = getOrInitPostState(key);
    const text = state.replyText.trim();
    if (!text || !actor) return;
    const a = getActor();
    updatePostState(key, { replySubmitting: true });
    try {
      if (isLocalLoggedIn && localSession) {
        await a.addCommentAsLocal(localSession.token, postId, text);
      } else {
        await a.addComment(postId, text);
      }
      updatePostState(key, { replyText: "" });
      await loadComments(postId);
      toast.success("Reply added!");
    } catch {
      toast.error("Failed to add reply.");
    } finally {
      updatePostState(key, { replySubmitting: false });
    }
  };

  const handleDeleteComment = async (postId: bigint, commentId: bigint) => {
    const key = postId.toString();
    if (!actor) return;
    const a = getActor();
    try {
      if (isLocalLoggedIn && localSession) {
        await a.deleteCommentAsLocal(localSession.token, commentId);
      } else {
        await a.deleteComment(commentId);
      }
      await loadComments(postId);
      toast.success("Reply deleted.");
    } catch {
      toast.error("Failed to delete reply.");
    }
    updatePostState(key, {});
  };

  const handleDeletePost = async (postId: bigint) => {
    const key = postId.toString();
    if (!confirm("Delete this post?")) return;
    if (!actor) return;
    const a = getActor();
    updatePostState(key, { deleteLoading: true });
    try {
      if (isLocalLoggedIn && localSession) {
        await a.deletePostAsLocal(localSession.token, postId);
        const updated = await a.getPostsAsLocal(localSession.token);
        setLocalPosts(updated);
      } else {
        await a.deletePost(postId);
        queryClient.invalidateQueries({ queryKey: ["posts"] });
      }
      toast.success("Post deleted.");
    } catch {
      toast.error("Failed to delete post.");
      updatePostState(key, { deleteLoading: false });
    }
  };

  const handleReshare = async (postId: bigint) => {
    const key = postId.toString();
    if (!isLocalLoggedIn || !localSession || !actor) {
      toast.error("Log in to repost");
      return;
    }
    const a = getActor();
    updatePostState(key, { reshareLoading: true });
    try {
      await a.resharePost(localSession.token, postId);
      toast.success("Post reposted!");
      await loadReshareCount(postId);
      // Refresh feed
      const updated = await a.getPostsAsLocal(localSession.token);
      setLocalPosts(updated);
    } catch {
      toast.error("Failed to repost.");
    } finally {
      updatePostState(key, { reshareLoading: false });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postText.trim()) return;
    const text = postText.trim();
    setPostText("");
    setIsSubmitting(true);
    try {
      if (isLocalLoggedIn && localSession && actor) {
        const a = actor as unknown as ActorExt;
        await a.createPostAsLocal(localSession.token, text);
        const updatedPosts = await a.getPostsAsLocal(localSession.token);
        setLocalPosts(updatedPosts);
      } else {
        await createPostII.mutateAsync(text);
      }
      toast.success("Post shared!");
    } catch {
      toast.error("Failed to post. Please try again.");
      setPostText(text);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    if (isLocalLoggedIn) {
      await logoutLocal();
    } else {
      await clear();
      queryClient.clear();
    }
    navigate({ to: "/" });
  };

  const currentDisplayName = isLocalLoggedIn ? localSession?.displayName : "";

  // Filter posts by language (client-side — no backend needed)
  const displayedPosts =
    selectedLanguage === "All"
      ? sortedPosts
      : sortedPosts.filter(
          (p) =>
            (p as any).language === selectedLanguage ||
            (p as any).authorLanguage === selectedLanguage,
        );

  // Sort rooms by live count descending
  const sortedRooms = [...VOICE_ROOMS].sort(
    (a, b) => (roomCounts[b.id] ?? 0) - (roomCounts[a.id] ?? 0),
  );

  return (
    <TooltipProvider>
      <GlobalCallWatcher />
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="bg-background border-b border-border px-6 py-3 flex items-center justify-between flex-shrink-0 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg gradient-hero flex items-center justify-center text-white font-bold text-sm">
              W
            </div>
            <span className="font-display font-bold text-lg">WaveChat</span>
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
              data-ocid="feed.close_button"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </nav>
        </header>

        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 pb-24">
          {/* ── LIVE NOW STRIP ──────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <Radio className="h-3.5 w-3.5 text-red-500" />
              <span className="text-sm font-bold text-foreground">
                Live Now
              </span>
              <span className="text-xs text-muted-foreground">Tap to join</span>
            </div>
            <div
              className="flex gap-3 overflow-x-auto pb-2"
              style={{ scrollbarWidth: "none" }}
            >
              {sortedRooms.map((room) => {
                const count = roomCounts[room.id] ?? 0;
                return (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() =>
                      navigate({
                        to: "/lobby",
                        search: { room: room.id },
                      })
                    }
                    className="flex-shrink-0 relative rounded-2xl overflow-hidden transition-transform active:scale-95 hover:scale-[1.03]"
                    style={{ width: "120px" }}
                    data-ocid="feed.primary_button"
                  >
                    <div
                      className={`w-full p-3 bg-gradient-to-br ${room.gradient} text-white text-left`}
                    >
                      <div className="text-xl mb-1">{room.emoji}</div>
                      <div className="font-semibold text-sm">{room.name}</div>
                      <div className="text-[10px] opacity-80">{room.desc}</div>
                      <div className="mt-2 flex items-center gap-1">
                        {count > 0 ? (
                          <span className="flex items-center gap-1 bg-black/25 rounded-full px-2 py-0.5 text-[10px] font-bold">
                            <span className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse" />
                            {count} live
                          </span>
                        ) : (
                          <span className="bg-black/20 rounded-full px-2 py-0.5 text-[10px] opacity-70">
                            Quiet
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
              {/* Matches card */}
              <button
                type="button"
                onClick={() => navigate({ to: "/matches" })}
                className="flex-shrink-0 relative rounded-2xl overflow-hidden transition-transform active:scale-95 hover:scale-[1.03]"
                style={{ width: "120px" }}
                data-ocid="feed.secondary_button"
              >
                <div className="w-full p-3 bg-gradient-to-br from-rose-500 to-pink-600 text-white text-left">
                  <div className="text-xl mb-1">❤️</div>
                  <div className="font-semibold text-sm">Matches</div>
                  <div className="text-[10px] opacity-80">Find people</div>
                  <div className="mt-2">
                    <span className="bg-black/20 rounded-full px-2 py-0.5 text-[10px] opacity-90">
                      Discover
                    </span>
                  </div>
                </div>
              </button>
            </div>
          </motion.div>

          {/* Trending Posts */}
          {trendingPosts.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="mb-5"
            >
              <div className="flex items-center gap-2 mb-2">
                <Flame className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-semibold text-foreground">
                  Trending
                </span>
                <span className="text-xs text-muted-foreground">
                  Top posts in last 24h
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {trendingPosts.map((post, i) => (
                  <div
                    key={post.id.toString()}
                    className="bg-card border border-border rounded-xl px-4 py-3 flex items-start gap-3"
                    data-ocid={`feed.item.${i + 1}`}
                  >
                    <span className="text-orange-500 font-bold text-sm flex-shrink-0 mt-0.5">
                      #{i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() =>
                          navigate({
                            to: "/profile",
                            search: { user: post.authorName } as any,
                          })
                        }
                        className="text-xs font-semibold text-foreground hover:underline inline-flex items-center gap-1"
                        data-ocid="feed.link"
                      >
                        {post.authorName}
                        {verifiedUsers.has(post.authorName) && (
                          <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-blue-500 flex-shrink-0">
                            <svg
                              role="img"
                              aria-label="verified"
                              viewBox="0 0 12 12"
                              className="w-2 h-2"
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
                      </button>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {post.text.slice(0, 80)}
                        {post.text.length > 80 ? "…" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-rose-500 text-xs font-semibold flex-shrink-0">
                      <Heart className="h-3 w-3" fill="currentColor" />
                      {postStates[post.id.toString()]?.likes.length ?? 0}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Language Filter */}
          <div
            className="flex gap-2 overflow-x-auto pb-2 mb-4"
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
                data-ocid="feed.tab"
              >
                {lang}
              </button>
            ))}
          </div>

          {/* Composer */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-card rounded-2xl border border-border shadow-sm p-3 mb-5"
            data-ocid="feed.panel"
          >
            <h2 className="font-display font-bold text-sm mb-2 bg-gradient-to-r from-purple-600 to-teal-500 bg-clip-text text-transparent">
              Share Something
            </h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-2">
              <Textarea
                ref={textareaRef}
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
                placeholder="What's on your mind? Share with the community..."
                className="resize-none min-h-[60px] rounded-xl border-border focus:ring-2 focus:ring-primary/30"
                data-ocid="feed.textarea"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    handleSubmit(e as unknown as React.FormEvent);
                  }
                }}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {postText.length > 0
                    ? `${postText.length} chars · Ctrl+Enter to post`
                    : ""}
                </span>
                <Button
                  type="submit"
                  disabled={!postText.trim() || isSubmitting}
                  className="rounded-full px-6 gap-2 btn-orange"
                  data-ocid="feed.submit_button"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {isSubmitting ? "Posting..." : "Post"}
                </Button>
              </div>
            </form>
          </motion.div>

          {/* Posts */}
          <div className="space-y-4">
            <AnimatePresence initial={false}>
              {displayedPosts.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-20 text-center"
                  data-ocid="feed.empty_state"
                >
                  <div className="text-6xl mb-4">📰</div>
                  <h3 className="font-display font-semibold text-xl text-foreground mb-2">
                    No posts yet.
                  </h3>
                  <p className="text-muted-foreground">
                    Be the first to share something!
                  </p>
                </motion.div>
              ) : (
                displayedPosts.map((post, i) => {
                  const key = post.id.toString();
                  const ps = getOrInitPostState(key);
                  const isAuthor = post.authorName === currentDisplayName;

                  return (
                    <motion.article
                      key={key}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: i * 0.04 }}
                      className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                      data-ocid={`feed.item.${i + 1}`}
                    >
                      <div className="p-5">
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              navigate({
                                to: "/profile",
                                search: { user: post.authorName } as any,
                              })
                            }
                            className="flex-shrink-0 hover:opacity-80 transition-opacity"
                            data-ocid="feed.link"
                          >
                            <Avatar className="w-10 h-10">
                              <AvatarFallback
                                className={`bg-gradient-to-br ${getGradient(post.author.toString())} text-white text-sm font-bold`}
                              >
                                {post.authorName.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <button
                                type="button"
                                onClick={() =>
                                  navigate({
                                    to: "/profile",
                                    search: { user: post.authorName } as any,
                                  })
                                }
                                className="font-semibold text-sm text-foreground inline-flex items-center gap-1 hover:underline"
                                data-ocid="feed.link"
                              >
                                {post.authorName}
                                {verifiedUsers.has(post.authorName) && (
                                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-500 flex-shrink-0">
                                    <svg
                                      role="img"
                                      aria-label="verified"
                                      viewBox="0 0 12 12"
                                      className="w-2.5 h-2.5"
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
                                {post.authorName.toUpperCase() ===
                                  "WILDFIRE" && (
                                  <Crown className="h-3 w-3 text-amber-400 flex-shrink-0" />
                                )}
                              </button>
                              <span className="text-xs text-muted-foreground">
                                · {formatRelativeTime(post.timestamp)}
                              </span>
                              {isAuthor && (
                                <button
                                  type="button"
                                  onClick={() => handleDeletePost(post.id)}
                                  disabled={ps.deleteLoading}
                                  className="ml-auto text-muted-foreground hover:text-red-500 transition-colors p-1 rounded"
                                  aria-label="Delete post"
                                  data-ocid={`feed.delete_button.${i + 1}`}
                                >
                                  {ps.deleteLoading ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              )}
                            </div>
                            <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">
                              {(
                                post as Post & { resharedFromUsername?: string }
                              ).resharedFromUsername && (
                                <span className="block text-xs text-muted-foreground mb-1">
                                  🔁 Reposted from @
                                  {
                                    (
                                      post as Post & {
                                        resharedFromUsername?: string;
                                      }
                                    ).resharedFromUsername
                                  }
                                </span>
                              )}
                              {post.text}
                            </p>
                          </div>
                        </div>

                        {/* Like & Reply bar */}
                        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border/60">
                          {/* Like button */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={() => handleToggleLike(post.id)}
                                disabled={ps.likeLoading}
                                className={`flex items-center gap-1.5 text-sm transition-colors ${
                                  ps.likedByMe
                                    ? "text-rose-500 hover:text-rose-400"
                                    : "text-muted-foreground hover:text-rose-400"
                                }`}
                                data-ocid={`feed.toggle.${i + 1}`}
                              >
                                {ps.likeLoading ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Heart
                                    className="h-4 w-4"
                                    fill={
                                      ps.likedByMe ? "currentColor" : "none"
                                    }
                                  />
                                )}
                                <span>
                                  {ps.likes.length > 0 ? ps.likes.length : ""}
                                </span>
                              </button>
                            </TooltipTrigger>
                            {ps.likes.length > 0 && (
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="text-xs">{ps.likes.join(", ")}</p>
                              </TooltipContent>
                            )}
                          </Tooltip>

                          {/* View replies toggle */}
                          <button
                            type="button"
                            onClick={() => handleToggleReplies(post.id)}
                            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
                            data-ocid={`feed.tab.${i + 1}`}
                          >
                            <MessageCircle className="h-4 w-4" />
                            <span>
                              {ps.repliesOpen
                                ? "Hide replies"
                                : `View replies${
                                    ps.comments.length > 0
                                      ? ` (${ps.comments.length})`
                                      : ""
                                  }`}
                            </span>
                            {ps.repliesOpen ? (
                              <ChevronUp className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5" />
                            )}
                          </button>

                          {/* Repost button */}
                          <button
                            type="button"
                            onClick={() => handleReshare(post.id)}
                            disabled={ps.reshareLoading}
                            className="ml-auto flex items-center gap-1.5 text-sm text-muted-foreground hover:text-green-500 transition-colors"
                            data-ocid={`feed.reshare_button.${i + 1}`}
                          >
                            {ps.reshareLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Repeat2 className="h-4 w-4" />
                            )}
                            {ps.reshareCount > 0 && (
                              <span>{ps.reshareCount}</span>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Collapsible replies section */}
                      <AnimatePresence initial={false}>
                        {ps.repliesOpen && (
                          <motion.div
                            key="replies"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="border-t border-border/60 bg-muted/30 px-5 py-4">
                              {/* Comments list */}
                              {ps.commentsLoading ? (
                                <div
                                  className="flex justify-center py-4"
                                  data-ocid={`feed.loading_state.${i + 1}`}
                                >
                                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                </div>
                              ) : ps.comments.length === 0 ? (
                                <p className="text-xs text-muted-foreground text-center py-2">
                                  No replies yet. Be the first!
                                </p>
                              ) : (
                                <div className="space-y-3 mb-4">
                                  {ps.comments.map((comment) => {
                                    const isCommentAuthor =
                                      comment.authorName === currentDisplayName;
                                    return (
                                      <div
                                        key={comment.id.toString()}
                                        className="flex items-start gap-2.5"
                                      >
                                        <Avatar className="w-7 h-7 flex-shrink-0 mt-0.5">
                                          <AvatarFallback
                                            className={`bg-gradient-to-br ${getGradient(comment.author.toString())} text-white text-xs font-bold`}
                                          >
                                            {comment.authorName
                                              .slice(0, 2)
                                              .toUpperCase()}
                                          </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0 bg-card rounded-xl px-3 py-2 border border-border/50">
                                          <div className="flex items-center gap-1.5 mb-0.5">
                                            <span className="text-xs font-semibold text-foreground inline-flex items-center gap-1">
                                              {comment.authorName}
                                              {verifiedUsers.has(
                                                comment.authorName,
                                              ) && (
                                                <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-blue-500 flex-shrink-0">
                                                  <svg
                                                    role="img"
                                                    aria-label="verified"
                                                    viewBox="0 0 12 12"
                                                    className="w-2 h-2"
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
                                              {comment.authorName.toUpperCase() ===
                                                "WILDFIRE" && (
                                                <Crown className="h-2.5 w-2.5 text-amber-400 flex-shrink-0" />
                                              )}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                              ·{" "}
                                              {formatRelativeTime(
                                                comment.timestamp,
                                              )}
                                            </span>
                                            {isCommentAuthor && (
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  handleDeleteComment(
                                                    post.id,
                                                    comment.id,
                                                  )
                                                }
                                                className="ml-auto text-muted-foreground hover:text-red-500 transition-colors"
                                                aria-label="Delete reply"
                                                data-ocid={`feed.delete_button.${i + 1}`}
                                              >
                                                <Trash2 className="h-3 w-3" />
                                              </button>
                                            )}
                                          </div>
                                          <p className="text-xs text-foreground leading-relaxed">
                                            {comment.text}
                                          </p>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Reply input */}
                              <div className="flex gap-2 mt-2">
                                <Textarea
                                  value={ps.replyText}
                                  onChange={(e) =>
                                    updatePostState(key, {
                                      replyText: e.target.value,
                                    })
                                  }
                                  placeholder="Write a reply..."
                                  className="resize-none min-h-[60px] text-xs rounded-xl border-border bg-card"
                                  data-ocid="feed.textarea"
                                  onKeyDown={(e) => {
                                    if (
                                      e.key === "Enter" &&
                                      (e.metaKey || e.ctrlKey)
                                    ) {
                                      handleAddComment(post.id);
                                    }
                                  }}
                                />
                                <Button
                                  size="sm"
                                  onClick={() => handleAddComment(post.id)}
                                  disabled={
                                    !ps.replyText.trim() || ps.replySubmitting
                                  }
                                  className="self-end rounded-xl shrink-0"
                                  data-ocid="feed.submit_button"
                                >
                                  {ps.replySubmitting ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Send className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.article>
                  );
                })
              )}
            </AnimatePresence>
          </div>
        </main>

        <footer className="text-center py-6 text-xs text-muted-foreground border-t border-border">
          © {new Date().getFullYear()}. Built with ❤️ using{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-foreground transition-colors"
          >
            caffeine.ai
          </a>
          {" · "}
          Contact developer:{" "}
          <a
            href="mailto:srklimon3@gmail.com"
            className="underline hover:text-foreground transition-colors"
          >
            srklimon3@gmail.com
          </a>
        </footer>
      </div>
      <BottomNav />
    </TooltipProvider>
  );
}
