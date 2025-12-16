export default async function handler(req, res) {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false });
    }
  
    try {
      const data = req.body;
  
      // пока просто логируем (видно в Vercel Logs)
      console.log("TRACK RESULT:", data);
  
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  }
  