import { Fragment, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, Boxes, ArrowDownCircle, ArrowUpCircle, PackageCheck, AlertTriangle, Lock, Pencil } from "lucide-react";
import TopBarSimple from "../../components/layout/TopBarSimple";
import GlassCard from "../../components/ui/GlassCard";
import StatTile from "../../components/ui/StatTile";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Field, { TextInput, Select } from "../../components/ui/Field";
import { useStockStore } from "../../store/stockStore";
import { useAuthStore } from "../../store/authStore";
import { TYPES_MOUVEMENT_MATERIEL, CAT_MATERIEL } from "../../data/stockData";

const CAT_COLORS = {
  "TENTES & STRUCTURES": "#DC2626",
  "TABLES": "#059669",
  "CHAISES": "#D97706",
  "SONORISATION": "#7C3AED",
  "ÉCLAIRAGE": "#CA8A04",
  "DÉCORATION": "#DB2777",
  "VAISSELLE & SERVICE": "#0891B2",
  "AUTRES": "#52525B",
};

function MvtCell({ total, tone, onClick, sub }) {
  const colors = { green: "text-[#1a7d34]", amber: "text-[#93400a]", sky: "text-[#036799]" };
  return (
    <td className="px-2 py-1.5 text-center">
      <button type="button" onClick={onClick}
        className="mx-auto flex min-w-[4rem] flex-col items-center rounded-xl border border-black/[0.06] px-2 py-1 hover:border-[#0A84FF] hover:bg-[#0A84FF]/5 transition-colors">
        <span className={`font-bold ${colors[tone]}`}>{total}</span>
        {sub && <span className="text-[9px] text-ink-soft/60">{sub}</span>}
      </button>
    </td>
  );
}

