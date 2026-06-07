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

function imgResized(url: string, px = 72): Promise<string> {
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

export default function RelatorioPDF({
  items,
  meta,
}: {
  items: RelatorioItem[];
  meta:  RelatorioMeta;
}) {
  const gerarPDF = useCallback(async () => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const [logoPMES, logoAPM] = await Promise.all([
      imgResized("/logo-pmes.png"),
      imgResized("/brasao-apm.png"),
    ]);

    const doc  = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const agora = new Date();
    const pW  = doc.internal.pageSize.getWidth();
    const lW  = 18;
    const hY  = 8;

    // Logos no cabeçalho da primeira página
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
    doc.text(`SiGeCon — ${meta.titulo}`, 14, cY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(meta.subtitulo, 14, cY + 6);
    doc.text(
      `Gerado em ${agora.toLocaleDateString("pt-BR")} às ${agora.toLocaleTimeString("pt-BR")} · ${items.length} registro(s)`,
      14, cY + 11,
    );

    // Resumo
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(30, 58, 95);
    doc.text(
      `Total: ${meta.total}   |   Desfavoráveis: ${meta.desfav}   |   Favoráveis: ${meta.fav}   |   Decididas: ${meta.decididas}`,
      14, cY + 17,
    );

    autoTable(doc, {
      startY: cY + 22,
      head: [["Protocolo", "Tipo", "Aluno", "Curso", "Data do Fato", "Status", "Pont."]],
      body: items.map((r) => [
        r.protocolNumber,
        r.typeName,
        r.warName,
        r.courseName,
        r.factDate,
        r.statusLabel,
        r.finalScore != null ? r.finalScore.toFixed(1) : "—",
      ]),
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: {
        0: { cellWidth: 52 },
        1: { cellWidth: 18 },
        2: { cellWidth: 30 },
        3: { cellWidth: 30 },
        4: { cellWidth: 22, halign: "center" },
        6: { cellWidth: 12, halign: "center", fontStyle: "bold" },
      },
      didParseCell(data) {
        if (data.column.index === 5 && data.section === "body") {
          const s = String(data.cell.raw ?? "");
          if (s.includes("Prazo") || s.includes("Reprovado"))
            data.cell.styles.textColor = [185, 28, 28];
          else if (s.includes("Decidida") || s.includes("Publicada"))
            data.cell.styles.textColor = [21, 128, 61];
          else if (s.includes("Arquivada"))
            data.cell.styles.textColor = [75, 85, 99];
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
      doc.text(`Página ${i} de ${pageCount}`, pW - 14, pH - 8, { align: "right" });
      doc.text("Documento de uso interno — APM/ES", 14, pH - 8);
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
