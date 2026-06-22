"server-only";
import path from "path";

// Diretório base dos anexos enviados pelos usuários (defesas, provas, pareceres,
// decisões). Fica FORA de `public/` de propósito: arquivos em `public/` são
// servidos estaticamente, sem autenticação. O acesso aos anexos passa, portanto,
// obrigatoriamente pela rota /api/anexo/[id], que valida sessão e escopo.
// Configurável por UPLOADS_DIR (recomendado em produção apontar para um volume
// com backup); padrão: <raiz do projeto>/uploads.
export function uploadsDir(): string {
  const configurado = process.env.UPLOADS_DIR?.trim();
  return configurado && configurado.length > 0
    ? path.resolve(configurado)
    : path.join(process.cwd(), "uploads");
}

// Converte o filePath armazenado (ex.: "/uploads/<commId>/<arquivo>") no caminho
// absoluto dentro de uploadsDir(). Retorna null se o resultado escapar da base
// (proteção contra path traversal a partir de um filePath manipulado).
export function resolveUploadPath(filePath: string): string | null {
  const relativo = filePath.replace(/^\/+uploads\/+/i, "").replace(/^\/+/, "");
  const base = uploadsDir();
  const abs = path.resolve(base, relativo);
  const raiz = base.endsWith(path.sep) ? base : base + path.sep;
  if (abs !== base && !abs.startsWith(raiz)) return null;
  return abs;
}
