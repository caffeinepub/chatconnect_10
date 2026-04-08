import {
  createActorWithConfig as _createActorWithConfig,
  loadConfig,
} from "@caffeineai/core-infrastructure";
import type { CreateActorOptions } from "@caffeineai/core-infrastructure";
import { HttpAgent } from "@icp-sdk/core/agent";
import { createActor, ExternalBlob, type backendInterface } from "./backend";

export { loadConfig };

const DEFAULT_STORAGE_GATEWAY_URL = "https://blob.caffeine.ai";
const DEFAULT_BUCKET_NAME = "default-bucket";

function extractAgentErrorMessage(error: string): string {
  const errorString = String(error);
  const match = errorString.match(/with message:\s*'([^']+)'/s);
  return match ? match[1] : errorString;
}

function processError(e: unknown): never {
  if (e && typeof e === "object" && "message" in e) {
    throw new Error(extractAgentErrorMessage(`${(e as { message: string }).message}`));
  }
  throw e;
}

export async function createActorWithConfig(
  options?: CreateActorOptions,
): Promise<backendInterface> {
  // Check for mock backend in test environments
  if (import.meta.env.VITE_USE_MOCK === "true") {
    try {
      const mockModules = import.meta.glob("./mocks/backend.{ts,tsx,js,jsx}");
      const path = Object.keys(mockModules)[0];
      if (path) {
        const mod = (await mockModules[path]()) as { mockBackend?: backendInterface };
        if (mod.mockBackend) return mod.mockBackend;
      }
    } catch {
      // fall through to real backend
    }
  }

  const config = await loadConfig();
  const resolvedOptions = options ?? {};

  const agent = new HttpAgent({
    ...resolvedOptions.agentOptions,
    host: config.backend_host,
  });

  if (config.backend_host?.includes("localhost")) {
    await agent.fetchRootKey().catch(() => {
      console.warn("Unable to fetch root key. Is the local replica running?");
    });
  }

  const storageGatewayUrl =
    config.storage_gateway_url ?? DEFAULT_STORAGE_GATEWAY_URL;
  const bucketName = config.bucket_name ?? DEFAULT_BUCKET_NAME;

  const MOTOKO_DEDUPLICATION_SENTINEL = "!caf!";

  const uploadFile = async (file: ExternalBlob): Promise<Uint8Array> => {
    const bytes = await file.getBytes();
    // Simple upload: if no storage gateway, return sentinel + hash stub
    if (!storageGatewayUrl || storageGatewayUrl === "nogateway") {
      const url = URL.createObjectURL(new Blob([bytes]));
      return new TextEncoder().encode(MOTOKO_DEDUPLICATION_SENTINEL + url);
    }
    const response = await fetch(`${storageGatewayUrl}/upload`, {
      method: "POST",
      body: bytes,
    });
    const { hash } = (await response.json()) as { hash: string };
    return new TextEncoder().encode(MOTOKO_DEDUPLICATION_SENTINEL + hash);
  };

  const downloadFile = async (bytes: Uint8Array): Promise<ExternalBlob> => {
    const hashWithPrefix = new TextDecoder().decode(new Uint8Array(bytes));
    const hash = hashWithPrefix.startsWith(MOTOKO_DEDUPLICATION_SENTINEL)
      ? hashWithPrefix.substring(MOTOKO_DEDUPLICATION_SENTINEL.length)
      : hashWithPrefix;
    const url = hash.startsWith("blob:")
      ? hash
      : `${storageGatewayUrl}/download/${hash}`;
    return ExternalBlob.fromURL(url);
  };

  const actorOptions = {
    ...resolvedOptions,
    agent,
    processError,
  };

  return createActor(
    config.backend_canister_id,
    uploadFile,
    downloadFile,
    actorOptions,
  );
}
