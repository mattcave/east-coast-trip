import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { generateToken, isValidToken, checkPassword } from "./auth.js";

beforeEach(() => {
  vi.stubEnv("SESSION_SECRET", "test-secret");
  vi.stubEnv("ADMIN_PASSWORD", "correct-password");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("missing env vars", () => {
  it("generateToken rejects if SESSION_SECRET is not set", async () => {
    vi.stubEnv("SESSION_SECRET", "");
    await expect(generateToken()).rejects.toThrow("SESSION_SECRET");
  });

  it("checkPassword throws if ADMIN_PASSWORD is not set", () => {
    vi.stubEnv("ADMIN_PASSWORD", "");
    expect(() => checkPassword("anything")).toThrow("ADMIN_PASSWORD");
  });

  it("isValidToken rejects if SESSION_SECRET is not set", async () => {
    vi.stubEnv("SESSION_SECRET", "");
    await expect(isValidToken("anything")).rejects.toThrow("SESSION_SECRET");
  });
});

describe("generateToken", () => {
  it("returns a hex string", async () => {
    expect(await generateToken()).toMatch(/^[a-f0-9]+$/);
  });

  it("returns the same value on repeated calls with the same secret", async () => {
    expect(await generateToken()).toBe(await generateToken());
  });

  it("returns a different value when the secret changes", async () => {
    const token1 = await generateToken();
    vi.stubEnv("SESSION_SECRET", "different-secret");
    expect(await generateToken()).not.toBe(token1);
  });
});

describe("isValidToken", () => {
  it("returns true for the generated token", async () => {
    expect(await isValidToken(await generateToken())).toBe(true);
  });

  it("returns false for a wrong token", async () => {
    expect(await isValidToken("not-a-valid-token")).toBe(false);
  });

  it("returns false for an empty string", async () => {
    expect(await isValidToken("")).toBe(false);
  });

  it("returns false for undefined", async () => {
    expect(await isValidToken(undefined)).toBe(false);
  });
});

describe("checkPassword", () => {
  it("returns true for the correct password", () => {
    expect(checkPassword("correct-password")).toBe(true);
  });

  it("returns false for a wrong password", () => {
    expect(checkPassword("wrong-password")).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(checkPassword("")).toBe(false);
  });
});
