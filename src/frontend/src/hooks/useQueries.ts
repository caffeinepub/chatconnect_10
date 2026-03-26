import type { Principal } from "@icp-sdk/core/principal";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CallRequest,
  backendInterface as ExtendedBackend,
  LocalCallRequest,
  Message,
  Post,
  SessionToken,
  User,
  UserProfile,
} from "../backend.d";
import { useActor } from "./useActor";

export function useGetCallerUserProfile() {
  const { actor, isFetching: actorFetching } = useActor();

  const query = useQuery<UserProfile | null>({
    queryKey: ["currentUserProfile"],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not available");
      return actor.getCallerUserProfile();
    },
    enabled: !!actor && !actorFetching,
    retry: false,
  });

  return {
    ...query,
    isLoading: actorFetching || query.isLoading,
    isFetched: !!actor && query.isFetched,
  };
}

export function useGetMessages() {
  const { actor, isFetching } = useActor();
  return useQuery<Message[]>({
    queryKey: ["messages"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getMessages();
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 3000,
  });
}

export function useSendMessage() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (text: string) => {
      if (!actor) throw new Error("Not connected");
      return (actor as unknown as ExtendedBackend).sendMessage(text);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
  });
}

export function useGetUsers() {
  const { actor, isFetching } = useActor();
  return useQuery<User[]>({
    queryKey: ["users"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getUsers();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetUserProfile(principal: Principal | undefined) {
  const { actor, isFetching } = useActor();
  return useQuery<UserProfile | null>({
    queryKey: ["userProfile", principal?.toString()],
    queryFn: async () => {
      if (!actor || !principal) return null;
      return actor.getUserProfile(principal);
    },
    enabled: !!actor && !isFetching && !!principal,
  });
}

export function useSendCallRequest() {
  const { actor } = useActor();
  return useMutation({
    mutationFn: async (callee: Principal) => {
      if (!actor) throw new Error("Not connected");
      return (actor as unknown as ExtendedBackend).sendCallRequest(callee);
    },
  });
}

export function useGetCallRequests() {
  const { actor, isFetching } = useActor();
  return useQuery<CallRequest[]>({
    queryKey: ["callRequests"],
    queryFn: async () => {
      if (!actor) return [];
      return (actor as unknown as ExtendedBackend).getCallRequests();
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 5000,
  });
}

export function useDeleteCallRequest() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: bigint) => {
      if (!actor) throw new Error("Not connected");
      return (actor as unknown as ExtendedBackend).deleteCallRequest(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["callRequests"] });
    },
  });
}

export function useCreateUser() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      fname: string;
      telephone: string;
    }) => {
      if (!actor) throw new Error("Not connected");
      await actor.createUser(data.name, data.fname, data.telephone);
      await actor.verifyUser();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currentUserProfile"] });
    },
  });
}

export function useUpdateUser() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      fname: string;
      telephone: string;
    }) => {
      if (!actor) throw new Error("Not connected");
      return (actor as any).updateUserWithoutPhoto(
        data.name,
        data.fname,
        data.telephone,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currentUserProfile"] });
    },
  });
}

type ActorWithPosts = {
  getPosts(): Promise<Post[]>;
  createPost(text: string): Promise<bigint>;
  getPostsAsLocal(token: SessionToken): Promise<Post[]>;
  createPostAsLocal(token: SessionToken, text: string): Promise<bigint>;
};

export function useGetPosts() {
  const { actor, isFetching } = useActor();
  return useQuery<Post[]>({
    queryKey: ["posts"],
    queryFn: async () => {
      if (!actor) return [];
      return (actor as unknown as ActorWithPosts).getPosts();
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 5000,
  });
}

export function useCreatePost() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (text: string) => {
      if (!actor) throw new Error("Not connected");
      return (actor as unknown as ActorWithPosts).createPost(text);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });
}

// ---- Local call request hooks ----

export function useGetCallRequestsAsLocal(token: SessionToken | undefined) {
  const { actor, isFetching } = useActor();
  const extActor = actor as unknown as ExtendedBackend | null;
  return useQuery<LocalCallRequest[]>({
    queryKey: ["localCallRequests", token?.toString()],
    queryFn: async () => {
      if (!extActor || !token) return [];
      return extActor.getCallRequestsAsLocal(token);
    },
    enabled: !!extActor && !isFetching && !!token,
    refetchInterval: 3000,
  });
}

export function useSendCallRequestAsLocal() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  const extActor = actor as unknown as ExtendedBackend | null;
  return useMutation({
    mutationFn: async ({
      token,
      calleeUsername,
    }: {
      token: SessionToken;
      calleeUsername: string;
    }) => {
      if (!extActor) throw new Error("Not connected");
      return extActor.sendCallRequestAsLocal(token, calleeUsername);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["localCallRequests"] });
    },
  });
}

export function useAcceptCallRequestAsLocal() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  const extActor = actor as unknown as ExtendedBackend | null;
  return useMutation({
    mutationFn: async ({
      token,
      id,
    }: {
      token: SessionToken;
      id: bigint;
    }) => {
      if (!extActor) throw new Error("Not connected");
      return extActor.acceptCallRequestAsLocal(token, id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["localCallRequests"] });
    },
  });
}

export function useDenyCallRequestAsLocal() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  const extActor = actor as unknown as ExtendedBackend | null;
  return useMutation({
    mutationFn: async ({
      token,
      id,
    }: {
      token: SessionToken;
      id: bigint;
    }) => {
      if (!extActor) throw new Error("Not connected");
      return extActor.denyCallRequestAsLocal(token, id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["localCallRequests"] });
    },
  });
}

export function useEndCallAsLocal() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  const extActor = actor as unknown as ExtendedBackend | null;
  return useMutation({
    mutationFn: async ({
      token,
      id,
    }: {
      token: SessionToken;
      id: bigint;
    }) => {
      if (!extActor) throw new Error("Not connected");
      return extActor.endCallAsLocal(token, id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["localCallRequests"] });
    },
  });
}
