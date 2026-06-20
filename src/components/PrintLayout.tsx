"use client";
import { useEffect } from "react";

type Props = {
  title: string;
  children: React.ReactNode;
  extraPages?: React.ReactNode[];
  extraStyles?: string;
  escola?: string;
  /** Repete o cabeçalho institucional no topo de TODAS as páginas impressas
   *  (via <thead> de tabela — o navegador repete o thead a cada quebra de
   *  página, ocupando espaço real e sem sobrepor o conteúdo). */
  repeatHeader?: boolean;
};

export default function PrintLayout({ title, children, extraPages, extraStyles, escola, repeatHeader }: Props) {
  useEffect(() => {
    document.title = title;
  }, [title]);

  const headerEl = (
    /* Cabeçalho institucional com logos */
    <div className="print-header">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-pmes.png" alt="PMES" className="print-header-logo" width={68} height={68} loading="eager" />
      <div className="print-header-text">
        <p className="linha1">Governo do Estado do Espírito Santo</p>
        <p className="linha2">Polícia Militar</p>
        <p className="linha3">Academia de Polícia Militar</p>
        {escola && <p className="linha4">{escola}</p>}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brasao-apm.png" alt="APM/ES" className="print-header-logo" width={68} height={68} loading="eager" />
    </div>
  );

  return (
    <>
      <style>{`
        @media screen {
          body { background: #e5e7eb; margin: 0; font-family: Arial, sans-serif; }
          .print-page {
            background: white;
            width: 210mm;
            min-height: 297mm;
            margin: 20px auto;
            padding: 16mm 20mm 20mm 22mm;
            box-shadow: 0 4px 24px rgba(0,0,0,0.15);
          }
          .extra-page {
            background: white;
            width: 210mm;
            min-height: 297mm;
            margin: 20px auto;
            padding: 16mm 20mm 20mm 22mm;
            box-shadow: 0 4px 24px rgba(0,0,0,0.15);
          }
          .no-print-bar {
            position: fixed; top: 0; left: 0; right: 0; z-index: 999;
            background: #1e3a5f; color: white;
            display: flex; align-items: center; gap: 12px;
            padding: 10px 20px; font-family: Arial, sans-serif; font-size: 13px;
          }
          .no-print-bar button {
            background: white; color: #1e3a5f;
            border: none; padding: 6px 14px; border-radius: 6px;
            cursor: pointer; font-weight: bold; font-size: 13px;
          }
          .no-print-bar button:hover { background: #e0e7ef; }
          body { padding-top: 44px; }
        }
        @media print {
          .no-print-bar { display: none !important; }
          body { background: white; margin: 0; padding: 0; }
          body * { visibility: hidden; }
          .print-page, .print-page *, .extra-page, .extra-page * { visibility: visible; }
          .print-page, .extra-page {
            box-shadow: none !important;
            margin: 0 !important;
            padding: 12mm 15mm 15mm 18mm !important;
            width: 100% !important;
            min-height: unset !important;
          }
          .extra-page {
            break-before: page !important;
            page-break-before: always !important;
          }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          img { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }

        /* ── Cabeçalho com logos ── */
        .print-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 2px solid #1e3a5f;
          padding-bottom: 10px;
          margin-bottom: 20px;
          gap: 8px;
        }
        .print-header-logo {
          height: 60pt;
          width: 60pt;
          object-fit: contain;
          flex-shrink: 0;
          display: block;
        }
        .print-header-text {
          flex: 1;
          text-align: center;
          padding: 0 8px;
        }
        .print-header-text .linha1 {
          font-size: 9pt;
          font-weight: normal;
          color: #333;
          letter-spacing: 0.3px;
          margin: 0 0 2px 0;
          text-transform: uppercase;
        }
        .print-header-text .linha2 {
          font-size: 14pt;
          font-weight: bold;
          color: #1e3a5f;
          margin: 0 0 1px 0;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .print-header-text .linha3 {
          font-size: 10pt;
          font-weight: bold;
          color: #333;
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .print-header-text .linha4 {
          font-size: 8.5pt;
          font-weight: bold;
          color: #333;
          margin: 2px 0 0 0;
          letter-spacing: 0.5px;
        }

        /* ── Seções e campos ── */
        .print-section { margin-bottom: 16px; }
        .print-section h2 { font-size: 11pt; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 8px; color: #1e3a5f; letter-spacing: 0.5px; }
        .print-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px; }
        .print-field { margin-bottom: 6px; }
        .print-field label { font-size: 8pt; font-weight: bold; color: #555; display: block; text-transform: uppercase; }
        .print-field span { font-size: 10pt; color: #111; }
        .print-text { font-size: 10pt; line-height: 1.5; text-align: justify; white-space: pre-wrap; }
        .print-protocol { font-family: monospace; font-size: 11pt; font-weight: bold; color: #1e3a5f; }
        .print-signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 40px; }
        .print-sig-line { border-top: 1px solid #000; padding-top: 6px; text-align: center; font-size: 9pt; }
        .print-table { width: 100%; border-collapse: collapse; font-size: 9pt; }
        .print-table th { background: #1e3a5f; color: white; padding: 6px 8px; text-align: left; font-size: 8pt; }
        .print-table td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; }
        .print-table tr:nth-child(even) td { background: #f9fafb; }
        .print-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 8pt; font-weight: bold; }
        .badge-desfav { background: #fee2e2; color: #991b1b; }
        .badge-fav { background: #dcfce7; color: #166534; }
        .print-footer { position: fixed; bottom: 8mm; left: 18mm; right: 15mm; font-size: 7.5pt; color: #888; border-top: 1px solid #ddd; padding-top: 3px; display: flex; justify-content: space-between; }
        @media screen { .print-footer { display: none; } }

        /* Cabeçalho repetido por página (repeatHeader): thead reimpresso pelo
           navegador no topo de cada página. */
        .print-running { width: 100%; border-collapse: collapse; }
        .print-running > thead { display: table-header-group; }
        .print-running > thead > tr > th { padding: 0; font-weight: normal; text-align: left; }
        .print-running > tbody > tr > td { padding: 0; vertical-align: top; }
      `}</style>

      <div className="no-print-bar">
        <span style={{ fontWeight: "bold" }}>SiGeCon — Documento</span>
        <button onClick={() => window.print()}>Baixar PDF</button>
      </div>

      {extraStyles && <style>{extraStyles}</style>}

      <div className="print-page">
        {repeatHeader ? (
          /* Cabeçalho repetido em todas as páginas: vai no <thead>, que o
             navegador reimprime no topo de cada página ocupando espaço real. */
          <table className="print-running">
            <thead>
              <tr><th>{headerEl}</th></tr>
            </thead>
            <tbody>
              <tr><td>{children}</td></tr>
            </tbody>
          </table>
        ) : (
          <>
            {headerEl}
            {children}
          </>
        )}

        <div className="print-footer">
          <span suppressHydrationWarning>SiGeCon — Documento gerado em {new Date().toLocaleString("pt-BR")}</span>
          <span>Documento de uso interno — APM/ES</span>
        </div>
      </div>

      {extraPages?.map((page, i) => (
        <div key={i} className="extra-page">
          {page}
        </div>
      ))}
    </>
  );
}
