import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const encodedKey = new TextEncoder().encode(process.env.SESSION_SECRET!);

export default async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Não interceptar rotas de autenticação, página de perfil ou server actions (POST com Next-Action)
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/logout") ||
    pathname.startsWith("/perfil") ||
    request.headers.has("Next-Action")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get("session")?.value;
  if (!token) return NextResponse.next();

  try {
    const { payload } = await jwtVerify(token, encodedKey, { algorithms: ["HS256"] });
    const session = payload as { mustChangePassword?: boolean };

    if (session.mustChangePassword) {
      return NextResponse.redirect(new URL("/perfil?mustChange=1", request.url));
    }
  } catch {
    // Token inválido ou expirado — verifySession no layout trata o redirecionamento para /login
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
