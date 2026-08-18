import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, Wrench, ArrowDownCircle, ArrowUpCircle, PackageCheck } from "lucide-react";
import TopBarSimple from "../../components/layout/TopBarSimple";
import GlassCard from "../../components/ui/GlassCard";
import StatTile from "../../components/ui/StatTile";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Field, { TextInput, Select } from "../../components/ui/Field";
import Badge from "../../components/ui/Badge";
import { useStockStore } from "../../store/stockStore";
import { useAuthStore } from "../../store/authStore";
import { TYPES_MOUVEMENT_MATERIEL, CAT_MATERIEL_BRIQUETERIE } from "../../data/stockData";

// Matériel E-BRIQUETERIE — équipement propre à l'exploitation (presse à
// briques, brouettes, bétonnière, véhicule de livraison…) pouvant sortir en
// location, à la demande explicite de l'utilisateur (2026-08-18). Même
// principe que Stock magasin de MAXI LOGISTIQUE : référentiel + mouvements
// achat/sortie, Stock initial/Sorties/Reste.
export default function MaterielBriqueterie() {
  const config = useOutletContext();
  const { user } = useAuthStore();
  const {
    referentielMaterielBriqueterie, mouvementsMaterielBriqueterie, stockArticleBriqueterie,
    addMouvementMaterielBriqueterie, ajouterMaterielBriqueterie, chargerMaterielBriqueterie,
  } = useStockStore();

  useEffect(() => { chargerMaterielBriqueterie(); }, [chargerMaterielBriqueterie]);

  const [open, setOpen] = useState(false);
  const [openArticle, setOpenArticle] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ articleId: "", type: "achat", quantite: "", motif: "", date: new Date().toISOString().slice(0, 10) });
  const [articleForm, setArticleForm] = useState({ nom: "", cat: CAT_MATERIEL_BRIQUETERIE[0], unite: "unités", coutAchat: "", tarifLocation: "", initQuantite: "" });

  const lignes = useMemo(() => {
    return referentielMaterielBriqueterie.map((a) => {
      const sorties = mouvementsMaterielBriqueterie.filter((m) => m.articleId === a.id && m.type === "sortie").reduce((s, m) => s + m.quantite, 0);
      return { ...a, stock: stockArticleBriqueterie(a.id), sorties };
    });
  }, [referentielMaterielBriqueterie, mouvementsMaterielBriqueterie, stockArticleBriqueterie]);
  const valeurTotale = lignes.reduce((acc, l) => acc + l.stock * l.coutAchat, 0);
  const enRupture = lignes.filter((l) => l.stock === 0).length;
  const derniersMouvements = mouvementsMaterielBriqueterie.slice(0, 8);

  function openMouvement() {
    setForm((f) => ({ ...f, articleId: referentielMaterielBriqueterie[0]?.id || "" }));
    setError("");
    setOpen(true);
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.quantite || !form.articleId) return;
    setSaving(true);
    setError("");
    const res = await addMouvementMaterielBriqueterie(form, user);
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
    const res = await ajouterMaterielBriqueterie(articleForm);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    setOpenArticle(false);
    setArticleForm({ nom: "", cat: CAT_MATERIEL_BRIQUETERIE[0], unite: "unités", coutAchat: "", tarifLocation: "", initQuantite: "" });
  }

  return (
    <div>
      <TopBarSimple title="Matériel" subtitle={`${config.nom} — équipement de l'exploitation, y compris en location`} icon={Wrench} accent={config.color} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-5">
        <StatTile icon={Wrench} label="Articles référencés" value={String(lignes.length)} tone={config.color} />
        <StatTile icon={PackageCheck} label="Valeur du parc (estimée)" value={Math.round(valeurTotale / 1000) + "k FCFA"} tone="#30D158" />
        <StatTile icon={ArrowDownCircle} label="Articles en rupture" value={String(enRupture)} tone={enRupture > 0 ? "#FF453A" : "#8E8E93"} />
        <StatTile icon={ArrowUpCircle} label="Mouvements enregistrés" value={String(mouvementsMaterielBriqueterie.length)} tone="#5E5CE6" />
      </div>

      <div className="flex flex-wrap justify-end gap-2.5 mb-4">
        <Button variant="ghost" icon={Plus} onClick={() => { setError(""); setOpenArticle(true); }}>Nouvel article</Button>
        <Button icon={Plus} onClick={openMouvement} style={{ background: config.color }} disabled={!referentielMaterielBriqueterie.length}>Nouveau mouvement</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <GlassCard className="p-2 overflow-hidden lg:col-span-2" hover={false}>
          <div className="max-h-[calc(100vh-380px)] overflow-auto">
            <table className="w-full min-w-[580px] border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="text-left text-[11.5px] font-bold text-ink-soft uppercase tracking-wide">
                  <th className="px-4 py-3">Article</th>
                  <th className="px-4 py-3">Catégorie</th>
                  <th className="px-3 py-3 text-center">Stock initial</th>
                  <th className="px-3 py-3 text-center">Sorties (cumul)</th>
                  <th className="px-4 py-3 text-right">Reste</th>
                </tr>
              </thead>
              <tbody>
                {lignes.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-10 text-[13px] text-ink-soft italic">Aucun article — commencez par « Nouvel article ».</td></tr>
                )}
                {lignes.map((l, i) => (
                  <motion.tr key={l.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i, 8) * 0.02 }} className="text-[13.5px] hover:bg-white/50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-ink">{l.nom}</td>
                    <td className="px-4 py-3 text-ink-soft">{l.cat}</td>
                    <td className="px-3 py-3 text-center tabular text-ink-soft">{l.initQuantite}</td>
                    <td className="px-3 py-3 text-center tabular text-[#b3241b]">{l.sorties}</td>
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
              const article = referentielMaterielBriqueterie.find((a) => a.id === m.articleId);
              const info = TYPES_MOUVEMENT_MATERIEL[m.type];
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
        icon={Wrench}
        accent={config.color}
        moduleLabel={config.nom}
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button><Button onClick={submit} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button></>}
      >
        <form onSubmit={submit}>
          {error && <p className="text-[12.5px] text-[#b3241b] bg-[#FF453A]/10 rounded-xl px-3 py-2 mb-3">{error}</p>}
          <Field label="Article">
            <Select value={form.articleId} onChange={(e) => setForm({ ...form, articleId: e.target.value })}>
              {referentielMaterielBriqueterie.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}
            </Select>
          </Field>
          <Field label="Type de mouvement">
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {["achat", "sortie"].map((id) => <option key={id} value={id}>{TYPES_MOUVEMENT_MATERIEL[id].label}</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Quantité">
              <TextInput type="number" min="0" value={form.quantite} onChange={(e) => setForm({ ...form, quantite: e.target.value })} placeholder="1" />
            </Field>
            <Field label="Date">
              <TextInput type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
          </div>
          <Field label="Motif (optionnel)">
            <TextInput value={form.motif} onChange={(e) => setForm({ ...form, motif: e.target.value })} placeholder="Ex : location chantier client X" />
          </Field>
        </form>
      </Modal>

      <Modal
        open={openArticle}
        onClose={() => setOpenArticle(false)}
        title="Nouvel article"
        icon={Wrench}
        accent={config.color}
        moduleLabel={config.nom}
        footer={<><Button variant="ghost" onClick={() => setOpenArticle(false)}>Annuler</Button><Button onClick={submitArticle} disabled={saving}>{saving ? "Création…" : "Créer"}</Button></>}
      >
        <form onSubmit={submitArticle}>
          <Field label="Nom de l'article">
            <TextInput value={articleForm.nom} onChange={(e) => setArticleForm({ ...articleForm, nom: e.target.value })} placeholder="Ex : Bétonnière" autoFocus />
          </Field>
          <Field label="Catégorie">
            <Select value={articleForm.cat} onChange={(e) => setArticleForm({ ...articleForm, cat: e.target.value })}>
              {CAT_MATERIEL_BRIQUETERIE.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Unité">
              <TextInput value={articleForm.unite} onChange={(e) => setArticleForm({ ...articleForm, unite: e.target.value })} placeholder="unités" />
            </Field>
            <Field label="Coût d'achat (FCFA)">
              <TextInput type="number" value={articleForm.coutAchat} onChange={(e) => setArticleForm({ ...articleForm, coutAchat: e.target.value })} placeholder="15000" />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Tarif de location / jour (FCFA)" hint="Informatif — pas encore facturable depuis Prestations">
              <TextInput type="number" value={articleForm.tarifLocation} onChange={(e) => setArticleForm({ ...articleForm, tarifLocation: e.target.value })} placeholder="5000" />
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
