import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "@tanstack/react-router";
import { Check, Loader2, Upload } from "lucide-react";
import { motion } from "motion/react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ExternalBlob } from "../backend";
import { useActor } from "../hooks/useActor";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import { useCreateUser } from "../hooks/useQueries";

const AVATARS = [
  { id: "purple", gradient: "from-purple-500 to-indigo-600" },
  { id: "teal", gradient: "from-teal-400 to-cyan-500" },
  { id: "orange", gradient: "from-orange-400 to-pink-500" },
  { id: "green", gradient: "from-emerald-400 to-teal-500" },
  { id: "rose", gradient: "from-rose-400 to-purple-500" },
];

export default function ProfileSetupPage() {
  const navigate = useNavigate();
  const { identity } = useInternetIdentity();
  const { actor } = useActor();
  const createUser = useCreateUser();

  const [displayName, setDisplayName] = useState("");
  const [age, setAge] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState("purple");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!identity) {
    navigate({ to: "/login" });
    return null;
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || !age.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (Number.isNaN(Number(age)) || Number(age) < 13 || Number(age) > 120) {
      toast.error("Please enter a valid age (13-120)");
      return;
    }

    try {
      await createUser.mutateAsync({
        name: displayName.trim(),
        fname: displayName.trim(),
        telephone: age.trim(),
      });
      if (photoFile && actor) {
        const arrayBuffer = await photoFile.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        const blob = ExternalBlob.fromBytes(bytes).withUploadProgress((pct) =>
          setUploadProgress(pct),
        );
        // updateUser is a Motoko method not in the generated type
        await (actor as any).updateUser(blob);
      }
      toast.success("Profile created! Welcome to WaveChat 🎉");
      navigate({ to: "/lobby" });
    } catch {
      toast.error("Failed to create profile. Please try again.");
    }
  };

  const initials = displayName.slice(0, 2).toUpperCase() || "?";
  const currentAvatar =
    AVATARS.find((a) => a.id === selectedAvatar) ?? AVATARS[0];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-lg"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-10 h-10 rounded-xl gradient-hero flex items-center justify-center text-white font-bold">
              W
            </div>
            <span className="font-display font-bold text-2xl">WaveChat</span>
          </div>
          <h1 className="font-display font-bold text-3xl text-foreground mb-2">
            Set Up Your Profile
          </h1>
          <p className="text-muted-foreground">
            Tell the community who you are
          </p>
        </div>

        <div className="bg-white rounded-4xl p-8 shadow-card border border-border">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex justify-center">
              <div className="relative">
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="Preview"
                    className="w-24 h-24 rounded-full object-cover border-4 border-primary/20"
                  />
                ) : (
                  <div
                    className={`w-24 h-24 rounded-full bg-gradient-to-br ${currentAvatar.gradient} flex items-center justify-center text-white text-2xl font-bold`}
                  >
                    {initials}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center hover:opacity-90 transition-opacity shadow"
                  data-ocid="setup.upload_button"
                >
                  <Upload className="h-3.5 w-3.5" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName" className="font-medium">
                Display Name *
              </Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Alex Rivera"
                className="rounded-xl h-11"
                required
                data-ocid="setup.input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="age" className="font-medium">
                Age *
              </Label>
              <Input
                id="age"
                type="number"
                min="13"
                max="120"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="e.g. 25"
                className="rounded-xl h-11"
                required
                data-ocid="setup.textarea"
              />
            </div>

            <div className="space-y-3">
              <Label className="font-medium">Choose Avatar Color</Label>
              <div className="flex gap-3">
                {AVATARS.map((avatar) => (
                  <button
                    key={avatar.id}
                    type="button"
                    onClick={() => {
                      setSelectedAvatar(avatar.id);
                      setPhotoFile(null);
                      setPhotoPreview(null);
                    }}
                    className={`relative w-12 h-12 rounded-full bg-gradient-to-br ${avatar.gradient} flex items-center justify-center text-white text-sm font-bold transition-all ${
                      selectedAvatar === avatar.id && !photoPreview
                        ? "ring-4 ring-primary ring-offset-2 scale-110"
                        : "hover:scale-105"
                    }`}
                    data-ocid="setup.radio"
                  >
                    {initials || "?"}
                    {selectedAvatar === avatar.id && !photoPreview && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                        <Check className="h-2.5 w-2.5 text-white" />
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Or upload a photo using the button above
              </p>
            </div>

            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="space-y-1" data-ocid="setup.loading_state">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Uploading photo...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            <Button
              type="submit"
              disabled={createUser.isPending}
              className="w-full rounded-full py-6 text-base font-semibold btn-orange"
              data-ocid="setup.submit_button"
            >
              {createUser.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating
                  Profile...
                </>
              ) : (
                "Complete Setup & Enter Lobby"
              )}
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
