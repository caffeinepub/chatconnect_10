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
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ChevronDown,
  ChevronUp,
  Heart,
  Loader2,
  LogOut,
  MessageCircle,
  Newspaper,
  Send,
  Trash2,
  UserCircle,
  Users,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Comment, Post, SessionToken } from "../backend.d";
import { BottomNav } from "../components/BottomNav";
import { GlobalCallWatcher } from "../components/GlobalCallWatcher";
import { useActor } from "../hooks/useActor";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import { useLocalAuth } from "../hooks/useLocalAuth";
import { useCreatePost, useGetPosts } from "../hooks/useQueries";

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
};

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
  };
}

export default function FeedPage() {
  const navigate = useNavigate();
  const { identity, clear } = useInternetIdentity();
  const { localSession, logoutLocal, isLocalLoggedIn } = useLocalAuth();
  const { actor } = useActor();
  const queryClient = useQueryClient();
  const [postText, setPostText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localPosts, setLocalPosts] = useState<Post[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [postStates, setPostStates] = useState<Record<string, PostState>>({});

  const { data: iiPosts = [] } = useGetPosts();
  const createPostII = useCreatePost();

  const getActor = useCallback(() => actor as unknown as ActorExt, [actor]);

  // Auth guard
  useEffect(() => {
    if (!identity && !isLocalLoggedIn) {
      navigate({ to: "/login" });
    }
  }, [identity, isLocalLoggedIn, navigate]);

  // Fetch local posts via polling
  useEffect(() => {
    if (!isLocalLoggedIn || !actor || !localSession) return;
    const a = actor as unknown as ActorExt;
    const fetchPosts = async () => {
      try {
        const posts = await a.getPostsAsLocal(localSession.token);
        setLocalPosts(posts);
      } catch {
        // ignore
      }
    };
    fetchPosts();
    const interval = setInterval(fetchPosts, 5000);
    return () => clearInterval(interval);
  }, [isLocalLoggedIn, actor, localSession]);

  const posts = isLocalLoggedIn ? localPosts : iiPosts;
  const sortedPosts = [...posts].sort((a, b) =>
    a.timestamp > b.timestamp ? -1 : 1,
  );

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

  // Load likes on mount for all posts
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional shallow dep
  useEffect(() => {
    if (!actor || sortedPosts.length === 0) return;
    for (const post of sortedPosts) {
      const key = post.id.toString();
      if (!postStates[key]?.likesLoaded) {
        loadLikes(post.id);
      }
    }
  }, [actor, sortedPosts.length, loadLikes]);

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
        }
      } else {
        if (wasLiked) {
          await a.unlikePost(postId);
        } else {
          await a.likePost(postId);
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

  return (
    <TooltipProvider>
      <GlobalCallWatcher />
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="bg-white border-b border-border px-6 py-3 flex items-center justify-between flex-shrink-0 sticky top-0 z-10">
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

        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 pb-24">
          {/* Composer */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-2xl border border-border shadow-sm p-3 mb-5"
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
              {sortedPosts.length === 0 ? (
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
                sortedPosts.map((post, i) => {
                  const key = post.id.toString();
                  const ps = getOrInitPostState(key);
                  const isAuthor = post.authorName === currentDisplayName;

                  return (
                    <motion.article
                      key={key}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: i * 0.04 }}
                      className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                      data-ocid={`feed.item.${i + 1}`}
                    >
                      <div className="p-5">
                        <div className="flex items-start gap-3">
                          <Avatar className="w-10 h-10 flex-shrink-0">
                            <AvatarFallback
                              className={`bg-gradient-to-br ${getGradient(post.author.toString())} text-white text-sm font-bold`}
                            >
                              {post.authorName.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-sm text-foreground">
                                {post.authorName}
                              </span>
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
                                : `View replies${ps.comments.length > 0 ? ` (${ps.comments.length})` : ""}`}
                            </span>
                            {ps.repliesOpen ? (
                              <ChevronUp className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5" />
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
                            <div className="border-t border-border/60 bg-gray-50/60 px-5 py-4">
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
                                        <div className="flex-1 min-w-0 bg-white rounded-xl px-3 py-2 border border-border/50">
                                          <div className="flex items-center gap-1.5 mb-0.5">
                                            <span className="text-xs font-semibold text-foreground">
                                              {comment.authorName}
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
                                  className="resize-none min-h-[60px] text-xs rounded-xl border-border bg-white"
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
