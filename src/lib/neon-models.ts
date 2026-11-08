// Client-safe description of Neon's three models. Server-only routing lives in
// neon-models.server.ts.
export const NEON_MODEL_IDS = ["neon-lite", "neon-3.1", "neon-7.3"] as const;

export type NeonModelId = (typeof NEON_MODEL_IDS)[number];

export type NeonModel = {
  id: NeonModelId;
  label: string;
  tagline: string;
};

export const NEON_MODELS: readonly NeonModel[] = [
  { id: "neon-lite", label: "Neon-Lite", tagline: "Very quick answers" },
  { id: "neon-3.1", label: "Neon 3.1", tagline: "Quick and detailed" },
  { id: "neon-7.3", label: "Neon 7.3", tagline: "Extremely detailed responses" },
];

export const DEFAULT_NEON_MODEL: NeonModelId = "neon-3.1";

export function isNeonModelId(value: unknown): value is NeonModelId {
  return typeof value === "string" && (NEON_MODEL_IDS as readonly string[]).includes(value);
}

export function getNeonModel(id: string | null | undefined): NeonModel {
  return NEON_MODELS.find((m) => m.id === id) ?? NEON_MODELS.find((m) => m.id === DEFAULT_NEON_MODEL)!;
}
