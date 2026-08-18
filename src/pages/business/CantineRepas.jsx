import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Utensils, Save, Smile, Meh, Frown } from "lucide-react";
import TopBarSimple from "../../components/layout/TopBarSimple";
import GlassCard from "../../components/ui/GlassCard";
import Button from "../../components/ui/Button";
import { TextInput } from "../../components/ui/Field";
import { useCantineStore } from "../../store/cantineStore";
import { useGarderieStore } from "../../store/garderieStore";

const APPETITS = [
  { id: "bien", label: "Bien mangé", icon: Smile, color: "#16a34a" },
  { id: "peu", label: "Peu mangé", icon: Meh, color: "#d97706" },
  { id: "refus", label: "Refus", icon: Frown, color: "#dc2626" },
];
const today = () => new Date().toISOString().slice(0, 10);

// Cantine & Repas E-GARDERIE — menu du jour + appétit par enfant,
// simplifié depuis termitiere-platform/src/modules/garderie/Cantine.jsx, à
// la demande explicite de l'utilisateur (2026-08-18).
export default function CantineRepas() {
  const config = useOutletContext();
  const { menus, repas, chargerCantine, enregistrerMenu, enregistrerAppetit } = useCantineStore();
  const { enfants, chargerGarderie } = useGarderieStore();

  useEffect(() => { chargerCantine(); chargerGarderie(); }, [chargerCantine, chargerGarderie]);

  const [date, setDate] = useState(today());
  const menuDuJour = menus.find((m) => m.date === date);

  const enfantsActifs = useMemo(() => enfants.filter((e) => e.statut === "actif").sort((a, b) => a.nom.localeCompare(b.nom)), [enfants]);
  const repasDuJour = useMemo(() => repas.filter((r) => r.date === date), [repas, date]);
  const repasParEnfant = (enfantId) => repasDuJour.find((r) => r.enfantId === enfantId);

  const bilan = { bien: repasDuJour.filter((r) => r.appetit === "bien").length, peu: repasDuJour.filter((r) => r.appetit === "peu").length, refus: repasDuJour.filter((r) => r.appetit === "refus").length };

  return (
    <div>
      <TopBarSimple title="Cantine & Repas" subtitle={`${config.nom} — menu du jour et appétit par enfant`} icon={Utensils} accent={config.color} />

      <div className="flex flex-wrap items-end gap-3 mb-5">
        <div>
          <label className="mb-1 block text-[11.5px] font-semibold text-ink-soft ml-1">Date</label>
          <TextInput type="date" className="w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="ml-auto flex gap-3 text-[12.5px] text-ink-soft">
          <span className="flex items-center gap-1"><Smile size={13} className="text-[#16a34a]" /> {bilan.bien}</span>
          <span className="flex items-center gap-1"><Meh size={13} className="text-[#d97706]" /> {bilan.peu}</span>
          <span className="flex items-center gap-1"><Frown size={13} className="text-[#dc2626]" /> {bilan.refus}</span>
        </div>
      </div>

      <MenuJourCard key={date} menuDuJour={menuDuJour} onSave={(payload) => enregistrerMenu(date, payload)} />

      <GlassCard className="p-2 overflow-hidden" hover={false}>
        <p className="font-bold tracking-tight text-ink px-3 pt-3 mb-2">Appétit par enfant</p>
        {enfantsActifs.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-ink-soft/60">Aucun enfant actif.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse">
              <thead>
                <tr className="text-left text-[11px] font-bold text-ink-soft/70 uppercase tracking-wide">
                  <th className="px-3 py-2">Enfant</th>
                  <th className="px-3 py-2">Appétit</th>
                  <th className="px-3 py-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {enfantsActifs.map((e) => {
                  const r = repasParEnfant(e.id);
                  return (
                    <tr key={e.id} className="text-[13px]">
                      <td className="px-3 py-2 font-semibold text-ink">{e.nom} {e.prenom}</td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1.5">
                          {APPETITS.map((a) => (
                            <button
                              key={a.id}
                              onClick={() => enregistrerAppetit(date, e.id, a.id, r?.notes || "")}
                              title={a.label}
                              className="flex h-7 w-7 items-center justify-center rounded-full transition-colors"
                              style={{ background: r?.appetit === a.id ? a.color : "rgba(0,0,0,0.04)", color: r?.appetit === a.id ? "#fff" : a.color }}
                            >
                              <a.icon size={14} />
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <TextInput
                          defaultValue={r?.notes || ""}
                          placeholder="Optionnel"
                          onBlur={(ev) => { if (ev.target.value !== (r?.notes || "")) enregistrerAppetit(date, e.id, r?.appetit || "bien", ev.target.value); }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

// Sous-composant clé sur `date` (dans le parent) — se remonte à chaque
// changement de jour, ce qui initialise proprement l'état local depuis
// `menuDuJour` sans passer par un effet de synchronisation.
function MenuJourCard({ menuDuJour, onSave }) {
  const [form, setForm] = useState({ petitDejeuner: menuDuJour?.petitDejeuner || "", dejeuner: menuDuJour?.dejeuner || "", gouter: menuDuJour?.gouter || "" });
  const [saving, setSaving] = useState(false);

  async function sauver() {
    setSaving(true);
    await onSave(form);
    setSaving(false);
  }

  return (
    <GlassCard hover={false} className="p-5 mb-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold tracking-tight text-ink">Menu du jour</h3>
        <Button size="sm" icon={Save} onClick={sauver} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="mb-1 block text-[11.5px] font-semibold text-ink-soft ml-1">Petit-déjeuner</label>
          <TextInput value={form.petitDejeuner} onChange={(e) => setForm((f) => ({ ...f, petitDejeuner: e.target.value }))} placeholder="ex : Bouillie de mil" />
        </div>
        <div>
          <label className="mb-1 block text-[11.5px] font-semibold text-ink-soft ml-1">Déjeuner</label>
          <TextInput value={form.dejeuner} onChange={(e) => setForm((f) => ({ ...f, dejeuner: e.target.value }))} placeholder="ex : Riz sauce arachide" />
        </div>
        <div>
          <label className="mb-1 block text-[11.5px] font-semibold text-ink-soft ml-1">Goûter</label>
          <TextInput value={form.gouter} onChange={(e) => setForm((f) => ({ ...f, gouter: e.target.value }))} placeholder="ex : Fruit" />
        </div>
      </div>
    </GlassCard>
  );
}
