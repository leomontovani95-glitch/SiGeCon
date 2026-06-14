import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// Proxy (antigo "middleware") — rede de segurança de autenticação. Verifica
// apenas a assinatura do cookie de sessão (jose, sem banco — não roda Prisma).
// A verificação autoritativa, incluindo `active` no banco, fica em verifySession.
const encodedKey = new TextEncoder().encode(process.env.SESSION_SECRET ?? "");

async function lerSessao(token?: string): Promise<Record<string, unknown> | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, encodedKey, { algorithms: ["HS256"] });
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

export default async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Não interceptar auth nem server actions (POST com cabeçalho Next-Action):
  // os server actions já chamam verifySession por conta própria.
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/logout") ||
    request.headers.has("Next-Action")
  ) {
    return NextResponse.next();
  }

  const sessao = await lerSessao(request.cookies.get("session")?.value);

  // Sessão-2a: sem sessão válida → manda para o login (rede de segurança).
  if (!sessao?.userId) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Sessão-2b: troca de senha obrigatória confina o usuário ao /perfil.
  if (sessao.mustChangePassword && pathname !== "/perfil") {
    return NextResponse.redirect(new URL("/perfil?mustChange=1", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Protege tudo, exceto API (auth própria), assets do Next e arquivos estáticos
  // (ícones/manifest/sw/imagens) — senão o redirect de auth quebraria o carregamento.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icons|manifest|sw\\.js|.*\\.(?:png|jpg|jpeg|svg|ico|webmanifest)$).*)",
  ],
};
