import { useState } from "react";
import { Baby, UserPlus } from "lucide-react";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import Field, { TextInput, Select } from "./ui/Field";
import { useGarderieStore } from "../store/garderieStore";
import { useAuthStore } from "../store/authStore";
import { GROUPES_AGE, PROGRAMMES_ENFANT, GROUPES_PAR_PROGRAMME, programmeDuGroupe, groupeRecommande } from "../data/garderieData";
import { tarifSuggere } from "../lib/garderieLogic";

const TYPES_ABONNEMENT = [
  { id: "mensuel", label: "Mensuel" },
  { id: "annuel", label: "Annuel" },
  { id: "court_sejour", label: "Court séjour" },
];
const STATUTS_ENFANT = { actif: "Actif", suspendu: "Suspendu", sorti: "Sorti" };

function empty() {
  return {
    nom: "", prenom: "", dateNaissance: "", ageSaisi: "", sexe: "F",
    programme: "", groupe: "", statut: "actif",
    typeAbonnement: "mensuel", dureeSemaines: "2", tarif: "",
    dateInscription: new Date().toISOString().slice(0, 10), fraisCantine: "",
    allergies: "", infoMedicale: "",
    parentNom: "", parentContact: "", parentContact2: "", parentProfession: "", adresse: "",
    notes: "", fraisInscription: "",
  };
}

