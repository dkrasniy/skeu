import { type NextRequest, NextResponse } from "next/server";

// The home page moved to /about; links from before that used /?home to mean it.
export function proxy(request: NextRequest) {
  if (request.nextUrl.searchParams.has("home")) return NextResponse.redirect(new URL("/about", request.url), 308);
}

export const config = { matcher: "/" };
