"use client";
import { useCallback } from "react";
import { faixaNota } from "@/lib/score";

export type RankingItem = {
  warName: string;
  fullName: string;
  courseNumber: string;
  courseName: string;
  platoonName: string | null;
  nota: number;
};

export default function RankingPDF({ ranking, label }: { ranking: RankingItem[]; label?: string }) {
  const gerarPDF = useCallback(async () => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const agora = new Date();

    doc.setFontSize(13);
    doc.setTextColor(30, 58, 95);
    doc.text(`SiGeCon — Ranking de Conduta${label ? ` — ${label}` : ""}`, 14, 14);
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(
      `Gerado em ${agora.toLocaleDateString("pt-BR")} às ${agora.toLocaleTimeString("pt-BR")} · ${ranking.length} aluno(s) ativo(s)`,
      14, 20
    );

    autoTable(doc, {
      startY: 25,
      head: [["Pos.", "Nº", "Nome de Guerra", "Nome Completo", "Curso", "Pelotão", "Nota", "Classificação"]],
      body: ranking.map((a, i) => [
        `${i + 1}º`,
        a.courseNumber,
        a.warName,
        a.fullName,
        a.courseName,
        a.platoonName ?? "—",
        a.nota.toFixed(2),
        faixaNota(a.nota).label,
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: {
        0: { cellWidth: 12, halign: "center" },
        1: { cellWidth: 14 },
        5: { cellWidth: 22 },
        6: { cellWidth: 16, halign: "center", fontStyle: "bold" },
        7: { cellWidth: 26 },
      },
      didParseCell(data) {
        if (data.column.index === 6 && data.section === "body") {
          const nota = parseFloat(String(data.cell.raw));
          if (!isNaN(nota)) {
            if (nota >= 9)      data.cell.styles.textColor = [21, 128, 61];
            else if (nota >= 8) data.cell.styles.textColor = [22, 163, 74];
            else if (nota >= 7) data.cell.styles.textColor = [161, 98, 7];
            else if (nota >= 6) data.cell.styles.textColor = [220, 38, 38];
            else                data.cell.styles.textColor = [153, 27, 27];
          }
        }
      },
    });

    const pageCount = (doc as unknown as { internal: { getNumberOfPages(): number } }).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text(
        `Página ${i} de ${pageCount}`,
        doc.internal.pageSize.getWidth() - 14,
        doc.internal.pageSize.getHeight() - 8,
        { align: "right" }
      );
    }

    doc.save(`ranking-conduta-${agora.toISOString().split("T")[0]}.pdf`);
  }, [ranking, label]);

  return (
    <button
      onClick={gerarPDF}
      className="bg-[#1e3a5f] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#16304f] transition-colors flex items-center gap-2"
    >
      <span>📄</span> Exportar PDF
    </button>
  );
}
