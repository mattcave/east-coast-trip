import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { POST } from "./route.js";

const COOKIE_NAME = "session";

beforeEach(() => {
  vi.stubEnv("SESSION_SECRET", "test-secret");
  vi.stubEnv("ADMIN_PASSWORD", "correct-password");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function loginRequest(body) {
  return new Request("http://localhost/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/login", () => {
  it("returns 200 and sets a session cookie for the correct password", async () => {
    const response = await POST(loginRequest({ password: "correct-password" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Set-Cookie")).toContain(COOKIE_NAME);
  });

  it("sets the cookie as HttpOnly", async () => {
    const response = await POST(loginRequest({ password: "correct-password" }));
    expect(response.headers.get("Set-Cookie")).toContain("HttpOnly");
  });

  it("sets the cookie as SameSite=Strict", async () => {
    const response = await POST(loginRequest({ password: "correct-password" }));
    expect(response.headers.get("Set-Cookie")).toContain("SameSite=Strict");
  });

  it("sets the cookie Max-Age to 30 days", async () => {
    const response = await POST(loginRequest({ password: "correct-password" }));
    expect(response.headers.get("Set-Cookie")).toContain("Max-Age=2592000");
  });

  it("returns 401 for a wrong password", async () => {
    const response = await POST(loginRequest({ password: "wrong-password" }));
    expect(response.status).toBe(401);
  });

  it("does not set a cookie on a failed login", async () => {
    const response = await POST(loginRequest({ password: "wrong-password" }));
    expect(response.headers.get("Set-Cookie")).toBeNull();
  });

  it("returns 401 when password is missing", async () => {
    const response = await POST(loginRequest({}));
    expect(response.status).toBe(401);
  });
});
