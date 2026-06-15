import { prisma } from "@/lib/db";
import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const PER_PAGE = 50;

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await verifySession();
  if (session.role !== "ADMINISTRADOR") redirect("/acesso-negado");

  const sp = await searchParams;
  const pagina = Math.max(1, parseInt(sp.pagina ?? "1") || 1);
  const filtroAction = (sp.action ?? "").trim();
  const filtroEntity = (sp.entity ?? "").trim();
  const filtroUser = (sp.userId ?? "").trim();

  const where = {
    ...(filtroAction ? { action: { contains: filtroAction } } : {}),
    ...(filtroEntity ? { entity: { contains: filtroEntity } } : {}),
    ...(filtroUser ? { userId: filtroUser } : {}),
  };

  const [total, logs, usuarios] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { warName: true, rank: true, role: true } } },
      orderBy: { createdAt: "desc" },
      take: PER_PAGE,
      skip: (pagina - 1) * PER_PAGE,
    }),
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, warName: true, rank: true },
      orderBy: { warName: "asc" },
    }),
  ]);

  const totalPaginas = Math.max(1, Math.ceil(total / PER_PAGE));

  function mkUrl(overrides: Record<string, string | number>) {
    const p = new URLSearchParams();
    if (filtroAction) p.set("action", filtroAction);
    if (filtroEntity) p.set("entity", filtroEntity);
    if (filtroUser) p.set("userId", filtroUser);
    p.set("pagina", String(pagina));
    for (const [k, v] of Object.entries(overrides)) p.set(k, String(v));
    return `/auditoria?${p.toString()}`;
  }

  const ACTION_COLORS: Record<string, string> = {
    CREATE: "bg-green-100 text-green-800",
    UPDATE: "bg-blue-100 text-blue-800",
    DELETE: "bg-red-100 text-red-800",
    LOGIN:  "bg-gray-100 text-gray-700",
    PUBLISH: "bg-purple-100 text-purple-800",
    EXPORT: "bg-orange-100 text-orange-800",
  };

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Log de Auditoria</h1>
        <p className="text-sm text-gray-500">{total} registro(s) no total</p>
      </div>

      {/* Filtros */}
      <form method="GET" action="/auditoria" className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Ação</label>
            <input name="action" defaultValue={filtroAction} placeholder="ex: CREATE, UPDATE, LOGIN…"
              className="input text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Entidade</label>
            <input name="entity" defaultValue={filtroEntity} placeholder="ex: Communication, User…"
              className="input text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Usuário</label>
            <select name="userId" defaultValue={filtroUser} className="input text-sm">
              <option value="">Todos</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>{u.rank} {u.warName}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button type="submit" className="btn-primary text-sm px-4">Filtrar</button>
          <Link href="/auditoria" className="btn-secondary text-sm px-4">Limpar</Link>
        </div>
      </form>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto mb-5">
        <table className="w-full text-sm">
          <thead className="bg-[#1e3a5f] text-white">
            <tr>
              <th className="text-left px-4 py-3 font-medium w-36">Data/Hora</th>
              <th className="text-left px-4 py-3 font-medium w-32">Usuário</th>
              <th className="text-left px-4 py-3 font-medium w-24">Ação</th>
              <th className="text-left px-4 py-3 font-medium w-32">Entidade</th>
              <th className="text-left px-4 py-3 font-medium">Detalhes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  Nenhum registro de auditoria encontrado.
                </td>
              </tr>
            )}
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-2.5 font-mono text-xs text-gray-500 whitespace-nowrap">
                  {format(new Date(log.createdAt), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                </td>
                <td className="px-4 py-2.5">
                  <p className="font-medium text-gray-900 text-xs">{log.user.rank} {log.user.warName}</p>
                  <p className="text-xs text-gray-400">{log.user.role.replace(/_/g, " ")}</p>
                </td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${ACTION_COLORS[log.action] ?? "bg-gray-100 text-gray-700"}`}>
                    {log.action}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-xs text-gray-600">
                  <p>{log.entity}</p>
                  {log.entityId && <p className="font-mono text-gray-400 text-[10px] truncate max-w-[120px]">{log.entityId}</p>}
                </td>
                <td className="px-4 py-2.5 text-xs text-gray-500 max-w-sm">
                  <p className="truncate">{log.details ?? "—"}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {pagina > 1 && (
            <a href={mkUrl({ pagina: pagina - 1 })} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50">← Anterior</a>
          )}
          <span className="text-sm text-gray-500">Página {pagina} de {totalPaginas}</span>
          {pagina < totalPaginas && (
            <a href={mkUrl({ pagina: pagina + 1 })} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50">Próxima →</a>
          )}
        </div>
      )}
    </div>
  );
}
