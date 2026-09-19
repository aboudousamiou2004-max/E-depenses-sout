import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, FileText, Trash2 } from "lucide-react";
import TopBarSimple from "../../components/layout/TopBarSimple";
import GlassCard from "../../components/ui/GlassCard";
import StatTile from "../../components/ui/StatTile";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Field, { TextInput, Select } from "../../components/ui/Field";
import RecetteDetailModal from "../../components/RecetteDetailModal";
import { useDataStore } from "../../store/dataStore";
import { useAuthStore } from "../../store/authStore";
import { useStockStore } from "../../store/stockStore";
import { useGymStore, niveauLabel } from "../../store/gymStore";
import { useUIStore } from "../../store/uiStore";
import { fmtFCFA, fmtCompact, totalMontant, matchPeriode } from "../../lib/logic";
import { peutModifier as peutModifierRole, peutSupprimer as peutSupprimerRole } from "../../lib/modules";

export default function BusinessFacturation() {
  const config = useOutletContext();
  const { secteurs, recettes, addRecette, modifierRecette, supprimerRecette } = useDataStore();
  const { user } = useAuthStore();
  const { typesBriques, stockBriques, venteBriques, referentielMateriel: tousArticlesMateriel, addMouvementMateriel } = useStockStore();
  const { forfaits, chargerForfaits } = useGymStore();
  const { periode, recherche } = useUIStore();
  const venteDeBriques = config.stock === "briques";
  const locationMateriel = config.stock === "materiel";
  const referentielMateriel = useMemo(() => tousArticlesMateriel.filter((a) => a.secteurId === config.secteurId), [tousArticlesMateriel, config.secteurId]);

  useEffect(() => {
    if (config.forfaits) chargerForfaits(config.secteurId);
  }, [config.forfaits, config.secteurId]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [respecterPeriode, setRespecterPeriode] = useState(false);
  const [selection, setSelection] = useState(null);
  const peutModifier = peutModifierRole(user?.role);
  const peutSupprimer = peutSupprimerRole(user?.role);

  const [form, setForm] = useState({
    type: config.typesFacturation[0],
    client: "",
    description: "",
    montant: "",
    date: new Date().toISOString().slice(0, 10),
    dateSortie: new Date().toISOString().slice(0, 10),
    dateRetour: new Date().toISOString().slice(0, 10),
    briqueTypeId: typesBriques[0]?.id,
    briqueQuantite: "",
    lignes: [{ articleId: referentielMateriel[0]?.id, qte: 1, jours: 1 }],
    forfaitNiveau: "simple",
  });

  const isVenteBriques = venteDeBriques && form.type === "Vente de briques";
  const briqueChoisie = typesBriques.find((t) => t.id === form.briqueTypeId);
  const stockDispoBrique = briqueChoisie ? stockBriques[briqueChoisie.id]?.pret || 0 : 0;

  const isLocationOuPrestation = locationMateriel && (form.type === "Location" || form.type === "Prestation");

  // MAXI GYM : une Séance ou un Abonnement se facture selon l'un des 3
  // forfaits (voir « Nos forfaits ») — le prix se remplit automatiquement,
  // sauf pour le forfait Classique dont le tarif est négocié à la saisie.
  const isSeanceOuAbonnementGym = config.forfaits && (form.type === "Séance" || form.type === "Abonnement");
  const forfaitChoisi = forfaits.find((f) => f.niveau === form.forfaitNiveau);
  const prixForfait = form.type === "Séance" ? forfaitChoisi?.prixSeance : forfaitChoisi?.prixAbonnement;
  const prixForfaitLibre = isSeanceOuAbonnementGym && (prixForfait === null || prixForfait === undefined);

  function articleDe(id) { return referentielMateriel.find((a) => a.id === id); }
  function ligneMontant(l) { return (Number(l.qte) || 0) * (Number(l.jours) || 0) * (articleDe(l.articleId)?.tarifLocation || 0); }
  const totalLignes = form.lignes.reduce((s, l) => s + ligneMontant(l), 0);

  function ajouterLigne() {
    setForm((f) => ({ ...f, lignes: [...f.lignes, { articleId: referentielMateriel[0]?.id, qte: 1, jours: 1 }] }));
  }
  function retirerLigne(i) {
    setForm((f) => ({ ...f, lignes: f.lignes.filter((_, k) => k !== i) }));
  }
  function modifierLigne(i, patch) {
    setForm((f) => ({ ...f, lignes: f.lignes.map((l, k) => (k === i ? { ...l, ...patch } : l)) }));
  }

  const liste = useMemo(() => {
    let rows = recettes.filter((r) => r.secteurId === config.secteurId).sort((a, b) => (a.date < b.date ? 1 : -1));
    if (respecterPeriode) rows = rows.filter((r) => matchPeriode(r.date, periode));
    if (recherche.trim()) {
      const q = recherche.toLowerCase();
      rows = rows.filter((r) => r.origine.toLowerCase().includes(q));
    }
    return rows.slice(0, 60);
  }, [recettes, config.secteurId, respecterPeriode, periode, recherche]);
  const total = totalMontant(liste);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    if (isVenteBriques) {
      const qte = Math.min(Number(form.briqueQuantite) || 0, stockDispoBrique);
      if (qte <= 0) {
        setSaving(false);
        return;
      }
      const montant = qte * (briqueChoisie?.tarifVente || 0);
      const res = await addRecette(
        { secteurId: config.secteurId, montant, date: form.date, origine: `${form.type} : ${briqueChoisie?.nom}`, client: form.client, description: form.description },
        user
      );
      if (!res.ok) {
        setSaving(false);
        return setError(res.error);
      }
      const resVente = await venteBriques(briqueChoisie.id, qte, user);
      setSaving(false);
      if (!resVente.ok) return setError(resVente.error);
    } else if (isLocationOuPrestation) {
      const lignesValides = form.lignes.filter((l) => articleDe(l.articleId) && ligneMontant(l) > 0);
      if (!lignesValides.length) {
        setSaving(false);
        return setError("Ajoutez au moins une ligne avec un article, une quantité, un nombre de jours et un tarif réglé");
      }
      for (const l of lignesValides) {
        const article = articleDe(l.articleId);
        const res = await addRecette(
          {
            secteurId: config.secteurId, montant: ligneMontant(l), date: form.dateSortie, dateRetour: form.dateRetour,
            origine: `${form.type} : ${article.nom} (${l.jours}j)`, client: form.client, description: form.description,
            articleId: l.articleId, quantite: Number(l.qte) || 0, jours: Number(l.jours) || 0,
          },
          user
        );
        if (!res.ok) {
          setSaving(false);
          return setError(res.error);
        }
        const resSortie = await addMouvementMateriel(
          { articleId: l.articleId, type: "sortie", quantite: l.qte, motif: `${form.type} : ${form.client || "client"}`, date: form.dateSortie, secteurId: config.secteurId },
          user
        );
        if (!resSortie.ok) {
          setSaving(false);
          return setError(resSortie.error);
        }
      }
      setSaving(false);
    } else if (isSeanceOuAbonnementGym) {
      const montant = prixForfaitLibre ? Number(form.montant) || 0 : Number(prixForfait) || 0;
      if (montant <= 0) {
        setSaving(false);
        return setError("Montant requis");
      }
      const res = await addRecette(
        { secteurId: config.secteurId, montant, date: form.date, origine: `${form.type} : ${niveauLabel(form.forfaitNiveau)}`, client: form.client, description: form.description },
        user
      );
      setSaving(false);
      if (!res.ok) return setError(res.error);
    } else {
      if (!form.montant) {
        setSaving(false);
        return;
      }
      const res = await addRecette(
        { secteurId: config.secteurId, montant: Number(form.montant), date: form.date, origine: form.type, client: form.client, description: form.description },
        user
      );
      setSaving(false);
      if (!res.ok) return setError(res.error);
    }
    setOpen(false);
    setForm((f) => ({
      ...f, montant: "", client: "", description: "", briqueQuantite: "",
      lignes: [{ articleId: referentielMateriel[0]?.id, qte: 1, jours: 1 }],
    }));
  }

  return (
    <div>
      <TopBarSimple title="Prestations" subtitle={`${config.nom} : prestations et locations facturées`} icon={FileText} accent={config.color} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-5">
        <StatTile icon={FileText} label="Total facturé (affiché)" value={fmtCompact(total) + " FCFA"} tone={config.color} />
      </div>

      <div className="flex items-center gap-3 flex-wrap mb-4">
        <label className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-soft cursor-pointer">
          <input type="checkbox" checked={respecterPeriode} onChange={(e) => setRespecterPeriode(e.target.checked)} className="w-4 h-4 rounded accent-[#0A84FF]" />
          Limiter à la période sélectionnée
        </label>
        <Button icon={Plus} onClick={() => setOpen(true)} style={{ background: config.color }} className="w-full sm:w-auto sm:ml-auto">
          Nouvelle facture
        </Button>
      </div>

      <GlassCard className="p-2 overflow-hidden" hover={false}>
        <div className="max-h-[calc(100vh-320px)] overflow-auto">
          <table className="w-full min-w-[520px] border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="text-left text-[11.5px] font-bold text-ink-soft uppercase tracking-wide">
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Montant</th>
              </tr>
            </thead>
            <tbody>
              {liste.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-10 text-[13px] text-ink-soft italic">Aucune facture pour ce secteur.</td>
                </tr>
              )}
              {liste.map((r, i) => (
                <motion.tr
                  key={r.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i, 8) * 0.02 }}
                  onClick={() => setSelection(r)}
                  className="text-[13.5px] hover:bg-white/50 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold" style={{ background: `${config.color}1f`, color: config.color }}>
                      {r.origine}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{r.client || "—"}</td>
                  <td className="px-4 py-3 text-ink-soft tabular">{new Date(r.date).toLocaleDateString("fr-FR")}</td>
                  <td className="px-4 py-3 text-right font-bold tabular text-[#1a7d34]">+{fmtFCFA(r.montant)}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Nouvelle facture"
        icon={FileText}
        accent={config.color}
        moduleLabel={config.nom}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
            <Button icon={FileText} onClick={submit} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
          </>
        }
      >
        <form onSubmit={submit}>
          {error && <p className="text-[12.5px] text-[#b3241b] bg-[#FF453A]/10 rounded-xl px-3 py-2 mb-3">{error}</p>}
          <Field label="Type" hint="Suggestions du secteur, ou saisie libre">
            <TextInput list="types-facturation-suggestions" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} placeholder="ex : Prestation" />
            <datalist id="types-facturation-suggestions">
              {config.typesFacturation.map((t) => <option key={t} value={t} />)}
            </datalist>
          </Field>
          <Field label="Client">
            <TextInput value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} placeholder="Nom du client" />
          </Field>

          {isVenteBriques ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Type de brique">
                  <Select value={form.briqueTypeId} onChange={(e) => setForm({ ...form, briqueTypeId: e.target.value })}>
                    {typesBriques.map((t) => <option key={t.id} value={t.id}>{t.nom}</option>)}
                  </Select>
                </Field>
                <Field label={`Quantité (stock prêt : ${stockDispoBrique})`}>
                  <TextInput type="number" value={form.briqueQuantite} onChange={(e) => setForm({ ...form, briqueQuantite: e.target.value })} placeholder="500" />
                </Field>
              </div>
              {Number(form.briqueQuantite) > stockDispoBrique && (
                <p className="text-[12px] text-[#b3241b] -mt-2 mb-3">Quantité limitée au stock prêt disponible ({stockDispoBrique}).</p>
              )}
              <p className="text-[12.5px] text-ink-soft -mt-1 mb-3">
                Montant estimé : <span className="font-bold text-ink">{fmtFCFA(Math.min(Number(form.briqueQuantite) || 0, stockDispoBrique) * (briqueChoisie?.tarifVente || 0))}</span>
              </p>
            </>
          ) : isSeanceOuAbonnementGym ? (
            <>
              <Field label="Forfait">
                <Select value={form.forfaitNiveau} onChange={(e) => setForm({ ...form, forfaitNiveau: e.target.value })}>
                  {forfaits.map((f) => <option key={f.niveau} value={f.niveau}>{niveauLabel(f.niveau)}</option>)}
                </Select>
              </Field>
              {form.type === "Séance" && forfaitChoisi && !forfaitChoisi.seanceProposee && (
                <p className="text-[12px] text-[#b3241b] -mt-2 mb-3">Ce forfait ne propose pas de séance à l'unité : choisissez « Abonnement » ou un autre forfait.</p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {prixForfaitLibre ? (
                  <Field label="Montant (FCFA)" hint="Tarif négocié à la souscription">
                    <TextInput type="number" min="0" value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} />
                  </Field>
                ) : (
                  <Field label="Montant">
                    <p className="glass w-full rounded-2xl px-3.5 py-2.5 text-[14px] font-bold text-ink">{fmtFCFA(prixForfait || 0)}</p>
                  </Field>
                )}
                <Field label="Date">
                  <TextInput type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </Field>
              </div>
            </>
          ) : isLocationOuPrestation ? (
            <>
              <p className="mb-1.5 text-[12.5px] font-semibold text-ink-soft">
                {form.type === "Prestation" ? "Matériel mis à disposition" : "Articles loués"}
              </p>
              {form.lignes.map((l, i) => {
                const article = articleDe(l.articleId);
                return (
                  <div key={i} className="rounded-2xl border border-black/[0.06] p-3 mb-2.5">
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-end">
                      <Field label="Article">
                        <Select value={l.articleId} onChange={(e) => modifierLigne(i, { articleId: e.target.value })}>
                          {referentielMateriel.map((a) => <option key={a.id} value={a.id}>{a.nom} ({fmtFCFA(a.tarifLocation)}/j)</option>)}
                        </Select>
                      </Field>
                      {form.lignes.length > 1 && (
                        <button type="button" onClick={() => retirerLigne(i)} className="w-10 h-10 mb-3.5 rounded-xl flex items-center justify-center text-ink-soft hover:bg-[#FF453A]/10 hover:text-[#FF453A] transition-colors">
                          <Trash2 size={15} strokeWidth={2.2} />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Quantité">
                        <TextInput type="number" min="1" value={l.qte} onChange={(e) => modifierLigne(i, { qte: e.target.value })} />
                      </Field>
                      <Field label="Nombre de jours">
                        <TextInput type="number" min="1" value={l.jours} onChange={(e) => modifierLigne(i, { jours: e.target.value })} />
                      </Field>
                    </div>
                    {article?.tarifLocation > 0 ? (
                      <p className="text-[12.5px] text-ink-soft -mt-1">
                        Montant : <span className="font-bold text-ink">{fmtFCFA(ligneMontant(l))}</span> ({l.qte} × {l.jours}j × {fmtFCFA(article.tarifLocation)})
                      </p>
                    ) : (
                      <p className="text-[12px] text-[#b3241b] -mt-1">Aucun tarif de location réglé pour cet article : réglez-le depuis Stock magasin.</p>
                    )}
                  </div>
                );
              })}
              <Button type="button" variant="ghost" icon={Plus} onClick={ajouterLigne} className="mb-3">Ajouter une ligne</Button>
              <p className="text-right text-[15px] font-extrabold text-ink mb-3">Total : {fmtFCFA(totalLignes)}</p>
              <p className="text-[11.5px] text-ink-soft/70 -mt-1 mb-3">
                Ces quantités seront automatiquement sorties du stock magasin à l'enregistrement.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Date de sortie">
                  <TextInput type="date" value={form.dateSortie} onChange={(e) => setForm({ ...form, dateSortie: e.target.value })} />
                </Field>
                <Field label="Date de retour prévue">
                  <TextInput type="date" value={form.dateRetour} onChange={(e) => setForm({ ...form, dateRetour: e.target.value })} />
                </Field>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Montant (FCFA)">
                <TextInput type="number" value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} placeholder="150 000" />
              </Field>
              <Field label="Date">
                <TextInput type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </Field>
            </div>
          )}
          {isVenteBriques && (
            <Field label="Date">
              <TextInput type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
          )}
          <Field label="Description">
            <TextInput value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Détail de la prestation" />
          </Field>
          <p className="text-[12px] text-ink-soft">Cette facture sera comptée comme une recette du secteur {config.nom}, visible aussi dans E-DÉPENSES.</p>
        </form>
      </Modal>

      <RecetteDetailModal
        recette={selection}
        secteurs={secteurs}
        peutModifier={peutModifier}
        peutSupprimer={peutSupprimer}
        modifierRecette={modifierRecette}
        supprimerRecette={supprimerRecette}
        currentUser={user}
        onClose={() => setSelection(null)}
      />
    </div>
  );
}
