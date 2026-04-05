import { Toaster } from "@/components/ui/sonner";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { createRootRoute, createRoute } from "@tanstack/react-router";
import { GlobalEffects } from "./components/GlobalEffects";
import { ServerStatusBanner } from "./components/ServerStatusBanner";
import { ThemeProvider } from "./contexts/ThemeContext";
import CallScreen from "./pages/CallScreen";
import CallingCardsPage from "./pages/CallingCardsPage";
import FeedPage from "./pages/FeedPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import LandingPage from "./pages/LandingPage";
import LobbyPage from "./pages/LobbyPage";
import LoginPage from "./pages/LoginPage";
import MatchesPage from "./pages/MatchesPage";
import MessagesPage from "./pages/MessagesPage";
import MyProfilePage from "./pages/MyProfilePage";
import NotificationsPage from "./pages/NotificationsPage";
import ProfileSetupPage from "./pages/ProfileSetupPage";
import SignupPage from "./pages/SignupPage";
import VideoCallScreen from "./pages/VideoCallScreen";

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
  validateSearch: (search: Record<string, unknown>): { room?: string } => ({
    room: typeof search.room === "string" ? search.room : undefined,
  }),
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

const notificationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/notifications",
  component: NotificationsPage,
});

const videoCallRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/video-call/$callId",
  component: VideoCallScreen,
});

const forgotPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/forgot-password",
  component: ForgotPasswordPage,
});

const matchesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/matches",
  component: MatchesPage,
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
  notificationsRoute,
  videoCallRoute,
  forgotPasswordRoute,
  matchesRoute,
]);

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export default function App() {
  return (
    <ThemeProvider>
      <ServerStatusBanner />
      <RouterProvider router={router} />
      <GlobalEffects />
      <Toaster richColors position="top-right" />
    </ThemeProvider>
  );
}
