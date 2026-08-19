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
      statut: d.statut,
      statutLabel: statutLabel(d.statut).label,
    }));
}

// Logo LA TERMITIÈRE — chargé une seule fois (mis en cache) et converti en
// data URL, seul format que jsPDF sait intégrer directement à un PDF.
let logoDataUrlCache = null;
async function chargerLogo() {
  if (logoDataUrlCache) return logoDataUrlCache;
  try {
    const res = await fetch("/logo_termitiere.png");
    const blob = await res.blob();
    logoDataUrlCache = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    logoDataUrlCache = null; // Logo introuvable : le PDF s'exporte quand même, sans logo.
  }
  return logoDataUrlCache;
}

// Ordre d'affichage des sections — décaissées et en attente d'abord (les deux
// classements explicitement demandés), puis approuvées/refusées si présentes.
const STATUTS_ORDRE = [
  { id: "decaissee", titre: "Dépenses décaissées", rgb: [48, 209, 88] },
  { id: "en_attente", titre: "Dépenses en attente", rgb: [255, 159, 10] },
  { id: "approuvee", titre: "Dépenses approuvées", rgb: [10, 132, 255] },
  { id: "refusee", titre: "Dépenses refusées", rgb: [255, 69, 58] },
];

const fmtMontant = (n) => Math.round(n).toLocaleString("fr-FR") + " FCFA";

// Export PDF — en-tête avec logo LA TERMITIÈRE + titre, puis un commentaire
// récapitulatif, puis les dépenses classées par statut (décaissées à part,
// en attente à part, etc.), chaque section ayant son propre titre, un
// commentaire (nombre + total) et son tableau — à la demande explicite de
// l'utilisateur (2026-08-19).
export async function exporterDepensesPDF(depenses, secteurs, nomFichier = "depenses") {
  const lignes = lignesDe(depenses, secteurs);
  const logo = await chargerLogo();
  const doc = new jsPDF({ orientation: "landscape" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marge = 14;

  // ── En-tête : logo + titre ──
  if (logo) doc.addImage(logo, "PNG", marge, 10, 16, 16);
  const xTitre = logo ? marge + 20 : marge;
  doc.setFontSize(15);
  doc.setTextColor(20);
  doc.text("LA TERMITIÈRE", xTitre, 17);
  doc.setFontSize(11);
  doc.setTextColor(80);
  doc.text("Suivi des dépenses — E-DÉPENSES", xTitre, 24);

  // ── Commentaire récapitulatif (avant les tableaux) ──
  const total = lignes.reduce((s, l) => s + l.montant, 0);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(
    `Exporté le ${new Date().toLocaleDateString("fr-FR")} · ${lignes.length} dépense(s) · Total : ${fmtMontant(total)}`,
    marge, 32
  );
  doc.setDrawColor(220);
  doc.line(marge, 36, pageWidth - marge, 36);

  let y = 42;

  for (const s of STATUTS_ORDRE) {
    const groupe = lignes.filter((l) => l.statut === s.id);
    if (groupe.length === 0) continue;
    const sousTotal = groupe.reduce((acc, l) => acc + l.montant, 0);

    // Nouvelle page si le titre + commentaire + au moins une ligne ne tiennent plus.
    if (y > pageHeight - 40) { doc.addPage(); y = 20; }

    // Titre de section, coloré selon le statut.
    doc.setFillColor(...s.rgb);
    doc.rect(marge, y - 4.5, 3, 5, "F");
    doc.setFontSize(12);
    doc.setTextColor(30);
    doc.text(s.titre, marge + 6, y);
    y += 6;

    // Commentaire de section — avant le tableau, comme demandé.
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`${groupe.length} dépense(s) · ${fmtMontant(sousTotal)}`, marge + 6, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      margin: { left: marge, right: marge },
      head: [["Date", "Secteur", "Catégorie", "Motif", "Montant (FCFA)", "Bénéficiaire"]],
      body: groupe.map((l) => [l.date, l.secteur, l.categorie, l.motif, l.montant.toLocaleString("fr-FR"), l.beneficiaire || "—"]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: s.rgb },
      foot: [["", "", "", "Sous-total", fmtMontant(sousTotal), ""]],
      footStyles: { fillColor: [240, 240, 240], textColor: 20, fontStyle: "bold" },
    });

    y = doc.lastAutoTable.finalY + 12;
  }

  doc.save(`${nomFichier}.pdf`);
}

// Export CSV — pas de dépendance nécessaire (Blob natif). Contrairement au
// PDF (mise en forme imprimable) et à l'Excel (classeur multi-feuilles par
// secteur), le CSV est un format texte brut universel : à utiliser pour
// réimporter les dépenses dans un autre logiciel (comptabilité, un autre
// tableur, un script) qui n'ouvre pas nécessairement un .xlsx.
export function exporterDepensesCSV(depenses, secteurs, nomFichier = "depenses") {
  const lignes = lignesDe(depenses, secteurs);
  const entetes = ["Date", "Secteur", "Catégorie", "Motif", "Montant (FCFA)", "Bénéficiaire", "Statut"];
  const escape = (v) => {
    const s = String(v ?? "");
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = [
    entetes,
    ...lignes.map((l) => [l.date, l.secteur, l.categorie, l.motif, l.montant, l.beneficiaire, l.statutLabel]),
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
