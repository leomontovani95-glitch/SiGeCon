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

async function imgBase64(url: string): Promise<string> {
  const r = await fetch(url);
  const buf = await r.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return `data:image/png;base64,${btoa(bin)}`;
}

export default function RankingPDF({ ranking, label }: { ranking: RankingItem[]; label?: string }) {
  const gerarPDF = useCallback(async () => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const [logoPMES, logoAPM] = await Promise.all([
      imgBase64("/logo-pmes.png"),
      imgBase64("/brasao-apm.png"),
    ]);

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const agora = new Date();
    const pW  = doc.internal.pageSize.getWidth();
    const lW  = 18;
    const hY  = 8;

    // Logos no cabeçalho
    doc.addImage(logoPMES, "PNG", 14, hY, lW, lW);
    doc.addImage(logoAPM,  "PNG", pW - 14 - lW, hY, lW, lW);

    // Texto institucional centralizado
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(80, 80, 80);
    doc.text("Governo do Estado do Espírito Santo", pW / 2, hY + 4, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30, 58, 95);
    doc.text("POLÍCIA MILITAR", pW / 2, hY + 11, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text("ACADEMIA DE POLÍCIA MILITAR", pW / 2, hY + 17, { align: "center" });

    // Linha separadora
    doc.setDrawColor(30, 58, 95);
    doc.setLineWidth(0.4);
    doc.line(14, hY + lW + 3, pW - 14, hY + lW + 3);

    const cY = hY + lW + 8; // Y início do conteúdo ≈ 34mm

    // Título do relatório
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(30, 58, 95);
    doc.text("Ranking de Conduta Profissional", 14, cY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    if (label) doc.text(label, 14, cY + 6);
    doc.text(
      `Gerado em ${agora.toLocaleDateString("pt-BR")} às ${agora.toLocaleTimeString("pt-BR")} · ${ranking.length} aluno(s) ativo(s)`,
      14, cY + (label ? 12 : 6),
    );

    const tableY = cY + (label ? 18 : 12);

    autoTable(doc, {
      startY: tableY,
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
      didDrawPage: (data) => {
        // Cabeçalho simplificado nas páginas seguintes
        if (data.pageNumber > 1) {
          doc.addImage(logoPMES, "PNG", 14, hY, lW, lW);
          doc.addImage(logoAPM,  "PNG", pW - 14 - lW, hY, lW, lW);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.setTextColor(30, 58, 95);
          doc.text("POLÍCIA MILITAR — ACADEMIA DE POLÍCIA MILITAR", pW / 2, hY + 10, { align: "center" });
          doc.setDrawColor(30, 58, 95);
          doc.setLineWidth(0.4);
          doc.line(14, hY + lW + 3, pW - 14, hY + lW + 3);
        }
      },
    });

    // Rodapé com número de páginas
    const pageCount = (doc as unknown as { internal: { getNumberOfPages(): number } }).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(150);
      const pH = doc.internal.pageSize.getHeight();
      doc.text(
        `Página ${i} de ${pageCount}`,
        pW - 14,
        pH - 8,
        { align: "right" },
      );
      doc.text("Documento de uso interno — APM/ES", 14, pH - 8);
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
