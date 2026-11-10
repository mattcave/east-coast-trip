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

const API_TOKEN = "a".repeat(40);

async function makeRequest(path, { method = "GET", token, bearer } = {}) {
  const headers = {};
  if (token) headers["cookie"] = `session=${token}`;
  if (bearer) headers["authorization"] = `Bearer ${bearer}`;
  return new NextRequest(`http://localhost${path}`, { method, headers });
}

describe("public routes (no cookie required)", () => {
  it("allows GET /", async () => {
    const response = await proxy(await makeRequest("/"));
    expect(response.status).not.toBe(401);
    expect(response.headers.get("location")).toBeNull();
  });

  it("allows GET /api/trips/t/pins", async () => {
    const response = await proxy(await makeRequest("/api/trips/t/pins"));
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
  it("blocks POST /api/trips/t/pins without a cookie", async () => {
    const response = await proxy(await makeRequest("/api/trips/t/pins", { method: "POST" }));
    expect(response.status).toBe(401);
  });

  it("blocks PATCH /api/trips/t/pins/1 without a cookie", async () => {
    const response = await proxy(await makeRequest("/api/trips/t/pins/1", { method: "PATCH" }));
    expect(response.status).toBe(401);
  });

  it("blocks DELETE /api/trips/t/pins/1 without a cookie", async () => {
    const response = await proxy(await makeRequest("/api/trips/t/pins/1", { method: "DELETE" }));
    expect(response.status).toBe(401);
  });

  it("blocks PUT /api/trips/t/pins/order without a cookie", async () => {
    const response = await proxy(await makeRequest("/api/trips/t/pins/order", { method: "PUT" }));
    expect(response.status).toBe(401);
  });

  it("allows PUT /api/trips/t/pins/order with a valid cookie", async () => {
    const response = await proxy(await makeRequest("/api/trips/t/pins/order", { method: "PUT", token: await generateToken() }));
    expect(response.status).not.toBe(401);
  });

  it("allows POST /api/trips/t/pins with a valid cookie", async () => {
    const response = await proxy(await makeRequest("/api/trips/t/pins", { method: "POST", token: await generateToken() }));
    expect(response.status).not.toBe(401);
  });

  it("blocks POST /api/trips/t/pins with an invalid cookie", async () => {
    const response = await proxy(await makeRequest("/api/trips/t/pins", { method: "POST", token: "bad-token" }));
    expect(response.status).toBe(401);
  });

  it.each([
    ["POST", "/api/trips"],
    ["PATCH", "/api/trips/t"],
    ["DELETE", "/api/trips/t"],
  ])("blocks %s %s without a cookie", async (method, path) => {
    const response = await proxy(await makeRequest(path, { method }));
    expect(response.status).toBe(401);
  });

  it("allows GET /api/trips without a cookie", async () => {
    const response = await proxy(await makeRequest("/api/trips"));
    expect(response.status).not.toBe(401);
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

describe("API token (Authorization: Bearer)", () => {
  beforeEach(() => {
    vi.stubEnv("API_TOKEN", API_TOKEN);
  });

  it.each([
    ["POST", "/api/trips/t/pins"],
    ["PATCH", "/api/trips/t/pins/1"],
    ["DELETE", "/api/trips/t/pins/1"],
    ["PUT", "/api/trips/t/pins/order"],
    ["POST", "/api/upload"],
    ["POST", "/api/trips"],
  ])("allows %s %s with a valid token", async (method, path) => {
    const response = await proxy(await makeRequest(path, { method, bearer: API_TOKEN }));
    expect(response.status).not.toBe(401);
  });

  it("blocks a write with a wrong token", async () => {
    const response = await proxy(await makeRequest("/api/trips/t/pins", { method: "POST", bearer: "b".repeat(40) }));
    expect(response.status).toBe(401);
  });

  it("blocks a write when API_TOKEN isn't configured", async () => {
    vi.stubEnv("API_TOKEN", "");
    const response = await proxy(await makeRequest("/api/trips/t/pins", { method: "POST", bearer: API_TOKEN }));
    expect(response.status).toBe(401);
  });

  it("still allows a valid cookie when a wrong token is also sent", async () => {
    const response = await proxy(await makeRequest("/api/trips/t/pins", {
      method: "POST", token: await generateToken(), bearer: "wrong",
    }));
    expect(response.status).not.toBe(401);
  });

  it("does not open /admin pages — those stay cookie-only", async () => {
    const response = await proxy(await makeRequest("/admin", { bearer: API_TOKEN }));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
  });
});
