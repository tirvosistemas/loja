"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// Favoritos e vistos recentemente, guardados no navegador (ids de produto).

type ListsState = {
  wishlist: string[];
  recent: string[];
  toggleWish: (id: string) => void;
  isWished: (id: string) => boolean;
  pushRecent: (id: string) => void;
};

export const useLists = create<ListsState>()(
  persist(
    (set, get) => ({
      wishlist: [],
      recent: [],
      toggleWish: (id) =>
        set((s) => ({ wishlist: s.wishlist.includes(id) ? s.wishlist.filter((x) => x !== id) : [id, ...s.wishlist].slice(0, 100) })),
      isWished: (id) => get().wishlist.includes(id),
      pushRecent: (id) => set((s) => ({ recent: [id, ...s.recent.filter((x) => x !== id)].slice(0, 16) })),
    }),
    { name: "tirvo-lists", version: 1, storage: createJSONStorage(() => localStorage) },
  ),
);
