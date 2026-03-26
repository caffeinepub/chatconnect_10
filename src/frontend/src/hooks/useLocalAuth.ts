import { useCallback, useEffect, useState } from "react";
import type { backendInterface as ExtendedBackend } from "../backend.d";
import { useActor } from "./useActor";

interface LocalSession {
  token: bigint;
  username: string;
  displayName: string;
}

const SESSION_KEY = "localSession";

function readSession(): LocalSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      token: BigInt(parsed.token),
      username: parsed.username,
      displayName: parsed.displayName,
    };
  } catch {
    return null;
  }
}

function writeSession(session: LocalSession) {
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      token: session.token.toString(),
      username: session.username,
      displayName: session.displayName,
    }),
  );
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function useLocalAuth() {
  const { actor } = useActor();
  const extActor = actor as unknown as ExtendedBackend | null;
  const [localSession, setLocalSession] = useState<LocalSession | null>(
    readSession,
  );

  useEffect(() => {
    setLocalSession(readSession());
  }, []);

  const loginLocal = useCallback(
    async (username: string, passwordHash: string) => {
      if (!extActor) throw new Error("Actor not available");
      const token = await extActor.loginLocalAccount(username, passwordHash);
      const profile = await extActor.getLocalUserProfile(token);
      const displayName = profile?.displayName || username;
      const session: LocalSession = { token, username, displayName };
      writeSession(session);
      setLocalSession(session);
    },
    [extActor],
  );

  const logoutLocal = useCallback(async () => {
    if (extActor && localSession) {
      try {
        await extActor.logoutLocalAccount(localSession.token);
      } catch {
        // ignore
      }
    }
    clearSession();
    setLocalSession(null);
  }, [extActor, localSession]);

  return {
    localSession,
    loginLocal,
    logoutLocal,
    isLocalLoggedIn: localSession !== null,
  };
}
