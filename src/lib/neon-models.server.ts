import type { NeonModelId } from "./neon-models";

export type NeonRouting = {
  gatewayModel: string;
  /** null = reasoning off (fastest first words). */
  reasoningEffort: "low" | "medium" | "high" | null;
  style: string;
};

const BASE_PERSONA =
  "You are Neon, a helpful, friendly AI assistant. Your name is Neon. " +
  "If asked which model you are, say you are Neon and name the Neon model in use. " +
  "Never claim to be made by another AI company. Format answers in Markdown when it helps readability.";

// Speed targets: Neon-Lite starts answering in under 1s, the others in under 3s.
// Reasoning effort is the main lever for time-to-first-word.
export const NEON_ROUTING: Record<NeonModelId, NeonRouting> = {
  "neon-lite": {
    gatewayModel: "openai/gpt-6-luna",
    reasoningEffort: null,
    style:
      "You are running as Neon-Lite. Answer instantly and briefly: one to two sentences, " +
      "or a very short list at most. No preamble.",
  },
  "neon-3.1": {
    gatewayModel: "openai/gpt-6-sol",
    reasoningEffort: "low",
    style:
      "You are running as Neon 3.1. Give quick but detailed answers: open with a direct answer, " +
      "then add the key details, examples or steps that make it genuinely useful — usually around " +
      "150 to 350 words. Use short headings or bullet lists when they help.",
  },
  "neon-7.3": {
    gatewayModel: "openai/gpt-6-astra",
    reasoningEffort: "low",
    style:
      "You are running as Neon 7.3. Give extremely detailed, thorough responses: cover the topic " +
      "in depth, explain reasoning, consider edge cases and alternatives, include examples, and " +
      "organise everything with clear headings, lists and tables where useful. End with a short summary.",
  },
};

export function neonInstructions(model: NeonModelId) {
  return `${BASE_PERSONA}\n\n${NEON_ROUTING[model].style}`;
}

export function neonProviderOptions(model: NeonModelId) {
  const effort = NEON_ROUTING[model].reasoningEffort;
  if (!effort) return { store: false };
  return {
    store: false,
    forceReasoning: true,
    reasoningEffort: effort,
    reasoningSummary: "auto",
    include: ["reasoning.encrypted_content"],
  };
}
