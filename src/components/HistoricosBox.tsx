import Link from "next/link";
import { formatCourseNumber } from "@/lib/utils";

export type MatriculaEntry = {
  id: string;
  courseName: string;
  courseNumber: string;
  courseActive: boolean;
  isCurrent: boolean;   // matrícula atual (curso vigente, login vinculado)
  selected: boolean;    // histórico sendo visualizado agora
  viewHref: string;     // abrir este histórico
  pdfHref: string;      // gerar PDF deste histórico
};

// Caixa de seleção de históricos (matrícula atual + cursos anteriores), exibida
// no rodapé do perfil/ficha. Distingue de forma discreta o histórico atual
// ("Atual") dos anteriores ("Anterior") e destaca o que está sendo visto.
export default function HistoricosBox({ entries }: { entries: MatriculaEntry[] }) {
  // Só faz sentido escolher quando há mais de uma matrícula.
  if (entries.length < 2) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mt-6">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Históricos do aluno</h2>
      <p className="text-xs text-gray-400 mb-4">
        Cada curso possui histórico próprio. Selecione um curso para visualizar o histórico correspondente e gerar o PDF.
      </p>
      <ul className="space-y-2">
        {entries.map((e) => (
          <li
            key={e.id}
            className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-2.5 transition-colors ${
              e.selected ? "border-[#1e3a5f]/40 bg-[#1e3a5f]/[0.04]" : "border-gray-100 hover:bg-gray-50"
            }`}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-gray-900">{e.courseName}</span>
                <span className="text-sm text-gray-500">— Nº {formatCourseNumber(e.courseNumber)}</span>
                {/* Indicação discreta: atual vs anterior */}
                {e.isCurrent ? (
                  <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">
                    Atual
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200">
                    Anterior
                  </span>
                )}
                {!e.courseActive && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">
                    Curso inativo
                  </span>
                )}
              </div>
              {e.selected && (
                <span className="text-[11px] text-[#1e3a5f]">Visualizando este histórico</span>
              )}
            </div>
            <div className="flex gap-3 text-xs shrink-0">
              {e.selected ? (
                <span className="text-gray-300 cursor-default">Ver histórico</span>
              ) : (
                <Link href={e.viewHref} className="text-[#1e3a5f] hover:underline">Ver histórico</Link>
              )}
              <Link href={e.pdfHref} target="_blank" className="text-gray-500 hover:underline">PDF</Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
