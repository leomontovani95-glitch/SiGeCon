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

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const agora = new Date();

    // Cabeçalho
    doc.setFontSize(13);
    doc.setTextColor(30, 58, 95);
    doc.text(`SiGeCon — ${meta.titulo}`, 14, 14);

    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(meta.subtitulo, 14, 20);
    doc.text(
      `Gerado em ${agora.toLocaleDateString("pt-BR")} às ${agora.toLocaleTimeString("pt-BR")} · ${items.length} registro(s)`,
      14, 25,
    );

    // Linha de resumo
    doc.setFontSize(8);
    doc.setTextColor(30, 58, 95);
    doc.text(
      `Total: ${meta.total}   Desfavoráveis: ${meta.desfav}   Favoráveis: ${meta.fav}   Decididas: ${meta.decididas}`,
      14, 31,
    );

    autoTable(doc, {
      startY: 36,
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
        0: { cellWidth: 52 },  // Protocolo
        1: { cellWidth: 18 },  // Tipo
        2: { cellWidth: 30 },  // Aluno
        3: { cellWidth: 30 },  // Curso
        4: { cellWidth: 22, halign: "center" },  // Data
        6: { cellWidth: 12, halign: "center", fontStyle: "bold" },  // Pont.
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
        { align: "right" },
      );
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
