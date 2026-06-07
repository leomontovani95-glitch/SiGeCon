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

// Redimensiona para px×px via canvas — evita embedar PNG full-res
function imgResized(url: string, px = 200): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = px; c.height = px;
      c.getContext("2d")!.drawImage(img, 0, 0, px, px);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export default function RankingPDF({ ranking, label }: { ranking: RankingItem[]; label?: string }) {
  const gerarPDF = useCallback(async () => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const [logoPMES, logoAPM] = await Promise.all([
      imgResized("/logo-pmes.png"),
      imgResized("/brasao-apm.png"),
    ]);

    // Retrato A4: 210 × 297mm
    const doc  = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const agora = new Date();
    const pW = doc.internal.pageSize.getWidth();   // 210mm
    const pH = doc.internal.pageSize.getHeight();  // 297mm
    const lW = 18;   // logo width/height mm
    const hY = 8;    // header top
    const mL = 12;   // left margin
    const mR = 12;   // right margin

    // ── Cabeçalho pg.1 ──────────────────────────────────────────────────────
    doc.addImage(logoPMES, "PNG", mL, hY, lW, lW);
    doc.addImage(logoAPM,  "PNG", pW - mR - lW, hY, lW, lW);

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

    doc.setDrawColor(30, 58, 95);
    doc.setLineWidth(0.4);
    doc.line(mL, hY + lW + 3, pW - mR, hY + lW + 3);

    const cY = hY + lW + 8; // ≈ 34mm

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 58, 95);
    doc.text("Ranking de Conduta Profissional", mL, cY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    if (label) doc.text(label, mL, cY + 6);
    doc.text(
      `Gerado em ${agora.toLocaleDateString("pt-BR")} às ${agora.toLocaleTimeString("pt-BR")} · ${ranking.length} aluno(s)`,
      mL, cY + (label ? 12 : 6),
    );

    const tableStartY = cY + (label ? 18 : 13);

    // ── Tabela ───────────────────────────────────────────────────────────────
    // Usável: 186mm (210mm - 12mm margem esq. - 12mm margem dir.)
    // Pos(8) + Nº(11) + NomeGuerra(28) + NomeCompleto(55) + Curso(20) + Pelotão(20) + Nota(12) + Classif(32) = 186mm
    // NomeCompleto: conteúdo = 55-3(padding) = 52mm ≈ 43 caracteres a 7pt
    autoTable(doc, {
      startY: tableStartY,
      tableWidth: pW - mL - mR,   // força a tabela a ocupar toda a largura útil
      margin: { top: 32, bottom: 14, left: mL, right: mR },
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
      styles:     { fontSize: 7, cellPadding: 1.5, overflow: "linebreak" },
      headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: "bold", fontSize: 7 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: {
        0: { cellWidth: 8,  halign: "center" },
        1: { cellWidth: 11 },
        2: { cellWidth: 28 },
        3: { cellWidth: 55 },
        4: { cellWidth: 20 },
        5: { cellWidth: 20 },
        6: { cellWidth: 12, halign: "center", fontStyle: "bold" },
        7: { cellWidth: 32 },
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
        if (data.pageNumber > 1) {
          doc.addImage(logoPMES, "PNG", mL, hY, lW, lW);
          doc.addImage(logoAPM,  "PNG", pW - mR - lW, hY, lW, lW);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          doc.setTextColor(30, 58, 95);
          doc.text("POLÍCIA MILITAR — ACADEMIA DE POLÍCIA MILITAR", pW / 2, hY + 11, { align: "center" });
          doc.setDrawColor(30, 58, 95);
          doc.setLineWidth(0.4);
          doc.line(mL, hY + lW + 3, pW - mR, hY + lW + 3);
        }
      },
    });

    // ── Rodapé ───────────────────────────────────────────────────────────────
    const pageCount = (doc as unknown as { internal: { getNumberOfPages(): number } }).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text(`Página ${i} de ${pageCount}`, pW - mR, pH - 7, { align: "right" });
      doc.text("Documento de uso interno — APM/ES", mL, pH - 7);
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
