import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { statutLabel } from "./logic";

// Lignes brutes d'une liste de dépenses, triées par secteur puis par date
// décroissante — réutilisées par l'export PDF et l'export CSV.
function lignesDe(depenses, secteurs) {
  const nomSecteur = (id) => secteurs.find((s) => s.id === id)?.nom || id;
  return [...depenses]
    .sort((a, b) => (a.secteurId === b.secteurId ? (a.date < b.date ? 1 : -1) : a.secteurId.localeCompare(b.secteurId)))
    .map((d) => ({
      date: new Date(d.date).toLocaleDateString("fr-FR"),
      secteur: nomSecteur(d.secteurId),
      categorie: d.categorie,
      motif: d.description || "",
      montant: d.montant,
      beneficiaire: d.beneficiaireNom || "",
      statut: statutLabel(d.statut).label,
    }));
}

// Export PDF — tableau unique (toutes les dépenses de la sélection), triées
// par secteur. Porte la même finalité que l'export Excel/CSV : une extraction
// imprimable pour la comptabilité, sans avoir besoin d'ouvrir Excel.
export function exporterDepensesPDF(depenses, secteurs, nomFichier = "depenses") {
  const lignes = lignesDe(depenses, secteurs);
  const doc = new jsPDF({ orientation: "landscape" });

  doc.setFontSize(14);
  doc.text("Suivi des dépenses — E-DÉPENSES", 14, 15);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Exporté le ${new Date().toLocaleDateString("fr-FR")} · ${lignes.length} dépense(s)`, 14, 21);

  autoTable(doc, {
    startY: 26,
    head: [["Date", "Secteur", "Catégorie", "Motif", "Montant (FCFA)", "Bénéficiaire", "Statut"]],
    body: lignes.map((l) => [l.date, l.secteur, l.categorie, l.motif, l.montant.toLocaleString("fr-FR"), l.beneficiaire || "—", l.statut]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [10, 132, 255] },
    foot: [["", "", "", "TOTAL", lignes.reduce((s, l) => s + l.montant, 0).toLocaleString("fr-FR"), "", ""]],
    footStyles: { fillColor: [240, 240, 240], textColor: 20, fontStyle: "bold" },
  });

  doc.save(`${nomFichier}.pdf`);
}

// Export CSV — pas de dépendance nécessaire (Blob natif), utile pour importer
// dans un tableur autre qu'Excel ou un logiciel comptable.
export function exporterDepensesCSV(depenses, secteurs, nomFichier = "depenses") {
  const lignes = lignesDe(depenses, secteurs);
  const entetes = ["Date", "Secteur", "Catégorie", "Motif", "Montant (FCFA)", "Bénéficiaire", "Statut"];
  const escape = (v) => {
    const s = String(v ?? "");
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = [
    entetes,
    ...lignes.map((l) => [l.date, l.secteur, l.categorie, l.motif, l.montant, l.beneficiaire, l.statut]),
  ];
  const csv = rows.map((r) => r.map(escape).join(";")).join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nomFichier}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
