export default async function handler(req, res) {
    // CORS (на всякий случай, Telegram иногда капризничает)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }
  
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }
  
    try {
      const body = req.body || {};
  
      // минимальная валидация
      if (!body.tg_user_id || !body.primary) {
        return res.status(400).json({ ok: false, error: "Missing tg_user_id or primary" });
      }
  
      console.log("TRACK_RESULT", {
        tg_user_id: body.tg_user_id,
        username: body.username || null,
        primary: body.primary,
        secondary: body.secondary || null,
        scores: body.scores || null,
        created_at: body.created_at || new Date().toISOString(),
        ua: req.headers["user-agent"] || null
      });
  
      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error("TRACK_ERROR", e);
      return res.status(500).json({ ok: false, error: "Server error" });
    }
  }
  