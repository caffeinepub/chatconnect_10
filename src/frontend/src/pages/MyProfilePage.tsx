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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "@tanstack/react-router";
import {
  Camera,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Crown,
  Eye,
  Headphones,
  LogOut,
  Moon,
  Pencil,
  Save,
  Settings,
  Shield,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ExternalBlob } from "../backend";
import type {
  backendInterface as ExtendedBackend,
  LocalUser,
} from "../backend.d";
import { AdminPanel } from "../components/AdminPanel";
import { BottomNav } from "../components/BottomNav";
import { GlobalCallWatcher } from "../components/GlobalCallWatcher";
import { type AppTheme, useTheme } from "../contexts/ThemeContext";
import { useActor } from "../hooks/useActor";
import { useLocalAuth } from "../hooks/useLocalAuth";

const STATUS_OPTIONS = [
  { value: "none", label: "No status", color: "" },
  {
    value: "Available for calls",
    label: "Available for calls",
    color: "bg-green-500",
  },
  { value: "Busy", label: "Busy", color: "bg-red-500" },
  { value: "Away", label: "Away", color: "bg-yellow-400" },
  { value: "Do Not Disturb", label: "Do Not Disturb", color: "bg-gray-400" },
];

function statusColor(status: string): string {
  const found = STATUS_OPTIONS.find((s) => s.value === status);
  return found?.color ?? "bg-gray-300";
}

