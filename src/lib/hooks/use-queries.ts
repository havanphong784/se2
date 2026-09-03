"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth-provider";
import type { LearningData, DataSource } from "@/lib/data";
import type { Streak, VocabularyDeck } from "@/lib/demo-data";

export type LearningApiResponse = {
  data: LearningData;
  source: DataSource;
  user: { id: string; displayName: string; email: string };
};

export function useLearningData() {
  const { user, authFetch } = useAuth();
  return useQuery({
    queryKey: ["learning-data", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const res = await authFetch("/api/learning");
      if (!res.ok) throw new Error("Failed to fetch learning data");
      return (await res.json()) as LearningApiResponse;
    },
  });
}

export function useDeck(slug: string) {
  const { user, authFetch } = useAuth();
  return useQuery({
    queryKey: ["deck", slug, user?.id],
    enabled: Boolean(user && slug),
    queryFn: async () => {
      const res = await authFetch(`/api/decks/${slug}`);
      if (!res.ok) throw new Error("Failed to fetch deck");
      const data = await res.json();
      return {
        deck: data.deck as VocabularyDeck | null,
        source: (data.meta?.source ?? "database") as DataSource,
      };
    },
  });
}

export function useStreak() {
  const { user, authFetch } = useAuth();
  return useQuery({
    queryKey: ["streak", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const res = await authFetch("/api/streak");
      if (!res.ok) throw new Error("Failed to fetch streak");
      const data = await res.json();
      return (data.streak as Streak) ?? { current: 0, best: 0, status: "broken" };
    },
  });
}

export function useDecks() {
  const { user, authFetch } = useAuth();
  return useQuery({
    queryKey: ["decks", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const res = await authFetch("/api/decks");
      if (!res.ok) throw new Error("Failed to fetch decks");
      const data = await res.json();
      return (data.decks as VocabularyDeck[]) ?? [];
    },
  });
}

export function useInvalidateAuthData() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return () => {
    if (!user) return;
    queryClient.invalidateQueries({ queryKey: ["learning-data", user.id] });
    queryClient.invalidateQueries({ queryKey: ["deck"] });
    queryClient.invalidateQueries({ queryKey: ["streak", user.id] });
    queryClient.invalidateQueries({ queryKey: ["decks", user.id] });
  };
}
