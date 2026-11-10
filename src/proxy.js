import { NextResponse } from "next/server";
import { isValidToken, isValidApiToken } from "@/lib/auth";

// Anything that isn't a read needs a session. Listing the safe methods
// (rather than the write ones) means a new verb like PUT is protected by
// default instead of slipping through.
const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export async function proxy(request) {
  const { pathname } = request.nextUrl;
  const method = request.method;
  const token = request.cookies.get("session")?.value;

  // Protect /admin/* — redirect to login if no valid session
  if (pathname.startsWith("/admin")) {
    if (!await isValidToken(token)) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // Protect write operations on /api/* — return 401 if no valid session.
  // /api/login and /api/logout are explicitly excluded — both must remain public.
  // A valid API token (Authorization: Bearer) is accepted here as well as the
  // session cookie, so agents can write without the admin password. It's
  // deliberately not accepted for /admin above: that's a browser page, and
  // browsers authenticate with the cookie.
  const PUBLIC_API = new Set(["/api/login", "/api/logout"]);
  if (pathname.startsWith("/api") && !PUBLIC_API.has(pathname) && !READ_METHODS.has(method)) {
    const bearerOk = isValidApiToken(request.headers.get("authorization"));
    if (!bearerOk && !await isValidToken(token)) {
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/:path*"],
};
