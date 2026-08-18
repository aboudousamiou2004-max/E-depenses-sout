import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Plus, Package } from "lucide-react";
import TopBarSimple from "../../components/layout/TopBarSimple";
import GlassCard from "../../components/ui/GlassCard";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Field, { TextInput, Select } from "../../components/ui/Field";
import { useStockStore } from "../../store/stockStore";
import { useAuthStore } from "../../store/authStore";

const TYPE_LABEL = { arrivage: "Entrée", consommation: "Sortie" };

// Matériaux E-BRIQUETERIE — volet dédié (extrait de l'ancien Stock de
// briques), à la demande explicite de l'utilisateur (2026-08-18) : suivi des
// matières premières (ciment, sable, concassé…) — entrées (arrivage) et
// sorties (consommation en production).
export default function Materiaux() {
  const config = useOutletContext();
  const { user } = useAuthStore();
  const { referentielMatieres, mouvementsMatieres, stockMatiere, addMouvementMatiere, ajouterMatiere } = useStockStore();

  const [openMvt, setOpenMvt] = useState(false);
  const [matiereForm, setMatiereForm] = useState({ matiereId: referentielMatieres[0]?.id, type: "arrivage", quantite: "" });
  const [openMatiere, setOpenMatiere] = useState(false);
  const [nouvelleMatiere, setNouvelleMatiere] = useState({ nom: "", unite: "kg", initQuantite: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const derniersMouvements = mouvementsMatieres.slice(0, 10);

  async function submitMvt(e) {
    e.preventDefault();
    if (!matiereForm.quantite || !matiereForm.matiereId) return;
    setSaving(true);
    setError("");
    const res = await addMouvementMatiere(matiereForm, user);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    setOpenMvt(false);
    setMatiereForm((f) => ({ ...f, quantite: "" }));
  }

  async function submitMatiere(e) {
    e.preventDefault();
    if (!nouvelleMatiere.nom) return;
    setSaving(true);
    setError("");
    const res = await ajouterMatiere(nouvelleMatiere);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    setOpenMatiere(false);
    setNouvelleMatiere({ nom: "", unite: "kg", initQuantite: "" });
  }

  return (
    <div>
      <TopBarSimple title="Matériaux" subtitle={`${config.nom} — matières premières : entrées, sorties, stock`} icon={Package} accent={config.color} />

      <div className="flex flex-wrap justify-end gap-2.5 mb-4">
        <Button variant="ghost" icon={Plus} onClick={() => { setError(""); setOpenMatiere(true); }}>Nouvelle matière</Button>
        <Button icon={Plus} onClick={() => setOpenMvt(true)} style={{ background: config.color }} disabled={!referentielMatieres.length}>Nouveau mouvement</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <GlassCard className="p-5 lg:col-span-2" hover={false}>
          <h3 className="font-bold tracking-tight text-ink mb-3">Stock actuel</h3>
          {referentielMatieres.length === 0 ? (
            <p className="text-[13px] text-ink-soft italic">Aucune matière référencée — commencez par « Nouvelle matière ».</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {referentielMatieres.map((m) => (
                <div key={m.id} className="glass rounded-2xl p-4">
                  <p className="text-[12px] text-ink-soft font-semibold">{m.nom}</p>
                  <p className="text-[22px] font-bold tabular text-ink mt-1">{stockMatiere(m.id)} <span className="text-[12px] font-medium text-ink-soft">{m.unite}</span></p>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        <GlassCard className="p-5" hover={false}>
          <h3 className="font-bold tracking-tight text-ink mb-3">Derniers mouvements</h3>
          <div className="flex flex-col gap-2.5 max-h-[280px] overflow-y-auto">
            {derniersMouvements.length === 0 && <p className="text-[13px] text-ink-soft italic">Aucun mouvement.</p>}
            {derniersMouvements.map((m) => {
              const matiere = referentielMatieres.find((x) => x.id === m.matiereId);
              return (
                <div key={m.id} className="text-[12.5px] px-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-ink truncate">{matiere?.nom}</span>
                    <span className={`font-bold tabular ${m.type === "arrivage" ? "text-[#1a7d34]" : "text-[#b3241b]"}`}>
                      {m.type === "arrivage" ? "+" : "-"}{m.quantite}
                    </span>
                  </div>
                  <p className="text-ink-soft text-[11.5px]">{TYPE_LABEL[m.type]} · {new Date(m.date).toLocaleDateString("fr-FR")}</p>
                </div>
              );
            })}
          </div>
        </GlassCard>
      </div>

      <Modal open={openMvt} onClose={() => setOpenMvt(false)} title="Nouveau mouvement" icon={Package} accent={config.color} moduleLabel={config.nom} footer={<><Button variant="ghost" onClick={() => setOpenMvt(false)}>Annuler</Button><Button onClick={submitMvt} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button></>}>
        <form onSubmit={submitMvt}>
          {error && <p className="text-[12.5px] text-[#b3241b] bg-[#FF453A]/10 rounded-xl px-3 py-2 mb-3">{error}</p>}
          <Field label="Matière">
            <Select value={matiereForm.matiereId} onChange={(e) => setMatiereForm({ ...matiereForm, matiereId: e.target.value })}>
              {referentielMatieres.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
            </Select>
          </Field>
          <Field label="Type de mouvement">
            <Select value={matiereForm.type} onChange={(e) => setMatiereForm({ ...matiereForm, type: e.target.value })}>
              <option value="arrivage">Entrée</option>
              <option value="consommation">Sortie</option>
            </Select>
          </Field>
          <Field label="Quantité">
            <TextInput type="number" value={matiereForm.quantite} onChange={(e) => setMatiereForm({ ...matiereForm, quantite: e.target.value })} placeholder="10" />
          </Field>
        </form>
      </Modal>

      <Modal open={openMatiere} onClose={() => setOpenMatiere(false)} title="Nouvelle matière" icon={Package} accent={config.color} moduleLabel={config.nom} footer={<><Button variant="ghost" onClick={() => setOpenMatiere(false)}>Annuler</Button><Button onClick={submitMatiere} disabled={saving}>{saving ? "Création…" : "Créer"}</Button></>}>
        <form onSubmit={submitMatiere}>
          <Field label="Nom de la matière">
            <TextInput value={nouvelleMatiere.nom} onChange={(e) => setNouvelleMatiere({ ...nouvelleMatiere, nom: e.target.value })} placeholder="Ex : Gravier" autoFocus />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Unité">
              <TextInput value={nouvelleMatiere.unite} onChange={(e) => setNouvelleMatiere({ ...nouvelleMatiere, unite: e.target.value })} placeholder="kg, sacs, m³…" />
            </Field>
            <Field label="Stock initial" hint="0 si aucun stock actuel">
              <TextInput type="number" min="0" value={nouvelleMatiere.initQuantite} onChange={(e) => setNouvelleMatiere({ ...nouvelleMatiere, initQuantite: e.target.value })} placeholder="0" />
            </Field>
          </div>
        </form>
      </Modal>
    </div>
  );
}
