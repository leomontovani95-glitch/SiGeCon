"use client";
import { useCallback } from "react";

export type RelatorioItem = {
  protocolNumber: string;
  typeName:       string;
  warName:        string;
  courseName:     string;
  factDate:       string;
  statusLabel:    string;
  finalScore:     number | null;
};

export type RelatorioMeta = {
  titulo:    string;
  subtitulo: string;
  total:     number;
  desfav:    number;
  fav:       number;
  decididas: number;
};

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

// Abreviações para caber em uma linha no PDF retrato
function shortType(name: string): string {
  if (name === "Referência Elogiosa")    return "Ref. Elogiosa";
  if (name === "Elogio publicado em BI") return "Elogio em BI";
  return name;
}

function shortStatus(label: string): string {
  if (label === "Decidida/Não publicada") return "Dec./Não pub.";
  if (label === "Decidida/Publicada")     return "Dec./Publicada";
  if (label === "Ag. Ciência/Defesa")     return "Ag. Ciência";
  if (label === "Defesa Apresentada")     return "Defesa Apres.";
  return label;
}

export default function RelatorioPDF({ items, meta }: { items: RelatorioItem[]; meta: RelatorioMeta }) {
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
    const pW = doc.internal.pageSize.getWidth();
    const pH = doc.internal.pageSize.getHeight();
    const lW = 18;
    const hY = 8;
    const mL = 12;
    const mR = 12;

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
    doc.text(`SiGeCon — ${meta.titulo}`, mL, cY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    if (meta.subtitulo) doc.text(meta.subtitulo, mL, cY + 6);
    doc.text(
      `Gerado em ${agora.toLocaleDateString("pt-BR")} às ${agora.toLocaleTimeString("pt-BR")} · ${items.length} registro(s)`,
      mL, cY + 11,
    );

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(30, 58, 95);
    doc.text(
      `Total: ${meta.total}   |   Desfavoráveis: ${meta.desfav}   |   Favoráveis: ${meta.fav}   |   Decididas: ${meta.decididas}`,
      mL, cY + 17,
    );

    const tableStartY = cY + 23;

    // ── Tabela ───────────────────────────────────────────────────────────────
    // Larguras para retrato (usável: 186mm)
    // Proto(50) + Tipo(22) + Aluno(30) + Curso(20) + Data(18) + Status(26) + Pont.(20) = 186mm
    autoTable(doc, {
      startY: tableStartY,
      margin: { top: 32, bottom: 14, left: mL, right: mR },
      head: [["Protocolo", "Tipo", "Aluno", "Curso", "Data", "Status", "Pont."]],
      body: items.map((r) => [
        r.protocolNumber,
        shortType(r.typeName),
        r.warName,
        r.courseName,
        r.factDate,
        shortStatus(r.statusLabel),
        r.finalScore != null ? r.finalScore.toFixed(1) : "—",
      ]),
      styles:     { fontSize: 7, cellPadding: 1.5, overflow: "linebreak" },
      headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: "bold", fontSize: 7 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 22 },
        2: { cellWidth: 30 },
        3: { cellWidth: 20 },
        4: { cellWidth: 18, halign: "center" },
        5: { cellWidth: 26 },
        6: { cellWidth: 20, halign: "center", fontStyle: "bold" },
      },
      didParseCell(data) {
        if (data.column.index === 5 && data.section === "body") {
          const s = String(data.cell.raw ?? "");
          if (s.includes("Prazo"))       data.cell.styles.textColor = [185, 28, 28];
          else if (s.startsWith("Dec.")) data.cell.styles.textColor = [21, 128, 61];
          else if (s.includes("Arquiv")) data.cell.styles.textColor = [75, 85, 99];
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

    const slug = agora.toISOString().split("T")[0];
    doc.save(`relatorio-comunicacoes-${slug}.pdf`);
  }, [items, meta]);

  return (
    <button
      onClick={gerarPDF}
      disabled={items.length === 0}
      className="bg-[#1e3a5f] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#16304f] transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <span>📄</span> Exportar PDF
    </button>
  );
}
