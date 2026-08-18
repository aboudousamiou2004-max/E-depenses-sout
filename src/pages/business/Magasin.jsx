import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, Warehouse, Wrench, Wheat, Boxes, ArrowDownCircle } from "lucide-react";
import TopBarSimple from "../../components/layout/TopBarSimple";
import GlassCard from "../../components/ui/GlassCard";
import StatTile from "../../components/ui/StatTile";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Field, { TextInput, Select } from "../../components/ui/Field";
import Badge from "../../components/ui/Badge";
import { useStockStore } from "../../store/stockStore";
import { useAuthStore } from "../../store/authStore";
import { TYPES_MOUVEMENT_MAGASIN, CAT_MATERIEL_AGRO, CAT_ALIMENTS } from "../../data/stockData";

// Magasin MAXI AGRO — deux référentiels distincts du cheptel (Saisie
// journalière) : le matériel/machines de l'exploitation (tracteur, brouette,
// pompe, groupe électrogène…) et les aliments/divers stockés au silo
// (tourteau de maïs, son, sels, gasoil…) — cf. termitiere-platform
// src/modules/agro/data.js (ALIMENTS, DIVERS), sorti ici en volet dédié
// plutôt qu'en onglet de la Saisie journalière (qui reste centrée cheptel).
// Même principe que StockMateriel.jsx (MAXI LOGISTIQUE) : référentiel +
// mouvements achat/sortie, solde cumulé plutôt qu'inventaire journalier.
export default function Magasin() {
  const config = useOutletContext();
  const { chargerMagasinAgro } = useStockStore();
  const [tab, setTab] = useState("materiel");

  useEffect(() => { chargerMagasinAgro(); }, [chargerMagasinAgro]);

  return (
    <div>
      <TopBarSimple title="Magasin" subtitle={`${config.nom} — matériel, machines & aliments (silo)`} accent={config.color} />

      <div className="flex flex-wrap items-center gap-1 rounded-2xl bg-black/[0.03] p-1 mb-4">
        {[
          { v: "materiel", l: "Matériel & Machines", Icon: Wrench },
          { v: "aliments", l: "Aliments (Silo)", Icon: Wheat },
        ].map((onglet) => (
          <button key={onglet.v} onClick={() => setTab(onglet.v)}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${tab === onglet.v ? "bg-white text-ink shadow-sm" : "text-ink-soft hover:text-ink"}`}>
            <onglet.Icon size={14} /> {onglet.l}
          </button>
        ))}
      </div>

      {tab === "materiel" && (
        <MagasinSection
          config={config}
          icon={Wrench}
          unitePlaceholder="unités"
          categories={CAT_MATERIEL_AGRO}
          referentielKey="referentielMaterielAgro"
          mouvementsKey="mouvementsMaterielAgro"
          soldeSelector={(s) => s.stockArticleAgro}
          ajouterArticle="ajouterMaterielAgro"
          addMouvement="addMouvementMaterielAgro"
          nomExemple="Ex : Groupe électrogène"
        />
      )}
      {tab === "aliments" && (
        <MagasinSection
          config={config}
          icon={Wheat}
          unitePlaceholder="kg"
          categories={CAT_ALIMENTS}
          referentielKey="referentielAliments"
          mouvementsKey="mouvementsAliments"
          soldeSelector={(s) => s.stockAliment}
          ajouterArticle="ajouterAliment"
          addMouvement="addMouvementAliment"
          nomExemple="Ex : Tourteau de maïs"
        />
      )}
    </div>
  );
}

function MagasinSection({ config, icon: Icon, unitePlaceholder, categories, referentielKey, mouvementsKey, soldeSelector, ajouterArticle, addMouvement, nomExemple }) {
  const { user } = useAuthStore();
  const store = useStockStore();
  const referentiel = store[referentielKey];
  const mouvements = store[mouvementsKey];
  const stockDe = soldeSelector(store);
  const actionAjouter = store[ajouterArticle];
  const actionMouvement = store[addMouvement];

  const [open, setOpen] = useState(false);
  const [openArticle, setOpenArticle] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ articleId: "", type: "achat", quantite: "", motif: "", date: new Date().toISOString().slice(0, 10) });
  const [articleForm, setArticleForm] = useState({ nom: "", cat: categories[0], unite: unitePlaceholder, initQuantite: "" });

  const lignes = useMemo(() => referentiel.map((a) => ({ ...a, stock: stockDe(a.id) })), [referentiel, mouvements, stockDe]);
  const enRupture = lignes.filter((l) => l.stock === 0).length;
  const derniersMouvements = mouvements.slice(0, 8);

  function openMouvement() {
    setForm((f) => ({ ...f, articleId: referentiel[0]?.id || "" }));
    setError("");
    setOpen(true);
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.quantite || !form.articleId) return;
    setSaving(true);
    setError("");
    const res = await actionMouvement(form, user);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    setOpen(false);
    setForm((f) => ({ ...f, quantite: "", motif: "" }));
  }

  async function submitArticle(e) {
    e.preventDefault();
    if (!articleForm.nom) return;
    setSaving(true);
    setError("");
    const res = await actionAjouter(articleForm);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    setOpenArticle(false);
    setArticleForm({ nom: "", cat: categories[0], unite: unitePlaceholder, initQuantite: "" });
  }

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 mb-5">
        <StatTile icon={Icon} label="Articles référencés" value={String(lignes.length)} tone={config.color} />
        <StatTile icon={ArrowDownCircle} label="Articles en rupture" value={String(enRupture)} tone={enRupture > 0 ? "#FF453A" : "#8E8E93"} />
        <StatTile icon={Boxes} label="Mouvements enregistrés" value={String(mouvements.length)} tone="#5E5CE6" />
      </div>

      <div className="flex flex-wrap justify-end gap-2.5 mb-4">
        <Button variant="ghost" icon={Plus} onClick={() => { setError(""); setOpenArticle(true); }}>Nouvel article</Button>
        <Button icon={Plus} onClick={openMouvement} style={{ background: config.color }} disabled={!referentiel.length}>Nouveau mouvement</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <GlassCard className="p-2 overflow-hidden lg:col-span-2" hover={false}>
          <div className="max-h-[calc(100vh-380px)] overflow-auto">
            <table className="w-full min-w-[420px] border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="text-left text-[11.5px] font-bold text-ink-soft uppercase tracking-wide">
                  <th className="px-4 py-3">Article</th>
                  <th className="px-4 py-3">Catégorie</th>
                  <th className="px-4 py-3 text-right">Stock actuel</th>
                </tr>
              </thead>
              <tbody>
                {lignes.length === 0 && (
                  <tr><td colSpan={3} className="text-center py-10 text-[13px] text-ink-soft italic">
                    <Warehouse size={22} className="inline-block mb-1.5 opacity-40" /><br />Aucun article — commencez par « Nouvel article ».
                  </td></tr>
                )}
                {lignes.map((l, i) => (
                  <motion.tr key={l.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i, 8) * 0.02 }} className="text-[13.5px] hover:bg-white/50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-ink">{l.nom}</td>
                    <td className="px-4 py-3 text-ink-soft">{l.cat}</td>
                    <td className="px-4 py-3 text-right">
                      <Badge tone={l.stock === 0 ? "coral" : l.stock < 5 ? "amber" : "mint"}>{l.stock} {l.unite}</Badge>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>

        <GlassCard className="p-5" hover={false}>
          <h3 className="font-bold tracking-tight text-ink mb-3">Derniers mouvements</h3>
          <div className="flex flex-col gap-2.5">
            {derniersMouvements.length === 0 && <p className="text-[13px] text-ink-soft italic">Aucun mouvement.</p>}
            {derniersMouvements.map((m) => {
              const article = referentiel.find((a) => a.id === m.articleId);
              const info = TYPES_MOUVEMENT_MAGASIN[m.type];
              return (
                <div key={m.id} className="text-[12.5px] px-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-ink truncate">{article?.nom}</span>
                    <span className={`font-bold tabular ${info.signe > 0 ? "text-[#1a7d34]" : "text-[#b3241b]"}`}>
                      {info.signe > 0 ? "+" : "-"}{m.quantite}
                    </span>
                  </div>
                  <p className="text-ink-soft text-[11.5px]">{info.label} · {new Date(m.date).toLocaleDateString("fr-FR")}</p>
                </div>
              );
            })}
          </div>
        </GlassCard>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Nouveau mouvement"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button><Button onClick={submit} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button></>}
      >
        <form onSubmit={submit}>
          {error && <p className="text-[12.5px] text-[#b3241b] bg-[#FF453A]/10 rounded-xl px-3 py-2 mb-3">{error}</p>}
          <Field label="Article">
            <Select value={form.articleId} onChange={(e) => setForm({ ...form, articleId: e.target.value })}>
              {referentiel.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}
            </Select>
          </Field>
          <Field label="Type de mouvement">
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {Object.entries(TYPES_MOUVEMENT_MAGASIN).map(([id, t]) => <option key={id} value={id}>{t.label}</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Quantité">
              <TextInput type="number" min="0" value={form.quantite} onChange={(e) => setForm({ ...form, quantite: e.target.value })} placeholder="5" />
            </Field>
            <Field label="Date">
              <TextInput type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
          </div>
          <Field label="Motif (optionnel)">
            <TextInput value={form.motif} onChange={(e) => setForm({ ...form, motif: e.target.value })} placeholder="Ex : ravitaillement mensuel" />
          </Field>
        </form>
      </Modal>

      <Modal
        open={openArticle}
        onClose={() => setOpenArticle(false)}
        title="Nouvel article"
        footer={<><Button variant="ghost" onClick={() => setOpenArticle(false)}>Annuler</Button><Button onClick={submitArticle} disabled={saving}>{saving ? "Création…" : "Créer"}</Button></>}
      >
        <form onSubmit={submitArticle}>
          {error && <p className="text-[12.5px] text-[#b3241b] bg-[#FF453A]/10 rounded-xl px-3 py-2 mb-3">{error}</p>}
          <Field label="Nom de l'article">
            <TextInput value={articleForm.nom} onChange={(e) => setArticleForm({ ...articleForm, nom: e.target.value })} placeholder={nomExemple} autoFocus />
          </Field>
          <Field label="Catégorie">
            <Select value={articleForm.cat} onChange={(e) => setArticleForm({ ...articleForm, cat: e.target.value })}>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Unité">
              <TextInput value={articleForm.unite} onChange={(e) => setArticleForm({ ...articleForm, unite: e.target.value })} placeholder={unitePlaceholder} />
            </Field>
            <Field label="Stock initial" hint="0 si aucun stock actuel">
              <TextInput type="number" min="0" value={articleForm.initQuantite} onChange={(e) => setArticleForm({ ...articleForm, initQuantite: e.target.value })} placeholder="0" />
            </Field>
          </div>
        </form>
      </Modal>
    </div>
  );
}
