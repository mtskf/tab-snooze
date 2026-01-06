import { describe, it, expect, vi, afterEach } from "vitest";
import { generateUUID } from "./uuid";

describe("generateUUID", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses crypto.randomUUID when available", () => {
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "fixed-uuid") });

    expect(generateUUID()).toBe("fixed-uuid");
    expect(globalThis.crypto.randomUUID).toHaveBeenCalledTimes(1);
  });

  it("falls back to manual UUID generation when crypto.randomUUID is unavailable", () => {
    vi.stubGlobal("crypto", {});

    const uuid = generateUUID();

    expect(uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });
});