export default function StockMateriel() {
  const config = useOutletContext();
  const { user } = useAuthStore();
  // Valeur financière du stock cachée aux agents (à la demande explicite de
  // l'utilisateur, 2026-09-17) : donnée sensible, pas leur rôle de la voir.
  const peutVoirValeurStock = user?.role !== "agent";
  const { referentielMateriel: tousArticles, mouvementsMateriel: tousMouvements, stockArticle, addMouvementMateriel, ajouterArticleMateriel, modifierArticleMateriel } = useStockStore();
  const referentielMateriel = useMemo(() => tousArticles.filter((a) => a.secteurId === config.secteurId), [tousArticles, config.secteurId]);
  const mouvementsMateriel = useMemo(() => tousMouvements.filter((m) => m.secteurId === config.secteurId), [tousMouvements, config.secteurId]);

  const [open, setOpen] = useState(false);
  const [openArticle, setOpenArticle] = useState(false);
  const [articleEnEdition, setArticleEnEdition] = useState(null); // null = création, sinon l'article en cours de modification
  const [detail, setDetail] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ articleId: referentielMateriel[0]?.id, type: "achat", quantite: "", motif: "", date: new Date().toISOString().slice(0, 10) });
  const [articleForm, setArticleForm] = useState({ nom: "", cat: CAT_MATERIEL[0], unite: "unités", coutAchat: "", tarifLocation: "" });

  const cats = useMemo(
    () => CAT_MATERIEL.filter((c) => referentielMateriel.some((a) => a.cat === c)),
    [referentielMateriel]
  );

  const lignes = useMemo(
    () => referentielMateriel.map((a) => {
      const mvts = mouvementsMateriel.filter((m) => m.articleId === a.id);
      const achats = mvts.filter((m) => m.type === "achat").reduce((s, m) => s + m.quantite, 0);
      const sorties = mvts.filter((m) => m.type === "sortie").reduce((s, m) => s + m.quantite, 0);
      const retours = mvts.filter((m) => m.type.startsWith("retour_")).reduce((s, m) => s + m.quantite, 0);
      return { ...a, stock: stockArticle(a.id), achats, sorties, retours, mvts };
    }),
    [referentielMateriel, mouvementsMateriel, stockArticle]
  );
  const valeurTotale = lignes.reduce((acc, l) => acc + l.stock * l.coutAchat, 0);
  const enRupture = lignes.filter((l) => l.stock === 0).length;
  const valeurPertes = mouvementsMateriel
    .filter((m) => m.type === "retour_casse" || m.type === "retour_perdu")
    .reduce((acc, m) => acc + m.quantite * (referentielMateriel.find((a) => a.id === m.articleId)?.coutAchat || 0), 0);

  async function submit(e) {
    e.preventDefault();
    if (!form.quantite || !form.articleId) return;
    setSaving(true);
    setError("");
    const res = await addMouvementMateriel({ ...form, secteurId: config.secteurId }, user);
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
    const res = articleEnEdition
      ? await modifierArticleMateriel(articleEnEdition.id, articleForm)
      : await ajouterArticleMateriel({ ...articleForm, secteurId: config.secteurId });
    setSaving(false);
    if (!res.ok) return setError(res.error);
    setOpenArticle(false);
    setArticleEnEdition(null);
    setArticleForm({ nom: "", cat: CAT_MATERIEL[0], unite: "unités", coutAchat: "", tarifLocation: "" });
  }

  function ouvrirNouvelArticle(catPreremplie) {
    setArticleEnEdition(null);
    setArticleForm({ nom: "", cat: catPreremplie || CAT_MATERIEL[0], unite: "unités", coutAchat: "", tarifLocation: "" });
    setError("");
    setOpenArticle(true);
  }

  function ouvrirModificationArticle(article) {
    setArticleEnEdition(article);
    setArticleForm({ nom: article.nom, cat: article.cat, unite: article.unite, coutAchat: String(article.coutAchat || ""), tarifLocation: String(article.tarifLocation || "") });
    setError("");
    setOpenArticle(true);
  }

  function ouvrirDetail(ligne, type) {
    setDetail({ nom: ligne.nom, type, mvts: ligne.mvts.filter((m) => type === "retour" ? m.type.startsWith("retour_") : m.type === type) });
  }

  const DETAIL_TITRES = { achat: "Achats", sortie: "Sorties", retour: "Retours" };

  return (
    <div>
      <TopBarSimple title="Stock magasin" subtitle={`${config.nom} : matériel disponible et mouvements`} icon={Boxes} accent={config.color} />

      <div className={`grid grid-cols-2 gap-4 sm:gap-5 mb-5 ${peutVoirValeurStock ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
        <StatTile icon={Boxes} label="Articles référencés" value={String(lignes.length)} tone={config.color} />
        {peutVoirValeurStock && (
          <StatTile icon={PackageCheck} label="Valeur du stock (estimée)" value={Math.round(valeurTotale / 1000) + "k FCFA"} tone="#30D158" />
        )}
        <StatTile icon={ArrowDownCircle} label="Articles en rupture" value={String(enRupture)} tone={enRupture > 0 ? "#FF453A" : "#8E8E93"} />
        <StatTile icon={ArrowUpCircle} label="Mouvements enregistrés" value={String(mouvementsMateriel.length)} tone="#5E5CE6" />
        <StatTile icon={AlertTriangle} label="Pertes cumulées (casse/perdu)" value={Math.round(valeurPertes / 1000) + "k FCFA"} tone={valeurPertes > 0 ? "#FF453A" : "#8E8E93"} />
      </div>

      <div className="flex flex-wrap justify-end gap-2.5 mb-4">
        <Button variant="ghost" icon={Plus} onClick={() => ouvrirNouvelArticle()}>Nouvel article</Button>
        <Button icon={Plus} onClick={() => setOpen(true)} style={{ background: config.color }}>Nouveau mouvement</Button>
      </div>

      <GlassCard className="p-2 overflow-hidden" hover={false}>
        <div className="max-h-[calc(100vh-22rem)] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-white/80 backdrop-blur-md text-[11px] uppercase text-ink-soft">
              <tr>
                <th className="sticky left-0 z-20 bg-white/80 backdrop-blur-md px-3 py-2 text-left">Matériel</th>
                <th className="px-2 py-2 text-center">Stock initial <Lock size={10} className="inline -mt-0.5" /></th>
                <th className="px-2 py-2 text-center">Achats</th>
                <th className="px-2 py-2 text-center">Sorties</th>
                <th className="px-2 py-2 text-center">Retours</th>
                <th className="px-2 py-2 text-center">Stock final <Lock size={10} className="inline -mt-0.5" /></th>
                <th className="px-2 py-2 text-center">Location / j</th>
                <th className="px-2 py-2 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {cats.map((cat) => (
                <Fragment key={cat}>
                  <tr>
                    <td colSpan={8} className="sticky left-0 px-3 py-1.5 text-xs font-bold uppercase text-white" style={{ background: CAT_COLORS[cat] || "#8E8E93" }}>
                      <div className="flex items-center justify-between">
                        <span>{cat}</span>
                        <button
                          type="button"
                          onClick={() => ouvrirNouvelArticle(cat)}
                          title={`Ajouter un article dans ${cat}`}
                          className="flex items-center gap-1 rounded-lg bg-white/20 hover:bg-white/30 px-2 py-0.5 text-[10.5px] font-bold normal-case transition-colors"
                        >
                          <Plus size={11} strokeWidth={2.6} /> Article
                        </button>
                      </div>
                    </td>
                  </tr>
                  {lignes.filter((l) => l.cat === cat).map((l, i) => (
                    <motion.tr key={l.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i, 8) * 0.02 }} className="group">
                      <td className="sticky left-0 z-10 bg-white px-3 py-1.5 font-semibold text-ink group-hover:bg-black/[0.02]">
                        {l.nom} <span className="text-[10px] text-ink-soft/60">({l.unite})</span>
                      </td>
                      <td className="px-2 py-1.5 text-center tabular text-ink-soft">{l.initQuantite}</td>
                      <MvtCell total={l.achats} tone="green" onClick={() => ouvrirDetail(l, "achat")} />
                      <MvtCell total={l.sorties} tone="amber" onClick={() => ouvrirDetail(l, "sortie")} />
                      <MvtCell total={l.retours} tone="sky" sub="via Retour" onClick={() => ouvrirDetail(l, "retour")} />
                      <td className="px-2 py-1.5 text-center font-bold" style={{ color: l.stock === 0 ? "#FF453A" : config.color }}>{l.stock}</td>
                      <td className="px-2 py-1.5 text-center tabular text-ink-soft">{l.tarifLocation ? `${l.tarifLocation.toLocaleString("fr-FR")} F` : "—"}</td>
                      <td className="px-2 py-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => ouvrirModificationArticle(l)}
                          title="Modifier cet article"
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-ink-soft/60 hover:bg-black/5 hover:text-ink transition-colors"
                        >
                          <Pencil size={13} strokeWidth={2.2} />
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Nouveau mouvement de stock"
        icon={Boxes}
        accent={config.color}
        moduleLabel={config.nom}
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button><Button onClick={submit} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button></>}
      >
        <form onSubmit={submit}>
          {error && <p className="text-[12.5px] text-[#b3241b] bg-[#FF453A]/10 rounded-xl px-3 py-2 mb-3">{error}</p>}
          <Field label="Article">
            <Select value={form.articleId} onChange={(e) => setForm({ ...form, articleId: e.target.value })}>
              {referentielMateriel.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}
            </Select>
          </Field>
          <Field label="Type de mouvement" hint="Les retours se saisissent depuis le volet Retour">
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {["achat", "sortie"].map((id) => <option key={id} value={id}>{TYPES_MOUVEMENT_MATERIEL[id].label}</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Quantité">
              <TextInput type="number" value={form.quantite} onChange={(e) => setForm({ ...form, quantite: e.target.value })} placeholder="5" />
            </Field>
            <Field label="Date">
              <TextInput type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
          </div>
          <Field label="Motif (optionnel)">
            <TextInput value={form.motif} onChange={(e) => setForm({ ...form, motif: e.target.value })} placeholder="Ex : chantier client X" />
          </Field>
        </form>
      </Modal>

      <Modal
        open={openArticle}
        onClose={() => { setOpenArticle(false); setArticleEnEdition(null); }}
        title={articleEnEdition ? "Modifier l'article" : "Nouvel article"}
        icon={articleEnEdition ? Pencil : Boxes}
        accent={config.color}
        moduleLabel={config.nom}
        footer={<><Button variant="ghost" onClick={() => { setOpenArticle(false); setArticleEnEdition(null); }}>Annuler</Button><Button onClick={submitArticle} disabled={saving}>{saving ? "Enregistrement…" : articleEnEdition ? "Enregistrer" : "Créer"}</Button></>}
      >
        <form onSubmit={submitArticle}>
          {error && <p className="text-[12.5px] text-[#b3241b] bg-[#FF453A]/10 rounded-xl px-3 py-2 mb-3">{error}</p>}
          <Field label="Nom de l'article">
            <TextInput value={articleForm.nom} onChange={(e) => setArticleForm({ ...articleForm, nom: e.target.value })} placeholder="Ex : Groupe électrogène" />
          </Field>
          <Field label="Catégorie">
            <Select value={articleForm.cat} onChange={(e) => setArticleForm({ ...articleForm, cat: e.target.value })}>
              {CAT_MATERIEL.map((c) => <option key={c} value={c}>{c}</option>)}
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
          <Field label="Tarif de location / jour (FCFA)" hint="Utilisé pour calculer automatiquement le montant d'une prestation en Facturation">
            <TextInput type="number" value={articleForm.tarifLocation} onChange={(e) => setArticleForm({ ...articleForm, tarifLocation: e.target.value })} placeholder="5000" />
          </Field>
        </form>
      </Modal>

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `${DETAIL_TITRES[detail.type]} : ${detail.nom}` : ""}
        icon={Boxes}
        accent={config.color}
        moduleLabel={config.nom}
        footer={<Button variant="ghost" onClick={() => setDetail(null)}>Fermer</Button>}
      >
        {detail?.type === "retour" && (
          <p className="mb-3 rounded-xl bg-[#0A84FF]/10 px-3 py-2 text-[12px] text-[#0a5cb3]">
            Les retours s'enregistrent depuis le volet <strong>Retour</strong>, ils apparaissent ici en lecture seule.
          </p>
        )}
        {!detail?.mvts?.length ? (
          <p className="py-6 text-center text-[13px] text-ink-soft/60">Aucun mouvement de ce type.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {detail.mvts.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-xl bg-black/[0.03] px-3 py-2 text-[12.5px]">
                <span className="text-ink-soft">{new Date(m.date).toLocaleDateString("fr-FR")}</span>
                <span className="font-bold text-ink">{m.quantite}</span>
                <span className="text-ink-soft truncate max-w-[45%]">{m.motif || "—"}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
