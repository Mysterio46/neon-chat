import { describe, expect, it } from "vitest";

import { NEON_ROUTING, neonProviderOptions } from "@/lib/neon-models.server";

// Speed rule: Neon-Lite answers in under 1 second, every model starts in under 3 seconds.
describe("Neon speed settings", () => {
  it("Neon-Lite runs with reasoning off", () => {
    expect(NEON_ROUTING["neon-lite"].reasoningEffort).toBeNull();
    expect(neonProviderOptions("neon-lite")).toEqual({ store: false });
  });

  it("Neon 3.1 uses low reasoning effort", () => {
    expect(NEON_ROUTING["neon-3.1"].reasoningEffort).toBe("low");
  });

  it("Neon 7.3 uses low reasoning effort", () => {
    expect(NEON_ROUTING["neon-7.3"].reasoningEffort).toBe("low");
  });
});
