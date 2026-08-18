import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { History, ArrowDownCircle, ArrowUpCircle, Search } from "lucide-react";
import TopBarSimple from "../../components/layout/TopBarSimple";
import GlassCard from "../../components/ui/GlassCard";
import StatTile from "../../components/ui/StatTile";
import Badge from "../../components/ui/Badge";
import { TextInput, Select } from "../../components/ui/Field";
import { useDataStore } from "../../store/dataStore";

const STATUTS_DEPENSE = {
  en_attente: { label: "En attente", tone: "amber" }, approuvee: { label: "Approuvée", tone: "accent" },
  refusee: { label: "Refusée", tone: "coral" }, decaissee: { label: "Décaissée", tone: "mint" },
};
const debutMois = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); };
const auj = () => new Date().toISOString().slice(0, 10);
const fmt = (n) => Math.round(Number(n) || 0).toLocaleString("fr-FR");

// Historique — filtre transversal (tous les modules), porté (simplifié)
// depuis termitiere-platform/src/modules/{agro,depense}/Historique.jsx : ne
// crée aucune donnée, ne fait que filtrer par période/type/recherche ce qui
// est déjà chargé (dépenses + recettes du secteur), à la demande de
// l'utilisateur (2026-08-18).
export default function Historique() {
  const config = useOutletContext();
  const { depenses, recettes, chargerDepenses, chargerRecettes } = useDataStore();

  useEffect(() => { chargerDepenses(); chargerRecettes(); }, [chargerDepenses, chargerRecettes]);

  const [debut, setDebut] = useState(debutMois());
  const [fin, setFin] = useState(auj());
  const [type, setType] = useState(""); // "" | depense | recette
  const [recherche, setRecherche] = useState("");

  const mouvements = useMemo(() => {
    const d = depenses.filter((x) => x.secteurId === config.secteurId).map((x) => ({ ...x, type: "depense" }));
    const r = recettes.filter((x) => x.secteurId === config.secteurId).map((x) => ({ ...x, type: "recette" }));
    return [...d, ...r].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [depenses, recettes, config.secteurId]);

  const lignes = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return mouvements
      .filter((m) => (m.date || "") >= debut && (m.date || "") <= fin)
      .filter((m) => !type || m.type === type)
      .filter((m) => !q || (m.description || m.categorie || m.origine || "").toLowerCase().includes(q));
  }, [mouvements, debut, fin, type, recherche]);

  const totalDepense = lignes.filter((m) => m.type === "depense").reduce((s, m) => s + m.montant, 0);
  const totalRecette = lignes.filter((m) => m.type === "recette").reduce((s, m) => s + m.montant, 0);

  return (
    <div>
      <TopBarSimple title="Historique" subtitle={`${config.nom} — dépenses et recettes, filtrées par période`} icon={History} accent={config.color} />

      <div className="grid grid-cols-3 gap-4 mb-5">
        <StatTile icon={ArrowUpCircle} label="Dépensé (période)" value={fmt(totalDepense) + " FCFA"} tone="#FF453A" />
        <StatTile icon={ArrowDownCircle} label="Reçu (période)" value={fmt(totalRecette) + " FCFA"} tone="#30D158" />
        <StatTile icon={History} label="Solde (période)" value={fmt(totalRecette - totalDepense) + " FCFA"} tone={config.color} />
      </div>

      <div className="flex flex-wrap items-end gap-2 mb-4">
        <div><label className="mb-1 block text-[11.5px] font-semibold text-ink-soft ml-1">Du</label><TextInput type="date" className="w-auto" value={debut} onChange={(e) => setDebut(e.target.value)} /></div>
        <div><label className="mb-1 block text-[11.5px] font-semibold text-ink-soft ml-1">Au</label><TextInput type="date" className="w-auto" value={fin} onChange={(e) => setFin(e.target.value)} /></div>
        <div>
          <label className="mb-1 block text-[11.5px] font-semibold text-ink-soft ml-1">Type</label>
          <Select className="!w-auto" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Dépenses & recettes</option>
            <option value="depense">Dépenses</option>
            <option value="recette">Recettes</option>
          </Select>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="mb-1 block text-[11.5px] font-semibold text-ink-soft ml-1">Recherche</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft/50" />
            <TextInput className="pl-8" placeholder="Description, catégorie, origine…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
          </div>
        </div>
        <span className="ml-auto text-[12px] text-ink-soft/70 pb-2.5">{lignes.length} résultat(s)</span>
      </div>

      <GlassCard className="p-2 overflow-hidden" hover={false}>
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="text-left text-[11.5px] font-bold text-ink-soft uppercase tracking-wide">
              <th className="px-3 py-3">Date</th>
              <th className="px-3 py-3">Type</th>
              <th className="px-3 py-3">Détail</th>
              <th className="px-3 py-3 text-right">Montant</th>
              <th className="px-3 py-3 text-center">Statut</th>
            </tr>
          </thead>
          <tbody>
            {lignes.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-[13px] text-ink-soft italic">Aucun mouvement sur cette période.</td></tr>}
            {lignes.map((m) => (
              <tr key={`${m.type}-${m.id}`} className="text-[13px]">
                <td className="px-3 py-2.5 whitespace-nowrap text-ink-soft">{m.date ? new Date(m.date).toLocaleDateString("fr-FR") : "—"}</td>
                <td className="px-3 py-2.5"><Badge tone={m.type === "depense" ? "coral" : "mint"}>{m.type === "depense" ? "Dépense" : "Recette"}</Badge></td>
                <td className="px-3 py-2.5 text-ink">
                  {m.type === "depense" ? (m.description || m.categorie || "—") : (m.description || m.origine || "—")}
                  {m.type === "depense" && m.beneficiaireNom && <span className="text-ink-soft"> — {m.beneficiaireNom}</span>}
                  {m.type === "recette" && m.client && <span className="text-ink-soft"> — {m.client}</span>}
                </td>
                <td className={`px-3 py-2.5 text-right tabular font-bold ${m.type === "depense" ? "text-[#b3241b]" : "text-[#1a7d34]"}`}>{m.type === "depense" ? "−" : "+"}{fmt(m.montant)}</td>
                <td className="px-3 py-2.5 text-center">{m.type === "depense" ? <Badge tone={STATUTS_DEPENSE[m.statut]?.tone}>{STATUTS_DEPENSE[m.statut]?.label}</Badge> : <span className="text-ink-soft/50">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>
    </div>
  );
}
