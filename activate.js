const { activate, checkQuota } = require("../lib/db");

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-password");
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return json(res, 200, { ok: true });
  }

  try {
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const { code, deviceId } = body;
      if (!code) {
        return json(res, 400, { ok: false, error: "code wajib" });
      }
      // deviceId opsional (model password — tidak mengikat device)
      const result = await activate(code, deviceId || "");
      return json(res, result.ok ? 200 : 403, result);
    }

    if (req.method === "GET") {
      const code = req.query?.code || "";
      const deviceId = req.query?.deviceId || "";
      const result = await checkQuota(code, deviceId);
      return json(res, result.ok ? 200 : 403, result);
    }

    return json(res, 405, { ok: false, error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    return json(res, 500, {
      ok: false,
      error: err.message || "Server error",
      hint: "Pastikan Vercel KV (KV_REST_API_URL & KV_REST_API_TOKEN) sudah di-set"
    });
  }
};
