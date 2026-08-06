import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, PawPrint, Skull, Baby, ShoppingCart } from "lucide-react";
import TopBarSimple from "../../components/layout/TopBarSimple";
import GlassCard from "../../components/ui/GlassCard";
import StatTile from "../../components/ui/StatTile";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Field, { TextInput, Select } from "../../components/ui/Field";
import Badge from "../../components/ui/Badge";
import { useStockStore } from "../../store/stockStore";
import { useAuthStore } from "../../store/authStore";
import { TYPES_MOUVEMENT_ANIMAL, CAT_ANIMAUX } from "../../data/stockData";

// Cheptel de MAXI AGRO — même principe que le vrai module (src/modules/agro) :
// effectif par espèce = report du solde précédent + entrées (achat/naissance)
// - sorties (vente/décès/perte), ici en cumul de mouvements plutôt qu'en
// inventaires journaliers verrouillés.
export default function StockAnimaux() {
  const config = useOutletContext();
  const { user } = useAuthStore();
  const { referentielAnimaux, mouvementsAnimaux, effectifEspece, addMouvementAnimal, ajouterEspece } = useStockStore();

  const [open, setOpen] = useState(false);
  const [openEspece, setOpenEspece] = useState(false);
  const [form, setForm] = useState({ especeId: referentielAnimaux[0]?.id, type: "naissance", quantite: "", motif: "", date: "2026-07-27" });
  const [especeForm, setEspeceForm] = useState({ nom: "", cat: CAT_ANIMAUX[0] });

  const lignes = useMemo(
    () => referentielAnimaux.map((e) => ({ ...e, effectif: effectifEspece(e.id) })),
    [referentielAnimaux, mouvementsAnimaux, effectifEspece]
  );
  const effectifTotal = lignes.reduce((acc, l) => acc + l.effectif, 0);
  const naissances30j = mouvementsAnimaux.filter((m) => m.type === "naissance").reduce((acc, m) => acc + m.quantite, 0);
  const deces30j = mouvementsAnimaux.filter((m) => m.type === "deces").reduce((acc, m) => acc - m.quantite, 0);
  const tauxMortalite = effectifTotal + deces30j > 0 ? Math.round((deces30j / (effectifTotal + deces30j)) * 1000) / 10 : 0;
  const derniersMouvements = mouvementsAnimaux.slice(0, 8);

  function submit(e) {
    e.preventDefault();
    if (!form.quantite || !form.especeId) return;
    addMouvementAnimal(form, user);
    setOpen(false);
    setForm((f) => ({ ...f, quantite: "", motif: "" }));
  }

  function submitEspece(e) {
    e.preventDefault();
    if (!especeForm.nom) return;
    ajouterEspece(especeForm);
    setOpenEspece(false);
    setEspeceForm({ nom: "", cat: CAT_ANIMAUX[0] });
  }

  return (
    <div>
      <TopBarSimple title="Cheptel" subtitle={`${config.nom} — effectif des animaux et mouvements`} accent={config.color} />

      <div className="grid grid-cols-4 gap-5 mb-5">
        <StatTile icon={PawPrint} label="Effectif total" value={String(effectifTotal)} tone={config.color} />
        <StatTile icon={Baby} label="Naissances enregistrées" value={String(naissances30j)} tone="#30D158" />
        <StatTile icon={Skull} label="Décès enregistrés" value={String(deces30j)} tone="#FF453A" />
        <StatTile icon={ShoppingCart} label="Taux de mortalité" value={tauxMortalite + " %"} tone={tauxMortalite > 5 ? "#FF453A" : "#8E8E93"} />
      </div>

      <div className="flex justify-end gap-2.5 mb-4">
        <Button variant="ghost" icon={Plus} onClick={() => setOpenEspece(true)}>Nouvelle espèce</Button>
        <Button icon={Plus} onClick={() => setOpen(true)} style={{ background: config.color }}>Nouveau mouvement</Button>
      </div>

      <div className="grid grid-cols-3 gap-5">
        <GlassCard className="p-2 overflow-hidden col-span-2" hover={false}>
          <div className="max-h-[calc(100vh-380px)] overflow-y-auto">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="text-left text-[11.5px] font-bold text-ink-soft uppercase tracking-wide">
                  <th className="px-4 py-3">Espèce</th>
                  <th className="px-4 py-3">Catégorie</th>
                  <th className="px-4 py-3 text-right">Effectif actuel</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((l, i) => (
                  <motion.tr key={l.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i, 8) * 0.02 }} className="text-[13.5px] hover:bg-white/50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-ink">{l.nom}</td>
                    <td className="px-4 py-3 text-ink-soft">{l.cat}</td>
                    <td className="px-4 py-3 text-right">
                      <Badge tone={l.effectif === 0 ? "coral" : "mint"}>{l.effectif} têtes</Badge>
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
              const espece = referentielAnimaux.find((e) => e.id === m.especeId);
              const info = TYPES_MOUVEMENT_ANIMAL[m.type];
              return (
                <div key={m.id} className="text-[12.5px] px-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-ink truncate">{espece?.nom}</span>
                    <span className={`font-bold tabular ${info.signe > 0 ? "text-[#1a7d34]" : "text-[#b3241b]"}`}>
                      {info.signe > 0 ? "+" : "-"}{Math.abs(m.quantite)}
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
        title="Nouveau mouvement — cheptel"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button><Button onClick={submit}>Enregistrer</Button></>}
      >
        <form onSubmit={submit}>
          <Field label="Espèce">
            <Select value={form.especeId} onChange={(e) => setForm({ ...form, especeId: e.target.value })}>
              {referentielAnimaux.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
            </Select>
          </Field>
          <Field label="Type de mouvement">
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {Object.entries(TYPES_MOUVEMENT_ANIMAL).map(([id, t]) => <option key={id} value={id}>{t.label}</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantité (têtes)">
              <TextInput type="number" value={form.quantite} onChange={(e) => setForm({ ...form, quantite: e.target.value })} placeholder="10" />
            </Field>
            <Field label="Date">
              <TextInput type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
          </div>
          <Field label="Motif (optionnel)">
            <TextInput value={form.motif} onChange={(e) => setForm({ ...form, motif: e.target.value })} placeholder="Ex : lot du 27/07" />
          </Field>
        </form>
      </Modal>

      <Modal
        open={openEspece}
        onClose={() => setOpenEspece(false)}
        title="Nouvelle espèce"
        footer={<><Button variant="ghost" onClick={() => setOpenEspece(false)}>Annuler</Button><Button onClick={submitEspece}>Créer</Button></>}
      >
        <form onSubmit={submitEspece}>
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
