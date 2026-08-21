import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const CANONICAL_HOST = "www.beverlysoftball.com";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function proxy(request: NextRequest) {
  const hostname = getRequestHostname(request);

  if (hostname === CANONICAL_HOST || LOCAL_HOSTS.has(hostname)) {
    return NextResponse.next();
  }

  const canonicalUrl = request.nextUrl.clone();
  canonicalUrl.protocol = "https:";
  canonicalUrl.hostname = CANONICAL_HOST;
  canonicalUrl.port = "";

  return NextResponse.redirect(canonicalUrl, 308);
}

function getRequestHostname(request: NextRequest) {
  const host =
    request.headers.get("host") ?? request.headers.get("x-forwarded-host");

  if (host) {
    return host.split(",", 1)[0].trim().replace(/:\d+$/, "").toLowerCase();
  }

  return request.nextUrl.hostname.toLowerCase();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
