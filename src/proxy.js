import { NextResponse } from "next/server";
import { isValidToken } from "@/lib/auth";

const WRITE_METHODS = new Set(["POST", "PATCH", "DELETE"]);

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
  const PUBLIC_API = new Set(["/api/login", "/api/logout"]);
  if (pathname.startsWith("/api") && !PUBLIC_API.has(pathname) && WRITE_METHODS.has(method)) {
    if (!await isValidToken(token)) {
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/:path*"],
};
