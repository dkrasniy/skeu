import { type NextRequest, NextResponse } from "next/server";
import { EDITOR_COOKIE } from "@/lib/returning";

// Someone who has used the editor goes straight back to it. Links that mean the home page add ?home.
// Crawlers carry no cookie, so they always get the home page.
export function proxy(request: NextRequest) {
  if (request.cookies.has(EDITOR_COOKIE) && !request.nextUrl.searchParams.has("home")) {
    return NextResponse.redirect(new URL("/editor", request.url));
  }
}

export const config = { matcher: "/" };
