import type { NextRequest } from "next/server";
import { auth0 } from "./lib/auth0";

export async function middleware(request: NextRequest) {
  return await auth0.middleware(request);
}

//Implements:
    ///auth/login
    //auth/callback
    //auth/logout
    //auth/profile
//plugins that make Auth0 routes exists
//ex: frontend can redirect to /auth/login
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - api/register (public registration endpoint)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    "/((?!_next/static|_next/image|api/register|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
