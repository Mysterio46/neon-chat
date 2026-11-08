import { useCallback, useState } from "react";

import { DEFAULT_NEON_MODEL, isNeonModelId, type NeonModelId } from "@/lib/neon-models";

const KEY = "neon:model";

function readStored(): NeonModelId {
  if (typeof window === "undefined") return DEFAULT_NEON_MODEL;
  const v = window.localStorage.getItem(KEY);
  return isNeonModelId(v) ? v : DEFAULT_NEON_MODEL;
}

// Remembers the last chosen Neon model. Only used inside signed-in, client-rendered pages.
export function useNeonModel(initial?: NeonModelId) {
  const [model, setModelState] = useState<NeonModelId>(() => initial ?? readStored());
  const setModel = useCallback((id: NeonModelId) => {
    setModelState(id);
    window.localStorage.setItem(KEY, id);
  }, []);
  return [model, setModel] as const;
}