export default function MyProfilePage() {
  const { actor } = useActor();
  const { localSession, logoutLocal, isLocalLoggedIn, sessionValidated } =
    useLocalAuth();
  const navigate = useNavigate();
  const extActor = actor as unknown as ExtendedBackend | null;

  // Support viewing another user's profile via ?user=username
  const [viewingUser, setViewingUser] = useState<string | null>(null);
  const [viewedUserProfile, setViewedUserProfile] = useState<LocalUser | null>(
    null,
  );
  const [viewedUserBio, setViewedUserBio] = useState<string>("");
  const [viewedUserStatus, setViewedUserStatus] = useState<string>("");
  const [viewedUserVerified, setViewedUserVerified] = useState(false);
  const [viewedUserIsAdmin, setViewedUserIsAdmin] = useState(false);

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

  // Admin panel
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);
  const isAdmin = localSession?.username?.toUpperCase() === "WILDFIRE";

  // Settings dialog
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hideFollowers, setHideFollowers] = useState(false);
  const [hideFollowing, setHideFollowing] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Dark mode / theme
  const { theme: currentTheme, setTheme } = useTheme();

  // Profile visitors
  const [visitorCount, setVisitorCount] = useState<number>(0);
  const [visitors, setVisitors] = useState<string[]>([]);
  const [visitorsExpanded, setVisitorsExpanded] = useState(false);

  // Custom status
  const [currentStatus, setCurrentStatus] = useState<string>("none");

  // Read ?user= param from URL to view another user's profile
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const u = params.get("user");
    if (u) setViewingUser(u);
  }, []);

  // Load the viewed user's data when viewingUser is set
  useEffect(() => {
    if (!viewingUser || !extActor) return;
    extActor
      .getLocalUsers()
      .then((users) => {
        const found = users.find(
          (u) => u.username === viewingUser || u.displayName === viewingUser,
        );
        if (found) {
          setViewedUserProfile(found);
          setViewedUserIsAdmin(found.username === "WILDFIRE");
          Promise.all([
            extActor.getUserBio(found.username).catch(() => ""),
            extActor.getUserStatus(found.username).catch(() => ""),
            extActor.isUserVerified(found.username).catch(() => false),
          ]).then(([b, s, v]) => {
            setViewedUserBio(b ?? "");
            setViewedUserStatus(s ?? "");
            setViewedUserVerified(v);
          });
        }
      })
      .catch(() => {});
  }, [viewingUser, extActor]);

  useEffect(() => {
    if (sessionValidated && !isLocalLoggedIn) {
      navigate({ to: "/login" });
    }
  }, [sessionValidated, isLocalLoggedIn, navigate]);

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

  // Load profile visitors
  useEffect(() => {
    if (!isLocalLoggedIn || !extActor || !localSession) return;
    extActor
      .getProfileVisitors(localSession.token, localSession.username)
      .then((result) => {
        setVisitorCount(Number(result.count));
        setVisitors(result.visitors);
      })
      .catch(() => {});
  }, [isLocalLoggedIn, extActor, localSession]);

  // Load custom status
  useEffect(() => {
    if (!isLocalLoggedIn || !extActor || !localSession) return;
    extActor
      .getUserStatus(localSession.username)
      .then((s) => {
        setCurrentStatus(s ?? "none");
      })
      .catch(() => {});
  }, [isLocalLoggedIn, extActor, localSession]);

  const handleStatusChange = async (value: string) => {
    setCurrentStatus(value);
    if (!extActor || !localSession) return;
    try {
      const statusToSave = value === "none" ? "" : value;
      await extActor.setUserStatus(localSession.token, statusToSave);
    } catch {
      // ignore
    }
  };

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

    const objectUrl = URL.createObjectURL(file);
    setPhotoPreview(objectUrl);

    setIsUploadingPhoto(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const photoBlob = ExternalBlob.fromBytes(new Uint8Array(arrayBuffer));
      await extActor.updateLocalUserPhoto(localSession.token, photoBlob);
      toast.success("Profile picture updated!");
      const updated = await extActor.getLocalUserProfile(localSession.token);
      if (updated) setProfile(updated);
    } catch {
      toast.error("Failed to update profile picture");
      setPhotoPreview(null);
    } finally {
      setIsUploadingPhoto(false);
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

  const photoUrl = photoPreview ?? profile?.photo?.getDirectURL() ?? null;

  // --- Read-only view for another user's profile ---
  if (viewingUser && viewedUserProfile) {
    const vp = viewedUserProfile;
    const vpPhoto = vp.photo?.getDirectURL() ?? null;
    const vpInitials =
      vp.displayName.slice(0, 2).toUpperCase() ||
      vp.username.slice(0, 2).toUpperCase();
    const vpGradient = "from-purple-500 to-teal-400";
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-teal-50 dark:from-background dark:via-background dark:to-background flex flex-col">
        <GlobalCallWatcher />
        <header className="bg-background border-b border-border px-6 py-3 flex items-center justify-between flex-shrink-0 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1 as any)}
              className="rounded-full w-8 h-8 flex items-center justify-center hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            <span className="font-display font-bold text-lg">Profile</span>
          </div>
        </header>
        <main className="flex-1 flex items-start justify-center px-4 py-10 pb-28">
          <div className="w-full max-w-md">
            <div className="bg-card rounded-2xl shadow-lg overflow-hidden">
              <div className="h-24 bg-gradient-to-r from-purple-500 via-indigo-500 to-teal-400" />
              <div className="px-6 pb-6">
                <div className="flex items-end justify-between -mt-12 mb-4">
                  <Avatar className="w-20 h-20 border-4 border-white shadow-md">
                    {vpPhoto && (
                      <AvatarImage src={vpPhoto} alt={vp.displayName} />
                    )}
                    <AvatarFallback
                      className={`bg-gradient-to-br ${vpGradient} text-white text-2xl font-bold`}
                    >
                      {vpInitials}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="space-y-1 mb-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-bold">{vp.displayName}</h2>
                    {viewedUserVerified && (
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 flex-shrink-0">
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
                    {viewedUserIsAdmin && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-600 dark:text-amber-400 text-xs font-bold border border-amber-400/30">
                        <Crown className="h-3 w-3" /> Admin
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    @{vp.username}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Age: {vp.age.toString()}
                  </p>
                  {viewedUserStatus && viewedUserStatus !== "" && (
                    <p className="text-xs text-muted-foreground">
                      Status: {viewedUserStatus}
                    </p>
                  )}
                  {viewedUserBio && (
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                      {viewedUserBio}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 mt-4">
                  <Button
                    className="flex-1 bg-gradient-to-r from-purple-500 to-teal-400 text-white border-0"
                    onClick={() => {
                      window.location.href = `/messages?user=${encodeURIComponent(vp.username)}`;
                    }}
                  >
                    Message
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-teal-50 dark:from-background dark:via-background dark:to-background flex flex-col">
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
      <header className="bg-background border-b border-border px-6 py-3 flex items-center justify-between flex-shrink-0 sticky top-0 z-10">
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
          <div className="bg-card rounded-2xl shadow-lg overflow-hidden">
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
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-foreground">
                      {displayName}
                    </h2>
                    {isAdmin && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-bold shadow-md shadow-amber-400/30">
                        <Crown className="h-3 w-3" />
                        Admin
                      </span>
                    )}
                  </div>
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

              {/* Custom status selector */}
              <div className="mt-4">
                <div className="flex items-center gap-2">
                  {currentStatus && currentStatus !== "none" && (
                    <span
                      className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusColor(currentStatus)}`}
                    />
                  )}
                  <Select
                    value={currentStatus}
                    onValueChange={handleStatusChange}
                  >
                    <SelectTrigger
                      className="h-8 text-xs rounded-full border-border/60 bg-muted/40"
                      data-ocid="profile.select"
                    >
                      <SelectValue placeholder="Set a status" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex items-center gap-2">
                            {opt.color && (
                              <span
                                className={`w-2 h-2 rounded-full ${opt.color}`}
                              />
                            )}
                            {opt.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

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
              <div className="mt-6 pt-5 border-t border-border space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                    <span className="font-semibold text-purple-700 dark:text-purple-300">
                      Total Calls:
                    </span>
                    <span className="text-purple-600 dark:text-purple-400 font-bold">
                      0
                    </span>
                  </div>
                </div>

                {/* Profile Views */}
                <div>
                  <button
                    type="button"
                    onClick={() => setVisitorsExpanded((v) => !v)}
                    className="flex items-center gap-2 px-3 py-2 bg-teal-50 dark:bg-teal-900/20 rounded-xl w-full text-left hover:bg-teal-100 dark:hover:bg-teal-900/30 transition-colors"
                    data-ocid="profile.toggle"
                  >
                    <Eye className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                    <span className="font-semibold text-teal-700 dark:text-teal-300 text-sm">
                      Profile Views:
                    </span>
                    <span className="text-teal-600 dark:text-teal-400 font-bold text-sm">
                      {visitorCount}
                    </span>
                    <span className="ml-auto">
                      {visitorsExpanded ? (
                        <ChevronUp className="h-4 w-4 text-teal-500" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-teal-500" />
                      )}
                    </span>
                  </button>
                  {visitorsExpanded && visitors.length > 0 && (
                    <div className="mt-2 px-3 py-2 bg-teal-50/60 dark:bg-teal-900/10 rounded-xl">
                      <p className="text-xs text-muted-foreground mb-1">
                        Visited by:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {visitors.map((v) => (
                          <span
                            key={v}
                            className="text-xs bg-teal-100 dark:bg-teal-800/40 text-teal-800 dark:text-teal-300 px-2 py-0.5 rounded-full"
                          >
                            @{v}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {visitorsExpanded && visitors.length === 0 && (
                    <p className="text-xs text-muted-foreground px-3 pt-2">
                      No visitors yet
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Contact Developer */}
          <a
            href="mailto:srklimon3@gmail.com"
            className="mt-4 flex items-center gap-3 w-full bg-card rounded-2xl shadow-sm border border-border px-5 py-4 hover:shadow-md transition-shadow group"
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

          {/* Admin Panel — WILDFIRE only */}
          {isAdmin && (
            <button
              type="button"
              onClick={() => setAdminPanelOpen(true)}
              className="mt-4 flex items-center gap-3 w-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl shadow-lg shadow-amber-500/30 px-5 py-4 hover:shadow-xl hover:shadow-amber-500/40 transition-all group"
              data-ocid="admin.open_modal_button"
            >
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-bold text-sm text-white">Admin Panel</p>
                <p className="text-xs text-white/70">
                  Manage members &amp; badges
                </p>
              </div>
              <Crown className="h-5 w-5 text-white/80 group-hover:text-white transition-colors" />
            </button>
          )}
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

      {/* Admin Panel */}
      {isAdmin && localSession && (
        <AdminPanel
          open={adminPanelOpen}
          onClose={() => setAdminPanelOpen(false)}
          extActor={extActor}
          token={localSession.token}
        />
      )}

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
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Theme</h4>
              <div className="grid grid-cols-4 gap-2">
                {(
                  [
                    { id: "light", label: "Light", emoji: "☀️" },
                    { id: "dark", label: "Dark", emoji: "🌙" },
                    { id: "raining", label: "Rain", emoji: "🌧️" },
                    { id: "cloudy", label: "Cloudy", emoji: "⛅" },
                    { id: "mountain", label: "Mountain", emoji: "🏔️" },
                    { id: "seawave", label: "Seawave", emoji: "🌊" },
                    { id: "waterfalls", label: "Waterfall", emoji: "💧" },
                    { id: "sunny", label: "Sunny", emoji: "🌤️" },
                  ] as { id: AppTheme; label: string; emoji: string }[]
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTheme(t.id)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs font-medium transition-all ${currentTheme === t.id ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:border-primary/50"}`}
                    data-ocid="profile.toggle"
                  >
                    <span className="text-base">{t.emoji}</span>
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          {isAdmin && (
            <div className="pt-2 border-t border-border">
              <Button
                variant="ghost"
                className="w-full flex items-center gap-2 justify-start text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950"
                onClick={() => {
                  setSettingsOpen(false);
                  setAdminPanelOpen(true);
                }}
                data-ocid="profile.open_modal_button"
              >
                <span>👑</span>
                Admin Dashboard
              </Button>
            </div>
          )}
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
