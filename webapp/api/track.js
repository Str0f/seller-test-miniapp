import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false });

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const b = req.body || {};
    if (!b.tg_user_id || !b.event) {
      return res.status(400).json({ ok: false, error: "missing tg_user_id/event" });
    }

    const { error } = await supabase.from("tg_events").insert({
      tg_user_id: b.tg_user_id,
      username: b.username || null,
      event: b.event,
      primary_type: b.primary_type || null,
      secondary_type: b.secondary_type || null,
      scores: b.scores || null
    });

    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || "server error" });
  }
}
