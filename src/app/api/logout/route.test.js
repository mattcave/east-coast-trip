import { describe, it, expect } from "vitest";
import { POST } from "./route.js";

describe("POST /api/logout", () => {
  it("returns 200", async () => {
    const response = await POST();
    expect(response.status).toBe(200);
  });

  it("clears the session cookie by setting Max-Age=0", async () => {
    const response = await POST();
    expect(response.headers.get("Set-Cookie")).toContain("session=");
    expect(response.headers.get("Set-Cookie")).toContain("Max-Age=0");
  });
});
