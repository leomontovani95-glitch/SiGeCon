import { NextRequest, NextResponse } from "next/server";
import { decrypt } from "@/lib/session";

const publicRoutes = ["/login"];

export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;

  if (
    path.startsWith("/_next") ||
    path.startsWith("/api") ||
    path === "/manifest.json" ||
    path === "/sw.js" ||
    path.startsWith("/icons")
  ) {
    return NextResponse.next();
  }

  // Em proxy/middleware, usar req.cookies (não cookies() de next/headers)
  const token = req.cookies.get("session")?.value;
  const session = await decrypt(token);
  const isPublic = publicRoutes.includes(path);

  if (!isPublic && !session?.userId) {
    const url = new URL("/login", req.nextUrl);
    url.searchParams.set("redirect", path);
    return NextResponse.redirect(url);
  }

  if (isPublic && session?.userId) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  // Força troca de senha no primeiro acesso
  if (session?.mustChangePassword && !path.startsWith("/perfil") && !path.startsWith("/logout")) {
    return NextResponse.redirect(new URL("/perfil?mustChange=1", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons|sw.js|manifest.json).*)"],
};
