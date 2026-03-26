import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useNavigate } from "@tanstack/react-router";
import { Camera, Loader2, MessageCircle, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ExternalBlob } from "../backend";
import type { backendInterface as ExtendedBackend } from "../backend.d";
import { useActor } from "../hooks/useActor";

const AVATAR_GRADIENTS = [
  "from-purple-500 to-indigo-600",
  "from-teal-400 to-cyan-500",
  "from-orange-400 to-pink-500",
  "from-emerald-400 to-teal-500",
  "from-rose-400 to-purple-500",
];

export default function SignupPage() {
  const navigate = useNavigate();
  const { actor, isFetching: actorLoading } = useActor();
  const extActor = actor as unknown as ExtendedBackend | null;

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [age, setAge] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [selectedAvatar, setSelectedAvatar] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!displayName.trim()) errs.displayName = "Display name is required";
    if (!username.trim()) errs.username = "Username is required";
    else if (!/^[a-z0-9_]+$/.test(username))
      errs.username = "Lowercase letters, numbers, underscores only";
    if (!password) errs.password = "Password is required";
    else if (password.length < 6)
      errs.password = "Password must be at least 6 characters";
    if (password !== confirmPassword)
      errs.confirmPassword = "Passwords do not match";
    if (!age) errs.age = "Age is required";
    else {
      const ageNum = Number(age);
      if (ageNum < 13 || ageNum > 120) errs.age = "Age must be between 13-120";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (!extActor) {
      toast.error(
        "Still connecting to server, please wait a moment and try again",
      );
      return;
    }
    setIsSubmitting(true);
    try {
      const passwordHash = btoa(`${username}:${password}`);
      let photoBlob: ExternalBlob | null = null;
      if (photoFile) {
        const arrayBuffer = await photoFile.arrayBuffer();
        photoBlob = ExternalBlob.fromBytes(new Uint8Array(arrayBuffer));
      }
      await extActor.registerLocalAccount(
        username,
        passwordHash,
        displayName,
        BigInt(age),
        photoBlob,
      );
      const token = await extActor.loginLocalAccount(username, passwordHash);
      localStorage.setItem(
        "localSession",
        JSON.stringify({
          token: token.toString(),
          username,
          displayName,
        }),
      );
      toast.success("Account created! Welcome to ChatConnect 🎉");
      navigate({ to: "/lobby" });
    } catch (err: any) {
      const msg = (err?.message || "").toLowerCase();
      if (msg.includes("already")) {
        toast.error("Username already taken, please choose another");
      } else if (msg.includes("stopped") || msg.includes("ic0508")) {
        toast.error(
          "Server is temporarily unavailable. Please try again in a moment.",
        );
      } else {
        toast.error(`Signup failed: ${err?.message || "unknown error"}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isConnecting = actorLoading && !actor;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <Link to="/">
            <div className="inline-flex items-center gap-2 mb-6">
              <div className="w-10 h-10 rounded-xl gradient-hero flex items-center justify-center">
                <MessageCircle className="h-5 w-5 text-white" />
              </div>
              <span className="font-display font-bold text-2xl text-foreground">
                ChatConnect
              </span>
            </div>
          </Link>
          <h1 className="font-display font-bold text-3xl text-foreground mb-2">
            Create your account
          </h1>
          <p className="text-muted-foreground">
            Fill in your details below — takes less than a minute
          </p>
        </div>

        <div className="bg-white rounded-4xl p-8 shadow-card border border-border">
          {isConnecting && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4 p-3 bg-muted/50 rounded-xl">
              <Loader2 className="h-4 w-4 animate-spin" />
              Connecting to server...
            </div>
          )}
          <form
            onSubmit={handleSignup}
            className="space-y-4"
            data-ocid="signup.local_form"
          >
            {/* Profile Pic */}
            <div className="flex flex-col items-center gap-3 mb-2">
              <div className="relative">
                <button
                  type="button"
                  className="w-20 h-20 rounded-full overflow-hidden border-4 border-border hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary"
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) =>
                    e.key === "Enter" && fileInputRef.current?.click()
                  }
                  aria-label="Choose profile photo"
                  data-ocid="signup.upload_button"
                >
                  {photoPreview ? (
                    <img
                      src={photoPreview}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className={`w-full h-full bg-gradient-to-br ${AVATAR_GRADIENTS[selectedAvatar]} flex items-center justify-center text-white text-2xl font-bold`}
                    >
                      {displayName
                        ? displayName.slice(0, 2).toUpperCase()
                        : "👤"}
                    </div>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary rounded-full flex items-center justify-center text-white shadow-md hover:bg-primary/80 transition-colors pointer-events-none"
                  aria-hidden="true"
                  tabIndex={-1}
                >
                  <Camera className="h-3.5 w-3.5" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
              </div>
              {!photoPreview && (
                <div className="flex gap-2">
                  {AVATAR_GRADIENTS.map((g, i) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setSelectedAvatar(i)}
                      className={`w-6 h-6 rounded-full bg-gradient-to-br ${g} transition-all ${
                        selectedAvatar === i
                          ? "ring-2 ring-offset-2 ring-primary scale-110"
                          : "hover:scale-105"
                      }`}
                      title={`Avatar color ${i + 1}`}
                    />
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Upload a photo or pick an avatar color
              </p>
            </div>

            {/* Display Name */}
            <div className="space-y-1.5">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                placeholder="Your full name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="rounded-xl"
                data-ocid="signup.input"
              />
              {errors.displayName && (
                <p
                  className="text-destructive text-xs"
                  data-ocid="signup.error_state"
                >
                  {errors.displayName}
                </p>
              )}
            </div>

            {/* Username */}
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                placeholder="e.g. cooluser123"
                value={username}
                onChange={(e) =>
                  setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))
                }
                className="rounded-xl"
                data-ocid="signup.input"
                autoComplete="username"
              />
              {errors.username && (
                <p
                  className="text-destructive text-xs"
                  data-ocid="signup.error_state"
                >
                  {errors.username}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Min 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-xl"
                data-ocid="signup.input"
                autoComplete="new-password"
              />
              {errors.password && (
                <p
                  className="text-destructive text-xs"
                  data-ocid="signup.error_state"
                >
                  {errors.password}
                </p>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Repeat your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="rounded-xl"
                data-ocid="signup.input"
                autoComplete="new-password"
              />
              {errors.confirmPassword && (
                <p
                  className="text-destructive text-xs"
                  data-ocid="signup.error_state"
                >
                  {errors.confirmPassword}
                </p>
              )}
            </div>

            {/* Age */}
            <div className="space-y-1.5">
              <Label htmlFor="age">Age</Label>
              <Input
                id="age"
                type="number"
                min={13}
                max={120}
                placeholder="Your age"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="rounded-xl"
                data-ocid="signup.input"
              />
              {errors.age && (
                <p
                  className="text-destructive text-xs"
                  data-ocid="signup.error_state"
                >
                  {errors.age}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isSubmitting || isConnecting}
              className="w-full rounded-full py-6 text-base font-semibold btn-orange"
              data-ocid="signup.submit_button"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                  Connecting...
                </>
              ) : isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating
                  Account...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" /> Create Free Account
                </>
              )}
            </Button>
          </form>

          <p className="text-center text-muted-foreground text-sm mt-6">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-primary font-semibold hover:underline"
              data-ocid="signup.link"
            >
              Log in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
