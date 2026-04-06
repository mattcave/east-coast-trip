import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy.js";
import { generateToken } from "./lib/auth.js";

beforeEach(() => {
  vi.stubEnv("SESSION_SECRET", "test-secret");
  vi.stubEnv("ADMIN_PASSWORD", "correct-password");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

async function makeRequest(path, { method = "GET", token } = {}) {
  const headers = {};
  if (token) headers["cookie"] = `session=${token}`;
  return new NextRequest(`http://localhost${path}`, { method, headers });
}

describe("public routes (no cookie required)", () => {
  it("allows GET /", async () => {
    const response = await proxy(await makeRequest("/"));
    expect(response.status).not.toBe(401);
    expect(response.headers.get("location")).toBeNull();
  });

  it("allows GET /api/pins", async () => {
    const response = await proxy(await makeRequest("/api/pins"));
    expect(response.status).not.toBe(401);
    expect(response.headers.get("location")).toBeNull();
  });

  it("allows GET /login", async () => {
    const response = await proxy(await makeRequest("/login"));
    expect(response.status).not.toBe(401);
    expect(response.headers.get("location")).toBeNull();
  });
});

describe("protected page routes", () => {
  it("redirects /admin to /login without a cookie", async () => {
    const response = await proxy(await makeRequest("/admin"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
  });

  it("redirects /admin/edit to /login without a cookie", async () => {
    const response = await proxy(await makeRequest("/admin/edit"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
  });

  it("allows /admin through with a valid cookie", async () => {
    const response = await proxy(await makeRequest("/admin", { token: await generateToken() }));
    expect(response.status).not.toBe(307);
  });
});

describe("protected API write routes", () => {
  it("blocks POST /api/pins without a cookie", async () => {
    const response = await proxy(await makeRequest("/api/pins", { method: "POST" }));
    expect(response.status).toBe(401);
  });

  it("blocks PATCH /api/pins/1 without a cookie", async () => {
    const response = await proxy(await makeRequest("/api/pins/1", { method: "PATCH" }));
    expect(response.status).toBe(401);
  });

  it("blocks DELETE /api/pins/1 without a cookie", async () => {
    const response = await proxy(await makeRequest("/api/pins/1", { method: "DELETE" }));
    expect(response.status).toBe(401);
  });

  it("allows POST /api/pins with a valid cookie", async () => {
    const response = await proxy(await makeRequest("/api/pins", { method: "POST", token: await generateToken() }));
    expect(response.status).not.toBe(401);
  });

  it("blocks POST /api/pins with an invalid cookie", async () => {
    const response = await proxy(await makeRequest("/api/pins", { method: "POST", token: "bad-token" }));
    expect(response.status).toBe(401);
  });

  it("allows POST /api/login without a cookie — login must be public", async () => {
    const response = await proxy(await makeRequest("/api/login", { method: "POST" }));
    expect(response.status).not.toBe(401);
  });

  it("allows POST /api/logout without a cookie — logout must be public", async () => {
    const response = await proxy(await makeRequest("/api/logout", { method: "POST" }));
    expect(response.status).not.toBe(401);
  });
});
