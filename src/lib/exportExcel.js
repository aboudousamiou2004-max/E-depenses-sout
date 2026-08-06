import * as XLSX from "xlsx";
import { statutLabel } from "./logic";

// Exporte une liste de dépenses en fichier Excel (.xlsx) — une feuille par
// secteur (classement demandé), plutôt qu'un tableau à plat où il faudrait
// filtrer soi-même. Réutilisé à la fois par le module E-DÉPENSES (tous
// secteurs) et par la page Dépenses de chaque module métier (un seul secteur,
// donc une seule feuille).
export function exporterDepensesExcel(depenses, secteurs, nomFichier = "depenses") {
  const wb = XLSX.utils.book_new();
  const secteursAvecDepenses = secteurs.filter((s) => depenses.some((d) => d.secteurId === s.id));

  secteursAvecDepenses.forEach((s) => {
    const lignes = depenses
      .filter((d) => d.secteurId === s.id)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map((d) => ({
        Date: new Date(d.date).toLocaleDateString("fr-FR"),
        Catégorie: d.categorie,
        Motif: d.description || "",
        "Montant (FCFA)": d.montant,
        Nature: d.natureFlux || "",
        "Source de financement": d.sourceFinancement || "",
        Statut: statutLabel(d.statut).label,
      }));
    const feuille = XLSX.utils.json_to_sheet(lignes);
    feuille["!cols"] = [{ wch: 12 }, { wch: 26 }, { wch: 36 }, { wch: 15 }, { wch: 14 }, { wch: 20 }, { wch: 12 }];
    // Nom d'onglet Excel : 31 caractères max, sans caractères réservés (\/*?:[]).
    const nomOnglet = s.nom.slice(0, 31).replace(/[\\/*?:[\]]/g, "");
    XLSX.utils.book_append_sheet(wb, feuille, nomOnglet);
  });

  if (wb.SheetNames.length === 0) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ Information: "Aucune dépense à exporter" }]), "Dépenses");
  }

  XLSX.writeFile(wb, `${nomFichier}.xlsx`);
}
