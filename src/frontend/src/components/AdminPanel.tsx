import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Crown,
  Loader2,
  Search,
  ShieldCheck,
  ShieldOff,
  UserCheck,
  UserX,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type {
  AdminUserInfo,
  backendInterface as ExtendedBackend,
  SessionToken,
} from "../backend.d";

interface AdminPanelProps {
  open: boolean;
  onClose: () => void;
  extActor: ExtendedBackend | null;
  token: SessionToken;
}

export function AdminPanel({
  open,
  onClose,
  extActor,
  token,
}: AdminPanelProps) {
  const [users, setUsers] = useState<AdminUserInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<Record<string, string>>(
    {},
  );

  const fetchUsers = async () => {
    if (!extActor) return;
    setLoading(true);
    try {
      const all = await extActor.getAllUsersForAdmin(token);
      setUsers(all);
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: fetchUsers is stable within render
  useEffect(() => {
    if (open) fetchUsers();
  }, [open, extActor]);

  const setAction = (username: string, action: string) =>
    setActionLoading((prev) => ({ ...prev, [username]: action }));
  const clearAction = (username: string) =>
    setActionLoading((prev) => {
      const n = { ...prev };
      delete n[username];
      return n;
    });

  const handleVerify = async (user: AdminUserInfo) => {
    if (!extActor) return;
    setAction(user.username, "verify");
    try {
      if (user.isVerified) {
        await extActor.revokeVerifiedBadge(token, user.username);
        toast.success(`Removed verified badge from ${user.displayName}`);
      } else {
        await extActor.grantVerifiedBadge(token, user.username);
        toast.success(`Granted verified badge to ${user.displayName} ✓`);
      }
      await fetchUsers();
    } catch {
      toast.error("Action failed");
    } finally {
      clearAction(user.username);
    }
  };

  const handleBan = async (user: AdminUserInfo) => {
    if (!extActor) return;
    setAction(user.username, "ban");
    try {
      if (user.isBanned) {
        await extActor.unbanLocalUser(token, user.username);
        toast.success(`Unbanned ${user.displayName}`);
      } else {
        await extActor.banLocalUser(token, user.username);
        toast.warning(`Banned ${user.displayName}`);
      }
      await fetchUsers();
    } catch {
      toast.error("Action failed");
    } finally {
      clearAction(user.username);
    }
  };

  const filtered = users.filter(
    (u) =>
      u.displayName.toLowerCase().includes(search.toLowerCase()) ||
      u.username.toLowerCase().includes(search.toLowerCase()),
  );

  const stats = {
    total: users.length,
    verified: users.filter((u) => u.isVerified).length,
    banned: users.filter((u) => u.isBanned).length,
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="h-[92dvh] rounded-t-3xl p-0 bg-[#0a0f1e] border-[#1e2a4a] flex flex-col"
        data-ocid="admin.panel"
      >
        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-white/10 flex-shrink-0">
          <SheetTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Crown className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold text-white">Admin Panel</span>
              <p className="text-xs text-amber-400/80 font-normal">
                WILDFIRE — Developer Access
              </p>
            </div>
          </SheetTitle>
        </SheetHeader>

        {/* Stats row */}
        <div className="px-6 py-3 flex gap-3 flex-shrink-0">
          <div className="flex-1 bg-white/5 rounded-xl px-3 py-2 text-center border border-white/10">
            <p className="text-lg font-bold text-white">{stats.total}</p>
            <p className="text-xs text-white/50">Members</p>
          </div>
          <div className="flex-1 bg-blue-500/10 rounded-xl px-3 py-2 text-center border border-blue-500/20">
            <p className="text-lg font-bold text-blue-400">{stats.verified}</p>
            <p className="text-xs text-blue-400/70">Verified</p>
          </div>
          <div className="flex-1 bg-red-500/10 rounded-xl px-3 py-2 text-center border border-red-500/20">
            <p className="text-lg font-bold text-red-400">{stats.banned}</p>
            <p className="text-xs text-red-400/70">Banned</p>
          </div>
        </div>

        {/* Search */}
        <div className="px-6 pb-3 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
            <Input
              placeholder="Search members..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl focus-visible:ring-amber-400/50"
              data-ocid="admin.search_input"
            />
          </div>
        </div>

        {/* User list */}
        {loading ? (
          <div
            className="flex-1 flex items-center justify-center"
            data-ocid="admin.loading_state"
          >
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-amber-400 mx-auto mb-2" />
              <p className="text-white/50 text-sm">Loading members...</p>
            </div>
          </div>
        ) : (
          <ScrollArea className="flex-1 px-6">
            <div className="space-y-2 py-2 pb-8">
              {filtered.length === 0 ? (
                <div
                  className="text-center py-16"
                  data-ocid="admin.empty_state"
                >
                  <p className="text-white/40">No members found</p>
                </div>
              ) : (
                filtered.map((user, i) => {
                  const isWildfire = user.username === "WILDFIRE";
                  const busy = actionLoading[user.username];
                  const initials = user.displayName.slice(0, 2).toUpperCase();

                  return (
                    <div
                      key={user.username}
                      className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                        user.isBanned
                          ? "bg-red-500/10 border-red-500/20"
                          : "bg-white/5 border-white/10 hover:bg-white/8"
                      }`}
                      data-ocid={`admin.item.${i + 1}`}
                    >
                      {/* Avatar */}
                      <Avatar className="w-11 h-11 flex-shrink-0">
                        <AvatarFallback className="bg-gradient-to-br from-purple-500 to-indigo-600 text-white font-bold text-sm">
                          {initials}
                        </AvatarFallback>
                      </Avatar>

                      {/* Name + badges */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isWildfire && (
                            <Crown className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
                          )}
                          <span className="font-semibold text-sm text-white truncate">
                            {user.displayName}
                          </span>
                          {user.isVerified && (
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
                          {user.isBanned && (
                            <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px] px-1.5 py-0 h-4">
                              BANNED
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-white/40">
                          @{user.username}
                        </p>
                      </div>

                      {/* Action buttons */}
                      {!isWildfire && (
                        <div className="flex gap-1.5 flex-shrink-0">
                          {/* Verify toggle */}
                          <button
                            type="button"
                            onClick={() => handleVerify(user)}
                            disabled={!!busy}
                            title={
                              user.isVerified
                                ? "Remove verified"
                                : "Grant verified"
                            }
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all disabled:opacity-50 ${
                              user.isVerified
                                ? "bg-blue-500 text-white shadow-md shadow-blue-500/40"
                                : "bg-white/10 text-white/50 hover:bg-blue-500/30 hover:text-blue-400"
                            }`}
                            data-ocid={`admin.toggle.${i + 1}`}
                          >
                            {busy === "verify" ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : user.isVerified ? (
                              <UserCheck className="h-3.5 w-3.5" />
                            ) : (
                              <ShieldCheck className="h-3.5 w-3.5" />
                            )}
                          </button>

                          {/* Ban toggle */}
                          <button
                            type="button"
                            onClick={() => handleBan(user)}
                            disabled={!!busy}
                            title={user.isBanned ? "Unban user" : "Ban user"}
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all disabled:opacity-50 ${
                              user.isBanned
                                ? "bg-red-500 text-white shadow-md shadow-red-500/40"
                                : "bg-white/10 text-white/50 hover:bg-red-500/30 hover:text-red-400"
                            }`}
                            data-ocid={`admin.delete_button.${i + 1}`}
                          >
                            {busy === "ban" ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : user.isBanned ? (
                              <UserX className="h-3.5 w-3.5" />
                            ) : (
                              <ShieldOff className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      )}

                      {isWildfire && (
                        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] flex-shrink-0">
                          ADMIN
                        </Badge>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex-shrink-0">
          <Button
            onClick={onClose}
            className="w-full rounded-xl bg-white/10 text-white hover:bg-white/20 border-0"
            data-ocid="admin.close_button"
          >
            Close Admin Panel
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
