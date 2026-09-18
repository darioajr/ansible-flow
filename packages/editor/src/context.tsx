import { createContext, useContext } from "react";
import { useStore } from "zustand";
import type { EditorStore } from "./store";
export const EditorContext = createContext<EditorStore | null>(null);
export function useEditor() {
  const store = useContext(EditorContext);
  if (!store) throw new Error("Missing editor provider");
  return useStore(store);
}
