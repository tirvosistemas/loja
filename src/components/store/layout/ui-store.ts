"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";

// Estado de interface compartilhado entre o cabeçalho e a barra de abas do celular.

type StoreUiState = {
  menuOpen: boolean;
  /** No celular o cabeçalho se esconde ao rolar para baixo e volta ao rolar para cima. */
  headerHidden: boolean;
  setMenuOpen: (open: boolean) => void;
  setHeaderHidden: (hidden: boolean) => void;
};

export const useStoreUi = create<StoreUiState>()((set) => ({
  menuOpen: false,
  headerHidden: false,
  setMenuOpen: (menuOpen) => set({ menuOpen }),
  setHeaderHidden: (headerHidden) => set({ headerHidden }),
}));

export const MOBILE_SEARCH_ID = "busca-celular";

const noop = () => () => {};

/** true só depois de montar no navegador (evita divergência com o HTML do servidor). */
export function useMounted() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
