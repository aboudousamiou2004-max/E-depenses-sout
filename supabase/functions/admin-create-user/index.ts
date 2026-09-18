// Edge Function "admin-create-user" — remplace l'ancien circuit
// signUp() + reconnexion manuelle dans addUser() (src/store/dataStore.js).
//
// Problème corrigé (2026-09-18) : côté navigateur, `supabase.auth.signUp()`
// bascule TOUJOURS la session active vers le compte qui vient d'être créé —
// c'est un comportement du SDK, pas un bug applicatif. Le circuit précédent
// contournait ça en reconnectant l'admin juste après avec son mot de passe
// retapé dans un champ dédié — fragile (silencieux si mal tapé) et gênant
// (bascule visible, même temporaire). À la demande explicite de
// l'utilisateur : "le navigateur ne doit pas basculer quand j'ajoute un
// utilisateur".
//
// Cette fonction s'exécute côté serveur, avec la clé service_role (jamais
// exposée au navigateur) : elle crée le compte via l'API Admin de Supabase
// Auth, qui ne touche à AUCUNE session — ni celle de l'admin appelant, ni
// aucune autre. Le navigateur de l'admin ne bascule donc plus jamais.
//
// Sécurité : le SDK client (`supabase.functions.invoke`) joint automatiquement
// le token JWT de l'appelant dans l'en-tête Authorization. On vérifie ce
// token puis le rôle du profil correspondant AVANT de faire quoi que ce soit
// de privilégié — un appel sans être admin (ou sans être connecté) est
// refusé. C'est le même principe que la policy RLS "profils modifiables par
// les rôles à accès total", appliqué ici manuellement puisqu'on utilise
// service_role (qui contourne RLS par nature).
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const ROLES_ACCES_TOTAL = ["super_admin", "pau", "ge", "directeur"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Authentification requise." }, 401);

  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: authData, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !authData?.user) return json({ error: "Session invalide." }, 401);
  const callerId = authData.user.id;

  const { data: callerProfil, error: profilErr } = await supabaseAdmin
    .from("profiles")
    .select("role, actif")
    .eq("id", callerId)
    .single();
  if (profilErr || !callerProfil || !callerProfil.actif || !ROLES_ACCES_TOTAL.includes(callerProfil.role)) {
    return json({ error: "Réservé aux rôles à accès total." }, 403);
  }

  let payload: {
    login?: string; pass?: string; nom?: string; role?: string; secteur?: string | null;
    poste?: string; telephone?: string; actif?: boolean; modules?: string[]; emailDomain?: string;
  };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Corps de requête invalide." }, 400);
  }

  const login = payload.login?.trim();
  const pass = payload.pass?.trim();
  const nom = payload.nom?.trim();
  if (!login || !pass || !nom) return json({ error: "Nom, identifiant et mot de passe sont obligatoires." }, 400);

  const email = `${login.toLowerCase()}@${payload.emailDomain || "e-depenses.app"}`;

  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: pass,
    email_confirm: true,
    user_metadata: { login, nom },
  });
  if (createErr || !created?.user) {
    return json({ error: createErr?.message || "Échec de la création du compte." }, 400);
  }
  const nouveauUid = created.user.id;

  // handle_new_user() (trigger) vient d'insérer un profil par défaut, inerte
  // (rôle agent, désactivé, sans module) — on applique maintenant les
  // valeurs réelles demandées, en tant que service_role (déjà vérifié admin
  // ci-dessus, donc légitime de contourner RLS ici).
  const secteur = payload.secteur || null;
  const modulesFinal = secteur && !(payload.modules || []).includes(secteur)
    ? [...(payload.modules || []), secteur]
    : payload.modules || [];
  const { error: updateErr } = await supabaseAdmin.from("profiles").update({
    role: payload.role || "agent",
    secteur,
    poste: payload.poste?.trim() || "",
    telephone: payload.telephone?.trim() || "",
    actif: payload.actif !== false,
    modules: modulesFinal,
  }).eq("id", nouveauUid);

  if (updateErr) {
    return json({ error: `Compte créé mais non configuré (${updateErr.message}) — modifiez ses accès depuis la liste des utilisateurs.`, uid: nouveauUid }, 200);
  }

  return json({ ok: true, uid: nouveauUid });
});
