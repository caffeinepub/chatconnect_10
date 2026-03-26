import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useNavigate } from "@tanstack/react-router";
import { Loader2, MessageCircle } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useActor } from "../hooks/useActor";
import { useLocalAuth } from "../hooks/useLocalAuth";

export default function LoginPage() {
  const navigate = useNavigate();
  const { loginLocal, isLocalLoggedIn } = useLocalAuth();
  const { actor, isFetching: actorLoading } = useActor();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isLocalLoggedIn) navigate({ to: "/lobby" });
  }, [isLocalLoggedIn, navigate]);

  const handleLocalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      toast.error("Please fill in all fields");
      return;
    }
    if (!actor) {
      toast.error(
        "Still connecting to server, please wait a moment and try again",
      );
      return;
    }
    setIsSubmitting(true);
    try {
      const passwordHash = btoa(`${username}:${password}`);
      await loginLocal(username, passwordHash);
      toast.success("Welcome back! 👋");
      navigate({ to: "/lobby" });
    } catch (err: any) {
      const msg = (err?.message || "").toLowerCase();
      if (
        msg.includes("invalid") ||
        msg.includes("not found") ||
        msg.includes("password")
      ) {
        toast.error("Wrong username or password");
      } else if (msg.includes("stopped") || msg.includes("ic0508")) {
        toast.error(
          "Server is temporarily unavailable. Please try again in a moment.",
        );
      } else if (msg.includes("actor not available")) {
        toast.error("Not connected yet. Please wait a moment and try again.");
      } else {
        toast.error(`Login failed: ${err?.message || "unknown error"}`);
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
            Welcome back
          </h1>
          <p className="text-muted-foreground">
            Sign in with your username and password to join the lobby
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
            onSubmit={handleLocalLogin}
            className="space-y-5"
            data-ocid="login.local_form"
          >
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                placeholder="Your username"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                className="rounded-xl text-base"
                data-ocid="login.input"
                autoComplete="username"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-xl text-base"
                data-ocid="login.input"
                autoComplete="current-password"
              />
            </div>
            <Button
              type="submit"
              disabled={isSubmitting || isConnecting}
              className="w-full rounded-full py-6 text-base font-semibold btn-orange"
              data-ocid="login.submit_button"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                  Connecting...
                </>
              ) : isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Logging
                  in...
                </>
              ) : (
                "Log In"
              )}
            </Button>
          </form>

          <p className="text-center text-muted-foreground text-sm mt-6">
            Don&apos;t have an account?{" "}
            <Link
              to="/signup"
              className="text-primary font-semibold hover:underline"
              data-ocid="login.link"
            >
              Sign up free
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
