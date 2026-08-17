import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Scale, BadgeDollarSign, Package, TrendingUp, FileDown, Save, AlertTriangle } from "lucide-react";
import TopBarSimple from "../../components/layout/TopBarSimple";
import GlassCard from "../../components/ui/GlassCard";
import StatTile from "../../components/ui/StatTile";
import Button from "../../components/ui/Button";
import Field, { TextInput } from "../../components/ui/Field";
import { useStockStore } from "../../store/stockStore";
import { useUIStore } from "../../store/uiStore";
import { matchPeriode } from "../../lib/logic";

const rendementBrique = (t) => Number(t?.rendement) || 0;
const coutMatiereBrique = (t, prixSac) => {
  const r = rendementBrique(t);
  return r > 0 ? (Number(prixSac) || 0) / r : 0;
};

// Marge & Bénéfice — E-BRIQUETERIE. Porté depuis
// termitiere-platform/src/modules/evenementiel/Marge.jsx : recette (déjà
// enregistrée à la vente, cf. BusinessFacturation.jsx) − valeur du matériel
// (quantité vendue × prix du sac de ciment ÷ rendement du type) = bénéfice.
// Calculée directement sur `journal_briques` (action « Vente »), qui existe
// déjà — aucune nouvelle table de vente nécessaire.
export default function Marge() {
  const { typesBriques, journalBriques, prixSacCiment, enregistrerPrixSacCiment, enregistrerRendement } = useStockStore();
  const { periode } = useUIStore();
  const [respecterPeriode, setRespecterPeriode] = useState(true);
  const [prixLocal, setPrixLocal] = useState(String(prixSacCiment));
  const [savingPrix, setSavingPrix] = useState(false);
  const [rendementsLocaux, setRendementsLocaux] = useState({});
  const [savingRendement, setSavingRendement] = useState(null);

  const ventes = useMemo(() => journalBriques.filter((j) => j.action === "Vente"), [journalBriques]);
  const ventesPeriode = useMemo(
    () => (respecterPeriode ? ventes.filter((j) => matchPeriode(j.date, periode)) : ventes),
    [ventes, respecterPeriode, periode]
  );

  const lignes = useMemo(() => {
    return ventesPeriode
      .map((j) => {
        const type = typesBriques.find((t) => t.id === j.typeId);
        if (!type) return null;
        const recette = j.quantite * type.tarifVente;
        const coutU = coutMatiereBrique(type, prixSacCiment);
        const valeurMateriel = j.quantite * coutU;
        return { ...j, nom: type.nom, recette, valeurMateriel, benefice: recette - valeurMateriel, rendement: rendementBrique(type) };
      })
      .filter(Boolean)
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [ventesPeriode, typesBriques, prixSacCiment]);

  const totaux = useMemo(
    () => lignes.reduce((t, l) => ({ recette: t.recette + l.recette, valeurMateriel: t.valeurMateriel + l.valeurMateriel, benefice: t.benefice + l.benefice, qte: t.qte + l.quantite }), { recette: 0, valeurMateriel: 0, benefice: 0, qte: 0 }),
    [lignes]
  );

  const parType = useMemo(() => {
    const map = {};
    lignes.forEach((l) => {
      const c = map[l.typeId] || { id: l.typeId, nom: l.nom, qte: 0, recette: 0, valeurMateriel: 0, benefice: 0 };
      c.qte += l.quantite; c.recette += l.recette; c.valeurMateriel += l.valeurMateriel; c.benefice += l.benefice;
      map[l.typeId] = c;
    });
    return Object.values(map).sort((a, b) => b.benefice - a.benefice);
  }, [lignes]);

  const typesSansRendement = useMemo(() => [...new Set(lignes.filter((l) => l.rendement <= 0).map((l) => l.nom))], [lignes]);
  const margePct = totaux.recette > 0 ? (totaux.benefice / totaux.recette) * 100 : 0;

  async function savePrix() {
    setSavingPrix(true);
    await enregistrerPrixSacCiment(prixLocal);
    setSavingPrix(false);
  }

  async function saveRendement(typeId) {
    setSavingRendement(typeId);
    await enregistrerRendement(typeId, rendementsLocaux[typeId]);
    setSavingRendement(null);
  }

  function exportExcel() {
    const rows = lignes.map((l) => ({
      Date: new Date(l.date).toLocaleDateString("fr-FR"), Qualité: l.nom, Quantité: l.quantite,
      Recette: Math.round(l.recette), "Valeur matériel": Math.round(l.valeurMateriel), Bénéfice: Math.round(l.benefice),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Marge briqueterie");
    XLSX.writeFile(wb, "marge-briqueterie.xlsx");
  }

  const kpis = [
    { title: "Recette totale", value: totaux.recette, icon: BadgeDollarSign, color: "#7c3aed" },
    { title: "Valeur du matériel", value: totaux.valeurMateriel, icon: Package, color: "#ca8a04" },
    { title: "Bénéfice", value: totaux.benefice, icon: TrendingUp, color: "#16a34a" },
    { title: "Marge", value: `${margePct.toFixed(1)} %`, icon: Scale, color: "#0891b2", pct: true },
  ];

  return (
    <div>
      <TopBarSimple title="Marge & Bénéfice" subtitle="Recette − valeur du matériel = bénéfice" accent="#7c3aed" />

      <GlassCard hover={false} className="p-4 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Prix d'un sac de ciment (FCFA)" className="mb-0">
            <TextInput type="number" min="0" className="w-40" value={prixLocal} onChange={(e) => setPrixLocal(e.target.value)} />
          </Field>
          <Button variant="ghost" icon={Save} onClick={savePrix} disabled={savingPrix || prixLocal === String(prixSacCiment)}>Enregistrer</Button>
          <label className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-soft cursor-pointer ml-auto">
            <input type="checkbox" checked={respecterPeriode} onChange={(e) => setRespecterPeriode(e.target.checked)} className="w-4 h-4 rounded accent-[#0A84FF]" />
            Limiter à la période sélectionnée
          </label>
        </div>
        <p className="text-[11.5px] text-ink-soft mt-2">Le coût matériel d'une brique = prix du sac ÷ rendement du type (réglable ci-dessous).</p>
      </GlassCard>

      {typesSansRendement.length > 0 && (
        <div className="flex items-start gap-2 rounded-2xl bg-[#FF9F0A1a] px-4 py-3 text-[12.5px] text-[#93400a] mb-4">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <p>Rendement manquant pour : <strong>{typesSansRendement.join(", ")}</strong>. Leur coût matériel est compté à 0 tant que le rendement n'est pas réglé ci-dessous.</p>
        </div>
      )}

      <GlassCard hover={false} className="p-4 mb-4">
        <h3 className="font-bold tracking-tight text-ink mb-2">Rendement par type (briques / sac de ciment)</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {typesBriques.map((t) => (
            <div key={t.id} className="flex items-center gap-1.5">
              <span className="text-[12.5px] font-semibold text-ink flex-1 truncate">{t.nom}</span>
              <TextInput type="number" min="0" className="w-16" defaultValue={t.rendement || ""} placeholder="0"
                onChange={(e) => setRendementsLocaux((r) => ({ ...r, [t.id]: e.target.value }))} />
              <button onClick={() => saveRendement(t.id)} disabled={savingRendement === t.id || rendementsLocaux[t.id] === undefined}
                className="text-[#0A84FF] disabled:opacity-30"><Save size={14} /></button>
            </div>
          ))}
        </div>
      </GlassCard>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {kpis.map((k) => (
          <StatTile key={k.title} icon={k.icon} label={k.title} value={k.pct ? k.value : Math.round(k.value).toLocaleString("fr-FR") + " FCFA"} tone={k.color} />
        ))}
      </div>

      <div className="flex justify-end mb-3">
        <Button variant="ghost" icon={FileDown} onClick={exportExcel} disabled={!lignes.length}>Exporter Excel</Button>
      </div>

      <GlassCard className="p-2 overflow-hidden mb-5" hover={false}>
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr className="text-left text-[11.5px] font-bold text-ink-soft uppercase tracking-wide">
              <th className="px-3 py-3">Date</th>
              <th className="px-3 py-3">Qualité</th>
              <th className="px-3 py-3 text-center">Qté</th>
              <th className="px-3 py-3 text-right">Recette</th>
              <th className="px-3 py-3 text-right">Valeur matériel</th>
              <th className="px-3 py-3 text-right">Bénéfice</th>
            </tr>
          </thead>
          <tbody>
            {lignes.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-[13px] text-ink-soft italic">Aucune vente sur la période.</td></tr>}
            {lignes.map((l) => (
              <tr key={l.id} className="text-[13px] hover:bg-white/50 transition-colors">
                <td className="px-3 py-2.5 text-ink-soft tabular whitespace-nowrap">{new Date(l.date).toLocaleDateString("fr-FR")}</td>
                <td className="px-3 py-2.5 font-semibold text-ink">{l.nom}</td>
                <td className="px-3 py-2.5 text-center tabular">{l.quantite}</td>
                <td className="px-3 py-2.5 text-right tabular font-semibold text-[#7c3aed]">{Math.round(l.recette).toLocaleString("fr-FR")}</td>
                <td className="px-3 py-2.5 text-right tabular text-[#ca8a04]">{Math.round(l.valeurMateriel).toLocaleString("fr-FR")}</td>
                <td className="px-3 py-2.5 text-right tabular font-bold text-[#16a34a]">{Math.round(l.benefice).toLocaleString("fr-FR")}</td>
              </tr>
            ))}
          </tbody>
          {lignes.length > 0 && (
            <tfoot>
              <tr className="text-[13px] font-bold border-t border-black/10">
                <td className="px-3 py-2.5" colSpan={2}>TOTAL</td>
                <td className="px-3 py-2.5 text-center tabular">{totaux.qte}</td>
                <td className="px-3 py-2.5 text-right tabular text-[#7c3aed]">{Math.round(totaux.recette).toLocaleString("fr-FR")}</td>
                <td className="px-3 py-2.5 text-right tabular text-[#ca8a04]">{Math.round(totaux.valeurMateriel).toLocaleString("fr-FR")}</td>
                <td className="px-3 py-2.5 text-right tabular text-[#16a34a]">{Math.round(totaux.benefice).toLocaleString("fr-FR")}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </GlassCard>

      <GlassCard className="p-2 overflow-hidden" hover={false}>
        <h3 className="font-bold tracking-tight text-ink px-3 pt-3 mb-2">Par type de brique</h3>
        <table className="w-full min-w-[520px] border-collapse">
          <thead>
            <tr className="text-left text-[11.5px] font-bold text-ink-soft uppercase tracking-wide">
              <th className="px-3 py-3">Type</th>
              <th className="px-3 py-3 text-center">Total vendu</th>
              <th className="px-3 py-3 text-right">Recette</th>
              <th className="px-3 py-3 text-right">Bénéfice</th>
            </tr>
          </thead>
          <tbody>
            {parType.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-[13px] text-ink-soft italic">Aucune donnée.</td></tr>}
            {parType.map((t) => (
              <tr key={t.id} className="text-[13px] hover:bg-white/50 transition-colors">
                <td className="px-3 py-2.5 font-semibold text-ink">{t.nom}</td>
                <td className="px-3 py-2.5 text-center tabular">{t.qte}</td>
                <td className="px-3 py-2.5 text-right tabular text-[#7c3aed]">{Math.round(t.recette).toLocaleString("fr-FR")}</td>
                <td className="px-3 py-2.5 text-right tabular font-bold text-[#16a34a]">{Math.round(t.benefice).toLocaleString("fr-FR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>
    </div>
  );
}
