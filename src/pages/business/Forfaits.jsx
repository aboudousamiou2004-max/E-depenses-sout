import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Tag, Pencil, Check } from "lucide-react";
import TopBarSimple from "../../components/layout/TopBarSimple";
import GlassCard from "../../components/ui/GlassCard";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Field, { TextInput } from "../../components/ui/Field";
import { useGymStore, NIVEAUX_FORFAIT, niveauLabel } from "../../store/gymStore";
import { useAuthStore } from "../../store/authStore";
import { peutModifier } from "../../lib/modules";

const fmt = (n) => (n === null || n === undefined ? null : Math.round(Number(n) || 0).toLocaleString("fr-FR") + " FCFA");

// Nos forfaits — volet spécifique à MAXI GYM (voir PRESETS["maxi-gym"] dans
// lib/modules.js) : les 3 formules (Simple/Classique/VIP) qui servent de
// base de prix à la facturation des séances et abonnements. Éditable
// directement ici (crayon sur chaque carte) — sert aussi de source de vérité
// pour le sélecteur « Forfait » du formulaire de facturation.
export default function Forfaits() {
  const config = useOutletContext();
  const { forfaits, chargerForfaits, modifierForfait } = useGymStore();
  const { user } = useAuthStore();
  const modifierOk = peutModifier(user?.role);
  const [modal, setModal] = useState(null); // { id, data }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { chargerForfaits(config.secteurId); }, [config.secteurId]);

  function ouvrirEdition(f) {
    setModal({
      id: f.id,
      data: {
        description: f.description, prixSeance: f.prixSeance ?? "", prixAbonnement: f.prixAbonnement ?? "",
        dureeAbonnementTexte: f.dureeAbonnementTexte, seanceProposee: f.seanceProposee,
        featuresTexte: f.features.join("\n"),
      },
    });
    setError("");
  }

  async function enregistrer() {
    if (!modal.data.description.trim()) return setError("Description requise");
    setSaving(true);
    setError("");
    const res = await modifierForfait(modal.id, {
      ...modal.data, features: modal.data.featuresTexte.split("\n"),
    });
    setSaving(false);
    if (!res.ok) return setError(res.error);
    setModal(null);
  }

  const ordre = ["simple", "classique", "vip"];
  const tries = ordre.map((n) => forfaits.find((f) => f.niveau === n)).filter(Boolean);

  return (
    <div>
      <TopBarSimple title="Nos forfaits" subtitle={`${config.nom} : formules séances & abonnements`} icon={Tag} accent={config.color} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {tries.map((f) => (
          <GlassCard key={f.id} className="p-6 flex flex-col" hover={false}>
            <div className="flex items-start justify-between mb-1">
              <h3 className="font-bold tracking-tight text-ink text-[17px]">{niveauLabel(f.niveau)}</h3>
              <div className="flex items-center gap-1.5">
                <Badge tone="accent">{niveauLabel(f.niveau)}</Badge>
                {modifierOk && (
                  <button onClick={() => ouvrirEdition(f)} className="text-ink-soft hover:text-ink transition-colors">
                    <Pencil size={13} />
                  </button>
                )}
              </div>
            </div>
            <p className="text-[12.5px] text-ink-soft mb-4">{f.description}</p>

            <div className="flex items-center justify-between rounded-2xl bg-black/[0.03] px-3.5 py-2.5 mb-2.5">
              <span className="text-[12.5px] font-semibold text-ink-soft">Séance</span>
              <span className="font-bold text-ink text-[13.5px]">
                {f.seanceProposee ? fmt(f.prixSeance) : "Non proposée (abonnement uniquement)"}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-black/[0.03] px-3.5 py-2.5 mb-4">
              <span className="text-[12.5px] font-semibold text-ink-soft">Abonnement</span>
              <span className="font-bold text-ink text-[13.5px] text-right">
                {f.prixAbonnement !== null ? `${fmt(f.prixAbonnement)} ${f.dureeAbonnementTexte}` : f.dureeAbonnementTexte}
              </span>
            </div>

            <div className="flex flex-col gap-2 flex-1">
              {f.features.map((feat, i) => (
                <div key={i} className="flex items-start gap-2 text-[12.5px] text-ink-soft">
                  <Check size={14} className="text-[#30D158] mt-0.5 shrink-0" strokeWidth={2.6} />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        ))}
        {tries.length === 0 && (
          <p className="col-span-full text-center py-10 text-[13px] text-ink-soft italic">Chargement des forfaits…</p>
        )}
      </div>

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title="Modifier le forfait"
        icon={Tag}
        accent={config.color}
        moduleLabel={config.nom}
        footer={<><Button variant="ghost" onClick={() => setModal(null)}>Annuler</Button><Button onClick={enregistrer} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button></>}
      >
        {modal && (
          <form onSubmit={(e) => { e.preventDefault(); enregistrer(); }}>
            {error && <p className="text-[12.5px] text-[#b3241b] bg-[#FF453A]/10 rounded-xl px-3 py-2 mb-3">{error}</p>}
            <Field label="Description"><TextInput value={modal.data.description} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, description: e.target.value } }))} /></Field>
            <label className="flex items-center gap-2 mb-3.5 cursor-pointer">
              <input type="checkbox" checked={modal.data.seanceProposee} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, seanceProposee: e.target.checked } }))} className="w-4 h-4 rounded accent-[#0A84FF]" />
              <span className="text-[13px] font-semibold text-ink">Séance à l'unité proposée pour ce forfait</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {modal.data.seanceProposee && (
                <Field label="Prix séance (FCFA)"><TextInput type="number" min="0" value={modal.data.prixSeance} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, prixSeance: e.target.value } }))} /></Field>
              )}
              <Field label="Prix abonnement (FCFA)" hint="Laisser vide si tarif négocié à la souscription">
                <TextInput type="number" min="0" value={modal.data.prixAbonnement} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, prixAbonnement: e.target.value } }))} />
              </Field>
            </div>
            <Field label="Durée / mention affichée à côté du prix abonnement" hint="ex : « / mois » ou « Tarif et durée libres (min. 7 jours) »">
              <TextInput value={modal.data.dureeAbonnementTexte} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, dureeAbonnementTexte: e.target.value } }))} />
            </Field>
            <Field label="Avantages (un par ligne)">
              <textarea
                value={modal.data.featuresTexte}
                onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, featuresTexte: e.target.value } }))}
                rows={4}
                className="glass w-full rounded-2xl px-3.5 py-2.5 text-[13px] text-ink outline-none resize-none"
              />
            </Field>
          </form>
        )}
      </Modal>
    </div>
  );
}
