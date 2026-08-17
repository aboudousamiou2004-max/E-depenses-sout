import { Fragment, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Plus, Trash2, Lock } from "lucide-react";
import TopBarSimple from "../../components/layout/TopBarSimple";
import GlassCard from "../../components/ui/GlassCard";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Field, { TextInput, Select } from "../../components/ui/Field";
import { useStockStore } from "../../store/stockStore";
import { useAuthStore } from "../../store/authStore";
import { TYPES_MOUVEMENT_ANIMAL, CAT_ANIMAUX } from "../../data/stockData";

const TYPES_ENTREE = Object.entries(TYPES_MOUVEMENT_ANIMAL).filter(([, t]) => t.signe > 0).map(([id]) => id);
const TYPES_SORTIE = Object.entries(TYPES_MOUVEMENT_ANIMAL).filter(([, t]) => t.signe < 0).map(([id]) => id);

// Saisie journalière du cheptel MAXI AGRO — porté depuis
// termitiere-platform/src/modules/agro/Saisie.jsx (EF Initial → Entrées →
// Sorties → EF Final, EF Initial reporté automatiquement du jour précédent).
//
// Simplifié par rapport à la version termitiere-platform, dont certains
// aspects ne trouvent pas d'équivalent direct dans le modèle de données de
// ce projet (journal de mouvements, pas de document « inventaire du jour »
// verrouillé) : pas de suivi des animaux malades, pas de mutation entre
// espèces, pas de circuit de réajustement d'audit par la direction, pas de
// brouillon auto-enregistré. Chaque ligne se sauvegarde immédiatement (comme
// le reste de ce projet), il n'y a donc pas non plus de bouton
// « Enregistrer » global à la fin de la journée.
export default function SaisieJournaliere() {
  const config = useOutletContext();
  const { user } = useAuthStore();
  const { referentielAnimaux, mouvementsAnimaux, addMouvementAnimal, supprimerMouvementAnimal, ajouterEspece } = useStockStore();

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [mvtModal, setMvtModal] = useState(null); // { espece, dir }
  const [openEspece, setOpenEspece] = useState(false);
  const [especeForm, setEspeceForm] = useState({ nom: "", cat: CAT_ANIMAUX[0] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // EF Initial du jour = effectif initial de l'espèce + tous les mouvements
  // AVANT cette date (report automatique — pas de saisie possible ici).
  const efInitial = (especeId) =>
    (referentielAnimaux.find((e) => e.id === especeId)?.initQuantite || 0) +
    mouvementsAnimaux.filter((m) => m.especeId === especeId && m.date < date).reduce((s, m) => s + m.quantite, 0);

  const mouvementsJour = (especeId) => mouvementsAnimaux.filter((m) => m.especeId === especeId && m.date === date);

  const lignes = useMemo(() => {
    return referentielAnimaux.map((e) => {
      const jour = mouvementsJour(e.id);
      const init = efInitial(e.id);
      const totEnt = jour.filter((m) => m.quantite > 0).reduce((s, m) => s + m.quantite, 0);
      const totSor = jour.filter((m) => m.quantite < 0).reduce((s, m) => s + Math.abs(m.quantite), 0);
      return { espece: e, init, totEnt, totSor, fin: Math.max(0, init + totEnt - totSor), jour };
    });
  }, [referentielAnimaux, mouvementsAnimaux, date]); // eslint-disable-line react-hooks/exhaustive-deps

  const cats = useMemo(
    () => [...new Set([...CAT_ANIMAUX, ...referentielAnimaux.map((e) => e.cat)])].filter((c) => referentielAnimaux.some((e) => e.cat === c)),
    [referentielAnimaux]
  );

  async function submitEspece(e) {
    e.preventDefault();
    if (!especeForm.nom.trim()) return;
    setSaving(true);
    setError("");
    const res = await ajouterEspece(especeForm);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    setOpenEspece(false);
    setEspeceForm({ nom: "", cat: CAT_ANIMAUX[0] });
  }

  return (
    <div>
      <TopBarSimple title="Saisie journalière" subtitle={`${config.nom} — EF Initial · Entrées · Sorties · EF Final`} accent={config.color} />

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label className="block text-[11.5px] font-semibold text-ink-soft mb-1.5 ml-1">Date</label>
          <TextInput type="date" className="w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <Button variant="ghost" icon={Plus} onClick={() => setOpenEspece(true)} className="ml-auto">Nouvelle espèce</Button>
      </div>

      <GlassCard className="p-2 overflow-hidden" hover={false}>
        <div className="max-h-[calc(100vh-320px)] overflow-auto">
          <table className="w-full min-w-[640px] border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="text-left text-[11.5px] font-bold text-ink-soft uppercase tracking-wide">
                <th className="px-4 py-3">Espèce</th>
                <th className="px-3 py-3 text-center" title="Reporté automatiquement du jour précédent">EF Initial <Lock size={10} className="inline" /></th>
                <th className="px-3 py-3 text-center">Entrées</th>
                <th className="px-3 py-3 text-center">Sorties</th>
                <th className="px-3 py-3 text-center" title="Calculé automatiquement">EF Final <Lock size={10} className="inline" /></th>
              </tr>
            </thead>
            <tbody>
              {cats.map((cat) => (
                <Fragment key={cat}>
                  <tr>
                    <td colSpan={5} className="px-4 py-1.5 text-[10.5px] font-bold uppercase tracking-wide text-white" style={{ background: config.color }}>{cat}</td>
                  </tr>
                  {lignes.filter((l) => l.espece.cat === cat).map((l) => (
                    <tr key={l.espece.id} className="text-[13.5px] hover:bg-white/50 transition-colors">
                      <td className="px-4 py-2.5 font-semibold text-ink">{l.espece.nom}</td>
                      <td className="px-3 py-2.5 text-center tabular text-ink-soft">{l.init}</td>
                      <td className="px-3 py-2.5 text-center">
                        <button onClick={() => setMvtModal({ espece: l.espece, dir: "entree" })} className="min-w-[3rem] rounded-lg border border-black/10 px-2 py-1 font-bold tabular text-[#1a7d34] hover:border-[#30D158]">+{l.totEnt}</button>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <button onClick={() => setMvtModal({ espece: l.espece, dir: "sortie" })} className="min-w-[3rem] rounded-lg border border-black/10 px-2 py-1 font-bold tabular text-[#b3241b] hover:border-[#FF453A]">-{l.totSor}</button>
                      </td>
                      <td className="px-3 py-2.5 text-center tabular font-extrabold text-ink">{l.fin}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
              {referentielAnimaux.length === 0 && (
                <tr><td colSpan={5} className="text-center py-10 text-[13px] text-ink-soft italic">Aucune espèce enregistrée.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Modal mouvements typés du jour, pour une espèce + un sens (entrée/sortie) */}
      <MouvementJourModal
        modal={mvtModal}
        onClose={() => setMvtModal(null)}
        date={date}
        user={user}
        addMouvementAnimal={addMouvementAnimal}
        supprimerMouvementAnimal={supprimerMouvementAnimal}
        lignes={mvtModal ? mouvementsJour(mvtModal.espece.id).filter((m) => (mvtModal.dir === "entree" ? m.quantite > 0 : m.quantite < 0)) : []}
      />

      <Modal
        open={openEspece}
        onClose={() => setOpenEspece(false)}
        title="Nouvelle espèce"
        footer={<><Button variant="ghost" onClick={() => setOpenEspece(false)}>Annuler</Button><Button onClick={submitEspece} disabled={saving}>{saving ? "Création…" : "Créer"}</Button></>}
      >
        <form onSubmit={submitEspece}>
          {error && <p className="text-[12.5px] text-[#b3241b] bg-[#FF453A]/10 rounded-xl px-3 py-2 mb-3">{error}</p>}
          <Field label="Nom de l'espèce">
            <TextInput value={especeForm.nom} onChange={(e) => setEspeceForm({ ...especeForm, nom: e.target.value })} placeholder="Ex : Lapins" />
          </Field>
          <Field label="Catégorie">
            <Select value={especeForm.cat} onChange={(e) => setEspeceForm({ ...especeForm, cat: e.target.value })}>
              {CAT_ANIMAUX.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
        </form>
      </Modal>
    </div>
  );
}

function MouvementJourModal({ modal, onClose, date, user, addMouvementAnimal, supprimerMouvementAnimal, lignes }) {
  const [type, setType] = useState("");
  const [quantite, setQuantite] = useState("");
  const [motif, setMotif] = useState("");
  const [saving, setSaving] = useState(false);

  if (!modal) return null;
  const { espece, dir } = modal;
  const types = dir === "entree" ? TYPES_ENTREE : TYPES_SORTIE;
  const typeActuel = type || types[0];

  async function ajouter() {
    if (!quantite || Number(quantite) <= 0) return;
    setSaving(true);
    await addMouvementAnimal({ especeId: espece.id, type: typeActuel, quantite, motif, date }, user);
    setSaving(false);
    setQuantite("");
    setMotif("");
  }

  return (
    <Modal open onClose={onClose} title={`${dir === "entree" ? "⬇️ Entrées" : "⬆️ Sorties"} — ${espece.nom} (${date})`} footer={<Button onClick={onClose}>Terminer</Button>}>
      <div className="space-y-2 mb-4">
        {lignes.length === 0 && <p className="text-[13px] text-ink-soft italic">Aucun mouvement saisi pour cette journée.</p>}
        {lignes.map((l) => (
          <div key={l.id} className="flex items-center gap-2 rounded-xl bg-black/[0.03] px-3 py-2 text-[13px]">
            <span className="font-semibold text-ink">{TYPES_MOUVEMENT_ANIMAL[l.type]?.label || l.type}</span>
            <span className="font-bold tabular">{Math.abs(l.quantite)}</span>
            {l.motif && <span className="text-ink-soft truncate">— {l.motif}</span>}
            <span className="ml-auto text-[11px] text-ink-soft/70">{l.agentNom}</span>
            <button onClick={() => supprimerMouvementAnimal(l.id)} className="text-[#FF453A] hover:opacity-70" title="Supprimer"><Trash2 size={14} /></button>
          </div>
        ))}
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="block text-[11px] font-semibold text-ink-soft mb-1">Type</label>
          <Select value={typeActuel} onChange={(e) => setType(e.target.value)}>
            {types.map((t) => <option key={t} value={t}>{TYPES_MOUVEMENT_ANIMAL[t].label}</option>)}
          </Select>
        </div>
        <div className="w-24">
          <label className="block text-[11px] font-semibold text-ink-soft mb-1">Qté</label>
          <TextInput type="number" min="0" value={quantite} onChange={(e) => setQuantite(e.target.value)} />
        </div>
        <Button onClick={ajouter} disabled={saving} icon={Plus}>Ajouter</Button>
      </div>
      <div className="mt-2">
        <TextInput value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Motif (optionnel)" />
      </div>
    </Modal>
  );
}