// Fiche d'inscription complète E-GARDERIE — reprise (simplifiée, sans
// photo) de termitiere-platform/src/modules/garderie/Enfants.jsx, à la
// demande explicite de l'utilisateur (2026-08-18) : identité, groupe
// d'âge/programme, parent/tuteur, santé/allergies. Utilisée à la fois
// depuis Enfants & Paiements (gestion de fiche) et depuis Prestations
// (bouton « Inscrire un enfant », avec le frais d'inscription en plus —
// voir `montrerFraisInscription`).
export default function InscriptionEnfantModal({ open, onClose, enfant, accent, moduleLabel, onSaved, montrerFraisInscription }) {
  const { ajouterEnfant, modifierEnfant } = useGarderieStore();
  const { user } = useAuthStore();
  const isNew = !enfant;
  const [data, setData] = useState(() => (enfant ? { ...empty(), ...enfant, tarif: enfant.tarif || "", dureeSemaines: enfant.dureeSemaines || "2", fraisCantine: enfant.fraisCantine || "" } : empty()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k, v) => setData((d) => ({ ...d, [k]: v }));

  function choisirDateNaissance(v) {
    const g = groupeRecommande(v);
    setData((d) => ({ ...d, dateNaissance: v, ageSaisi: "", groupe: g, programme: g ? programmeDuGroupe(g) : d.programme }));
  }
  function choisirGroupe(g) {
    setData((d) => ({ ...d, groupe: g, programme: g ? programmeDuGroupe(g) : d.programme }));
  }
  function appliquerTarifSuggere() {
    const t = tarifSuggere(data.dateNaissance);
    if (t != null) set("tarif", t);
  }

  async function submit(e) {
    e.preventDefault();
    if (!data.nom.trim() || !data.prenom.trim()) return setError("Nom et prénom requis");
    if (!data.dateNaissance && !data.ageSaisi.trim()) return setError("Date de naissance ou âge requis");
    if (!data.groupe) return setError("Groupe d'âge requis");
    if (!data.parentNom.trim()) return setError("Nom du parent / tuteur requis");
    if (!data.parentContact.trim()) return setError("Contact principal du parent requis");
    if (data.typeAbonnement === "court_sejour" && (!data.dureeSemaines || Number(data.dureeSemaines) < 2)) {
      return setError("Durée du court séjour requise (2 semaines minimum)");
    }
    setSaving(true);
    setError("");
    const res = isNew ? await ajouterEnfant(data, user) : await modifierEnfant(enfant.id, data);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    onSaved?.({ isNew, enfant: res.enfant, fraisInscription: Number(data.fraisInscription) || 0 });
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isNew ? "Inscrire un enfant" : "Modifier la fiche"}
      icon={isNew ? UserPlus : Baby}
      accent={accent}
      moduleLabel={moduleLabel}
      footer={<><Button variant="ghost" onClick={onClose}>Annuler</Button><Button onClick={submit} disabled={saving}>{saving ? "Enregistrement…" : isNew ? "Inscrire" : "Mettre à jour"}</Button></>}
    >
      <form onSubmit={submit} className="space-y-4">
        {error && <p className="text-[12.5px] text-[#b3241b] bg-[#FF453A]/10 rounded-xl px-3 py-2">{error}</p>}

        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-soft/70">Identité</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prénom"><TextInput value={data.prenom} onChange={(e) => set("prenom", e.target.value)} autoFocus /></Field>
            <Field label="Nom"><TextInput value={data.nom} onChange={(e) => set("nom", e.target.value)} /></Field>
            <Field label="Date de naissance" hint="Suggère groupe et tarif">
              <TextInput type="date" value={data.dateNaissance} onChange={(e) => choisirDateNaissance(e.target.value)} />
            </Field>
            <Field label="Âge (si date inconnue)">
              <TextInput value={data.ageSaisi} onChange={(e) => set("ageSaisi", e.target.value)} placeholder="ex : 2 ans" disabled={!!data.dateNaissance} />
            </Field>
            <Field label="Sexe">
              <Select value={data.sexe} onChange={(e) => set("sexe", e.target.value)}>
                <option value="F">Fille</option>
                <option value="M">Garçon</option>
              </Select>
            </Field>
          </div>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-soft/70">Scolarité & abonnement</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Groupe d'âge" hint="Le programme en découle">
              <Select value={data.groupe} onChange={(e) => choisirGroupe(e.target.value)}>
                <option value="">— Choisir —</option>
                {GROUPES_AGE.filter((g) => !data.programme || GROUPES_PAR_PROGRAMME[data.programme].includes(g.id)).map((g) => (
                  <option key={g.id} value={g.id}>{g.label} ({g.desc})</option>
                ))}
              </Select>
            </Field>
            <Field label="Programme">
              <Select value={data.programme} onChange={(e) => set("programme", e.target.value)}>
                <option value="">—</option>
                {PROGRAMMES_ENFANT.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </Select>
            </Field>
            <Field label="Type d'abonnement">
              <Select value={data.typeAbonnement} onChange={(e) => set("typeAbonnement", e.target.value)}>
                {TYPES_ABONNEMENT.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </Select>
            </Field>
            {data.typeAbonnement === "court_sejour" ? (
              <Field label="Durée (semaines)" hint="Minimum 2"><TextInput type="number" min="2" value={data.dureeSemaines} onChange={(e) => set("dureeSemaines", e.target.value)} /></Field>
            ) : (
              <Field label="Date d'inscription"><TextInput type="date" value={data.dateInscription} onChange={(e) => set("dateInscription", e.target.value)} /></Field>
            )}
            <Field label="Tarif (FCFA/mois)">
              <div className="flex gap-1.5">
                <TextInput type="number" min="0" value={data.tarif} onChange={(e) => set("tarif", e.target.value)} />
                {data.dateNaissance && <Button type="button" variant="ghost" onClick={appliquerTarifSuggere}>Suggérer</Button>}
              </div>
            </Field>
            <Field label="Frais de cantine (FCFA/mois)" hint="0 si pas de cantine">
              <TextInput type="number" min="0" value={data.fraisCantine} onChange={(e) => set("fraisCantine", e.target.value)} placeholder="0" />
            </Field>
            {data.typeAbonnement === "court_sejour" && (
              <Field label="Date d'inscription"><TextInput type="date" value={data.dateInscription} onChange={(e) => set("dateInscription", e.target.value)} /></Field>
            )}
            {!isNew && (
              <Field label="Statut">
                <Select value={data.statut} onChange={(e) => set("statut", e.target.value)}>
                  {Object.entries(STATUTS_ENFANT).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </Select>
              </Field>
            )}
            {montrerFraisInscription && isNew && (
              <Field label="Frais d'inscription (FCFA)" hint="Enregistré comme recette du secteur">
                <TextInput type="number" min="0" value={data.fraisInscription} onChange={(e) => set("fraisInscription", e.target.value)} placeholder="0" />
              </Field>
            )}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-soft/70">Parent / tuteur</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nom du parent / tuteur"><TextInput value={data.parentNom} onChange={(e) => set("parentNom", e.target.value)} placeholder="Nom complet" /></Field>
            <Field label="Contact principal"><TextInput value={data.parentContact} onChange={(e) => set("parentContact", e.target.value)} placeholder="ex : +226 70 00 00 00" /></Field>
            <Field label="Contact secondaire"><TextInput value={data.parentContact2} onChange={(e) => set("parentContact2", e.target.value)} /></Field>
            <Field label="Profession"><TextInput value={data.parentProfession} onChange={(e) => set("parentProfession", e.target.value)} placeholder="ex : Commerçant" /></Field>
            <Field label="Adresse"><TextInput value={data.adresse} onChange={(e) => set("adresse", e.target.value)} placeholder="Quartier, ville…" /></Field>
          </div>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-soft/70">Santé</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Allergies connues"><TextInput value={data.allergies} onChange={(e) => set("allergies", e.target.value)} placeholder="ex : arachides, lait…" /></Field>
            <Field label="Info médicale importante"><TextInput value={data.infoMedicale} onChange={(e) => set("infoMedicale", e.target.value)} placeholder="ex : asthme…" /></Field>
          </div>
        </div>

        <Field label="Notes">
          <textarea className="glass w-full rounded-2xl px-3.5 py-2.5 text-[14px] text-ink outline-none" rows={2} value={data.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}
