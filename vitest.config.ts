import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "src"),
      // Permite importar módulos "server-only" nos testes (Node).
      "server-only": path.resolve(process.cwd(), "test/server-only-stub.ts"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // Banco isolado para os testes de integração (lib/db lê DATABASE_URL).
    env: { DATABASE_URL: "file:./prisma/test.db" },
    // SQLite único: evita escrita concorrente entre arquivos.
    fileParallelism: false,
  },
});
