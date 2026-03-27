import { Toaster } from "@/components/ui/sonner";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { createRootRoute, createRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { ServerStatusBanner } from "./components/ServerStatusBanner";
import CallScreen from "./pages/CallScreen";
import CallingCardsPage from "./pages/CallingCardsPage";
import FeedPage from "./pages/FeedPage";
import LandingPage from "./pages/LandingPage";
import LobbyPage from "./pages/LobbyPage";
import LoginPage from "./pages/LoginPage";
import MessagesPage from "./pages/MessagesPage";
import MyProfilePage from "./pages/MyProfilePage";
import ProfileSetupPage from "./pages/ProfileSetupPage";
import SignupPage from "./pages/SignupPage";

// Init dark mode from localStorage before first render
const savedDarkMode = localStorage.getItem("wavechat_darkmode");
if (savedDarkMode === "true") {
  document.documentElement.classList.add("dark");
}

const rootRoute = createRootRoute();

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: LandingPage,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
});

const signupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/signup",
  component: SignupPage,
});

const setupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/setup",
  component: ProfileSetupPage,
});

const lobbyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/lobby",
  component: LobbyPage,
});

const cardsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/cards",
  component: CallingCardsPage,
});

const feedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/feed",
  component: FeedPage,
});

const callRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/call/$callId",
  component: CallScreen,
});

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/profile",
  component: MyProfilePage,
});

const messagesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/messages",
  component: MessagesPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  signupRoute,
  setupRoute,
  lobbyRoute,
  cardsRoute,
  feedRoute,
  callRoute,
  profileRoute,
  messagesRoute,
]);

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export default function App() {
  // Sync dark mode class on mount (handles SSR/hydration edge cases)
  useEffect(() => {
    const saved = localStorage.getItem("wavechat_darkmode");
    if (saved === "true") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  return (
    <>
      <ServerStatusBanner />
      <RouterProvider router={router} />
      <Toaster richColors position="top-right" />
    </>
  );
}
