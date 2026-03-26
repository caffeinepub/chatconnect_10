import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "@tanstack/react-router";
import {
  Camera,
  ChevronRight,
  Headphones,
  LogOut,
  Pencil,
  Save,
  Settings,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ExternalBlob } from "../backend";
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
  const extActor = actor as unknown as ExtendedBackend | null;

  const [profile, setProfile] = useState<LocalUser | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAge, setEditAge] = useState("");
  const [editBio, setEditBio] = useState("");
  const [bio, setBio] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Photo state
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Followers / Following
  const [followers, setFollowers] = useState<string[]>([]);
  const [following, setFollowing] = useState<string[]>([]);

  // Settings dialog
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hideFollowers, setHideFollowers] = useState(false);
  const [hideFollowing, setHideFollowing] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (!isLocalLoggedIn) {
      navigate({ to: "/login" });
    }
  }, [isLocalLoggedIn, navigate]);

  useEffect(() => {
    if (!isLocalLoggedIn || !actor || !localSession) return;
    extActor
      ?.getLocalUserProfile(localSession.token)
      .then((p) => {
        if (p) {
          setProfile(p);
          extActor?.getUserBio(p.username).then((b) => setBio(b ?? ""));
        }
      })
      .catch(() => {});
  }, [isLocalLoggedIn, actor, localSession, extActor]);

  // Load followers/following
  useEffect(() => {
    if (!isLocalLoggedIn || !extActor || !localSession) return;
    const username = localSession.username;
    Promise.all([
      extActor.getFollowers(localSession.token, username),
      extActor.getFollowing(localSession.token, username),
    ])
      .then(([f1, f2]) => {
        setFollowers(f1);
        setFollowing(f2);
      })
      .catch(() => {});
  }, [isLocalLoggedIn, extActor, localSession]);

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
    setEditBio(bio);
    setIsEditing(true);
  };

  const cancelEdit = () => setIsEditing(false);

  const saveEdit = async () => {
    if (!extActor || !localSession) return;
    setIsSaving(true);
    try {
      const nameChanged =
        editName !== (profile?.displayName ?? localSession?.displayName ?? "");
      if (nameChanged) {
        const result = await extActor.updateLocalUserDisplayName(
          localSession.token,
          editName,
        );
        if (result.startsWith("locked:")) {
          const days = result.split(":")[1];
          toast.error(`You can change your name again in ${days} days.`);
          setIsSaving(false);
          return;
        }
      }
      await extActor.updateLocalUserBio(localSession.token, editBio);
      setBio(editBio);
      toast.success("Profile updated!");
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

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !extActor || !localSession) return;

    // Show preview immediately
    const objectUrl = URL.createObjectURL(file);
    setPhotoPreview(objectUrl);

    setIsUploadingPhoto(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const photoBlob = ExternalBlob.fromBytes(new Uint8Array(arrayBuffer));
      await extActor.updateLocalUserPhoto(localSession.token, photoBlob);
      toast.success("Profile picture updated!");
      // Refresh profile to get new photo URL
      const updated = await extActor.getLocalUserProfile(localSession.token);
      if (updated) setProfile(updated);
    } catch {
      toast.error("Failed to update profile picture");
      setPhotoPreview(null);
    } finally {
      setIsUploadingPhoto(false);
      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const openSettings = async () => {
    setSettingsOpen(true);
    if (!extActor || !localSession) return;
    try {
      const settings = await extActor.getProfileSettings(localSession.token);
      setHideFollowers(settings.hideFollowers);
      setHideFollowing(settings.hideFollowing);
    } catch {
      // ignore
    }
  };

  const saveSettings = async () => {
    if (!extActor || !localSession) return;
    setSavingSettings(true);
    try {
      await extActor.updateProfileSettings(
        localSession.token,
        hideFollowers,
        hideFollowing,
      );
      toast.success("Settings saved");
      setSettingsOpen(false);
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSavingSettings(false);
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

  // Resolved photo URL: prefer live preview, then saved photo
  const photoUrl = photoPreview ?? profile?.photo?.getDirectURL() ?? null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-teal-50 flex flex-col">
      <GlobalCallWatcher />

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

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

            {/* Avatar + Edit + Settings */}
            <div className="px-6 pb-6">
              <div className="flex items-end justify-between -mt-12 mb-4">
                {/* Clickable avatar */}
                <button
                  type="button"
                  onClick={handleAvatarClick}
                  disabled={isUploadingPhoto}
                  className="relative group focus:outline-none"
                  aria-label="Change profile picture"
                  data-ocid="profile.upload_button"
                >
                  <Avatar className="w-20 h-20 border-4 border-white shadow-md">
                    {photoUrl && (
                      <AvatarImage src={photoUrl} alt={displayName} />
                    )}
                    <AvatarFallback className="bg-gradient-to-br from-purple-500 to-teal-400 text-white text-2xl font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  {/* Camera overlay */}
                  <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    {isUploadingPhoto ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Camera className="h-6 w-6 text-white" />
                    )}
                  </div>
                  {/* Small camera badge */}
                  <div className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-purple-500 border-2 border-white flex items-center justify-center">
                    <Camera className="h-3 w-3 text-white" />
                  </div>
                </button>

                <div className="flex items-center gap-2">
                  {/* Settings gear */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={openSettings}
                    className="rounded-full w-9 h-9 p-0 text-muted-foreground hover:text-foreground"
                    data-ocid="profile.open_modal_button"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
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
                    <p className="text-xs text-muted-foreground">
                      Name can only be changed once every 15 days.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-age">Age</Label>
                    <Input
                      id="edit-age"
                      type="number"
                      value={editAge}
                      onChange={(e) => setEditAge(e.target.value)}
                      className="rounded-lg"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-bio">Bio</Label>
                    <Textarea
                      id="edit-bio"
                      value={editBio}
                      onChange={(e) => setEditBio(e.target.value)}
                      placeholder="Tell others about yourself..."
                      className="rounded-lg resize-none"
                      rows={3}
                      maxLength={150}
                    />
                    <p className="text-xs text-muted-foreground text-right">
                      {editBio.length}/150
                    </p>
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
                  {bio && (
                    <p className="text-sm text-foreground mt-2 leading-relaxed">
                      {bio}
                    </p>
                  )}
                </div>
              )}

              {/* Followers / Following */}
              <div className="flex items-center gap-4 mt-4">
                <div className="text-center">
                  <p className="font-bold text-lg text-foreground">
                    {followers.length}
                  </p>
                  <p className="text-xs text-muted-foreground">Followers</p>
                </div>
                <div className="w-px h-8 bg-border" />
                <div className="text-center">
                  <p className="font-bold text-lg text-foreground">
                    {following.length}
                  </p>
                  <p className="text-xs text-muted-foreground">Following</p>
                </div>
              </div>

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

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent data-ocid="profile.dialog">
          <DialogHeader>
            <DialogTitle>Profile Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Hide follower count</p>
                <p className="text-xs text-muted-foreground">
                  Others can&apos;t see how many followers you have
                </p>
              </div>
              <Switch
                checked={hideFollowers}
                onCheckedChange={setHideFollowers}
                data-ocid="profile.switch"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Hide following count</p>
                <p className="text-xs text-muted-foreground">
                  Others can&apos;t see who you follow
                </p>
              </div>
              <Switch
                checked={hideFollowing}
                onCheckedChange={setHideFollowing}
                data-ocid="profile.switch"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => setSettingsOpen(false)}
              data-ocid="profile.cancel_button"
            >
              Cancel
            </Button>
            <Button
              onClick={saveSettings}
              disabled={savingSettings}
              className="bg-gradient-to-r from-purple-500 to-teal-400 text-white border-0"
              data-ocid="profile.save_button"
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
