export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Methode non autorisee" });
  }

  const { email, organizationId } = req.body || {};
  if (!email || !organizationId) {
    return res.status(400).json({ error: "Parametres manquants" });
  }

  const SUPABASE_URL = "https://uhyiwqsyyikwguvlfira.supabase.co";
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  const adminHeaders = {
    apikey: SERVICE_KEY,
    Authorization: "Bearer " + SERVICE_KEY,
    "Content-Type": "application/json",
  };

  try {
    // 1. Cherche si un compte existe deja avec cet email, tous comptes confondus
    const listRes = await fetch(
      SUPABASE_URL + "/auth/v1/admin/users?page=1&per_page=1000",
      { headers: adminHeaders }
    );
    if (!listRes.ok) {
      const body = await listRes.text().catch(() => "");
      throw new Error(
        "Erreur de verification du compte : " + listRes.status + " - " + body.slice(0, 200)
      );
    }
    const listData = await listRes.json();
    const existingUser = (listData.users || []).find(
      (u) => (u.email || "").toLowerCase() === email.trim().toLowerCase()
    );

    if (!existingUser) {
      // Aucun compte existant : le front-end va creer une invitation classique
      return res.status(200).json({ status: "no_existing_account" });
    }

    // 2. Le compte existe : verifie s'il est deja membre de cette organisation
    const memberCheckRes = await fetch(
      SUPABASE_URL +
        "/rest/v1/organization_members?user_id=eq." +
        existingUser.id +
        "&organization_id=eq." +
        organizationId +
        "&select=user_id",
      { headers: adminHeaders }
    );
    const memberCheckData = await memberCheckRes.json();

    if (memberCheckData.length > 0) {
      return res.status(200).json({
        status: "already_member",
        message: "Cette personne fait deja partie de votre organisation.",
      });
    }

    // 3. Ajoute directement ce compte existant a l'organisation
    const insertRes = await fetch(SUPABASE_URL + "/rest/v1/organization_members", {
      method: "POST",
      headers: { ...adminHeaders, Prefer: "return=representation" },
      body: JSON.stringify({
        user_id: existingUser.id,
        organization_id: organizationId,
        role: "member",
        email: email.trim(),
      }),
    });
    if (!insertRes.ok) {
      const body = await insertRes.text().catch(() => "");
      throw new Error(
        "Erreur d'ajout du membre : " + insertRes.status + " - " + body.slice(0, 200)
      );
    }

    // 4. Nettoie d'eventuelles invitations fantomes restees en attente pour cet email
    await fetch(
      SUPABASE_URL +
        "/rest/v1/invitations?email=eq." +
        encodeURIComponent(email.trim()) +
        "&accepted=eq.false",
      {
        method: "PATCH",
        headers: adminHeaders,
        body: JSON.stringify({ accepted: true }),
      }
    ).catch(() => {});

    return res.status(200).json({
      status: "added_existing",
      message:
        "Cette personne avait deja un compte Confia et a ete ajoutee directement a votre organisation.",
    });
  } catch (err) {
    console.error("Erreur check-and-invite:", err);
    return res.status(500).json({ error: err.message || "Erreur serveur" });
  }
}
