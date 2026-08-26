export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Methode non autorisee" });
    return;
  }

  const authHeader = req.headers["authorization"];
  const userToken = authHeader?.replace("Bearer ", "");

  if (!userToken) {
    res.status(401).json({ error: "Non authentifie" });
    return;
  }

  const SUPABASE_URL = "https://uhyiwqsyyikwguvlfira.supabase.co";
  const anonKey = "sb_publishable_ggavuXHi0hGp1KSAS2edUw_jHIHY8Bf";
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!serviceKey) {
    res.status(500).json({ error: "Configuration serveur incomplete" });
    return;
  }

  try {
    // Etape 1 : verifier le token et recuperer l'identifiant reel de l'utilisateur
    const userRes = await fetch(SUPABASE_URL + "/auth/v1/user", {
      headers: { apikey: anonKey, Authorization: "Bearer " + userToken },
    });
    if (!userRes.ok) {
      res.status(401).json({ error: "Session invalide" });
      return;
    }
    const userData = await userRes.json();
    const userId = userData.id;

    // Etape 2 : supprimer le compte avec les droits admin (cote serveur uniquement)
    const deleteRes = await fetch(SUPABASE_URL + "/auth/v1/admin/users/" + userId, {
      method: "DELETE",
      headers: { apikey: serviceKey, Authorization: "Bearer " + serviceKey },
    });

    if (!deleteRes.ok) {
      const errData = await deleteRes.json().catch(() => ({}));
      throw new Error(errData.msg || "Echec de la suppression du compte");
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Erreur suppression compte:", err);
    res.status(500).json({ error: err.message || "Erreur serveur" });
  }
}
