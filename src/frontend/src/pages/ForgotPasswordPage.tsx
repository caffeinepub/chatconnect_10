import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, Loader2, MessageCircle } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import type { backendInterface as BackendInterface } from "../backend.d";
import { useActor } from "../hooks/useActor";
import { useLocalAuth } from "../hooks/useLocalAuth";

export default function ForgotPasswordPage() {
  const { localSession, isLocalLoggedIn } = useLocalAuth();
  const { actor } = useActor();
  const extActor = actor as unknown as BackendInterface | null;

  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Please enter your email address");
      return;
    }
    if (!email.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }

    if (!isLocalLoggedIn || !localSession || !extActor) {
      // Not logged in — just show the contact message
      setIsSubmitted(true);
      return;
    }

    setIsSubmitting(true);
    try {
      await extActor.setUserEmail(localSession.token, email.trim());
      setIsSubmitted(true);
    } catch {
      toast.error("Failed to save email. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Logo / header */}
        <div className="text-center mb-8">
          <Link to="/">
            <div className="inline-flex items-center gap-2 mb-6">
              <div className="w-10 h-10 rounded-xl gradient-hero flex items-center justify-center">
                <MessageCircle className="h-5 w-5 text-white" />
              </div>
              <span className="font-display font-bold text-2xl text-foreground">
                Wave Chat
              </span>
            </div>
          </Link>
          <h1 className="font-display font-bold text-3xl text-foreground mb-2">
            Forgot Password
          </h1>
          <p className="text-muted-foreground text-sm">
            Enter the email address on your account. If we find it, an admin can
            reset your password.
          </p>
        </div>

        <div className="bg-card rounded-4xl p-8 shadow-card border border-border">
          {isSubmitted ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center gap-4 py-4 text-center"
              data-ocid="forgot-password.success_state"
            >
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
              <div>
                <p className="font-semibold text-foreground mb-2">
                  {isLocalLoggedIn
                    ? "Email saved successfully!"
                    : "Request received"}
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {isLocalLoggedIn
                    ? "Your email has been saved. Contact the admin at "
                    : "Please contact the admin at "}
                  <a
                    href="mailto:srklimon3@gmail.com"
                    className="text-primary hover:underline font-medium"
                  >
                    srklimon3@gmail.com
                  </a>
                  {isLocalLoggedIn
                    ? " to request a password reset."
                    : ` to reset your password${localSession?.username ? ` for account: ${localSession.username}` : ""}.`}
                </p>
              </div>
              <Link
                to="/login"
                className="text-sm text-primary font-semibold hover:underline mt-2"
                data-ocid="forgot-password.link"
              >
                Back to Login
              </Link>
            </motion.div>
          ) : (
            <>
              {!isLocalLoggedIn && (
                <div className="mb-5 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    <strong>Not logged in?</strong> You can still save your
                    email below, or contact the admin directly at{" "}
                    <a
                      href="mailto:srklimon3@gmail.com"
                      className="underline font-medium"
                    >
                      srklimon3@gmail.com
                    </a>
                    .
                  </p>
                </div>
              )}

              <form
                onSubmit={handleSubmit}
                className="space-y-5"
                data-ocid="forgot-password.modal"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="rounded-xl text-base"
                    data-ocid="forgot-password.input"
                    autoComplete="email"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-full py-6 text-base font-semibold btn-orange"
                  data-ocid="forgot-password.submit_button"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Submit"
                  )}
                </Button>
              </form>

              <div className="text-center mt-6">
                <Link
                  to="/login"
                  className="text-sm text-muted-foreground hover:text-primary underline-offset-4 hover:underline transition-colors"
                  data-ocid="forgot-password.link"
                >
                  ← Back to Login
                </Link>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
