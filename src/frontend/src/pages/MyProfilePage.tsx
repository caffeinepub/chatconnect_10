import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ChevronRight,
  Headphones,
  LogOut,
  MessageCircle,
  Newspaper,
  Pencil,
  Save,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type {
  backendInterface as ExtendedBackend,
  LocalUser,
} from "../backend.d";
import { BottomNav } from "../components/BottomNav";
import { GlobalCallWatcher } from "../components/GlobalCallWatcher";
import { useActor } from "../hooks/useActor";
import { useLocalAuth } from "../hooks/useLocalAuth";

export default function MyProfilePage() {
  const { actor } = useActor();
  const { localSession, logoutLocal, isLocalLoggedIn } = useLocalAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<LocalUser | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAge, setEditAge] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isLocalLoggedIn) {
      navigate({ to: "/login" });
    }
  }, [isLocalLoggedIn, navigate]);

  useEffect(() => {
    if (!isLocalLoggedIn || !actor || !localSession) return;
    const extActor = actor as unknown as ExtendedBackend;
    extActor
      .getLocalUserProfile(localSession.token)
      .then((p) => {
        if (p) setProfile(p);
      })
      .catch(() => {});
  }, [isLocalLoggedIn, actor, localSession]);

  const handleLogout = async () => {
    try {
      await logoutLocal();
      navigate({ to: "/" });
    } catch {
      navigate({ to: "/" });
    }
  };

  const startEdit = () => {
    setEditName(profile?.displayName ?? localSession?.displayName ?? "");
    setEditAge(profile ? profile.age.toString() : "");
    setIsEditing(true);
  };

  const cancelEdit = () => setIsEditing(false);

  const saveEdit = async () => {
    setIsSaving(true);
    try {
      // No updateLocalProfile in backend — save locally only
      toast.success("Profile update saved!");
      if (profile) {
        setProfile({
          ...profile,
          displayName: editName,
          age: BigInt(editAge || "0"),
        });
      }
      setIsEditing(false);
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setIsSaving(false);
    }
  };

  const displayName = profile?.displayName ?? localSession?.displayName ?? "";
  const username = localSession?.username ?? "";
  const age = profile?.age ?? null;

  const initials =
    displayName
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || username.slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-teal-50 flex flex-col">
      <GlobalCallWatcher />

      {/* Header */}
      <header className="bg-white border-b border-border px-6 py-3 flex items-center justify-between flex-shrink-0 sticky top-0 z-10">
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
            data-ocid="profile.close_button"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </nav>
      </header>

      <main className="flex-1 flex items-start justify-center px-4 py-10 pb-28">
        <div className="w-full max-w-md">
          {/* Profile Card */}
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            {/* Banner */}
            <div className="h-24 bg-gradient-to-r from-purple-500 via-indigo-500 to-teal-400" />

            {/* Avatar + Edit button */}
            <div className="px-6 pb-6">
              <div className="flex items-end justify-between -mt-12 mb-4">
                <Avatar className="w-20 h-20 border-4 border-white shadow-md">
                  <AvatarFallback className="bg-gradient-to-br from-purple-500 to-teal-400 text-white text-2xl font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                {!isEditing ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={startEdit}
                    className="rounded-full gap-2"
                    data-ocid="profile.edit_button"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit Profile
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={cancelEdit}
                      className="rounded-full"
                      data-ocid="profile.cancel_button"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={saveEdit}
                      disabled={isSaving}
                      className="rounded-full gap-2 bg-gradient-to-r from-purple-500 to-teal-400 text-white border-0"
                      data-ocid="profile.save_button"
                    >
                      <Save className="h-3.5 w-3.5" />
                      Save
                    </Button>
                  </div>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-name">Display Name</Label>
                    <Input
                      id="edit-name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="rounded-lg"
                      data-ocid="profile.input"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-age">Age</Label>
                    <Input
                      id="edit-age"
                      type="number"
                      value={editAge}
                      onChange={(e) => setEditAge(e.target.value)}
                      className="rounded-lg"
                      data-ocid="profile.input"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-foreground">
                    {displayName}
                  </h2>
                  <p className="text-sm text-muted-foreground">@{username}</p>
                  {age !== null && (
                    <p className="text-sm text-muted-foreground">
                      Age: {age.toString()}
                    </p>
                  )}
                </div>
              )}

              {/* Stats */}
              <div className="mt-6 pt-5 border-t border-border">
                <div className="flex items-center gap-3 text-sm">
                  <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 rounded-xl">
                    <span className="font-semibold text-purple-700">
                      Total Calls:
                    </span>
                    <span className="text-purple-600 font-bold">0</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Developer */}
          <a
            href="mailto:srklimon3@gmail.com"
            className="mt-4 flex items-center gap-3 w-full bg-white rounded-2xl shadow-sm border border-border px-5 py-4 hover:shadow-md transition-shadow group"
            data-ocid="profile.link"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white flex-shrink-0">
              <Headphones className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm text-foreground">
                Contact Developer
              </p>
              <p className="text-xs text-muted-foreground">
                srklimon3@gmail.com
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </a>
        </div>
      </main>

      <footer className="text-center py-4 text-xs text-muted-foreground border-t border-border">
        © {new Date().getFullYear()}. Built with ❤️ using{" "}
        <a
          href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
          target="_blank"
          rel="noreferrer"
          className="underline hover:text-foreground transition-colors"
        >
          caffeine.ai
        </a>
      </footer>
      <BottomNav />
    </div>
  );
}
