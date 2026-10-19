const {
  checkAdmin,
  listCodes,
  createCode,
  setActive,
  adminResetDevice
} = require("../lib/db");

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-password");
  res.end(JSON.stringify(body));
}

function getPassword(req, body) {
  return (
    req.headers["x-admin-password"] ||
    body?.password ||
    req.query?.password ||
    ""
  );
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return json(res, 200, { ok: true });
  }

  try {
    const body = req.method === "POST"
      ? (typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {})
      : {};
    const password = getPassword(req, body);

    if (!checkAdmin(password)) {
      return json(res, 401, {
        ok: false,
        error: "Password admin salah atau ADMIN_PASSWORD belum di-set di Vercel"
      });
    }

    const action = body.action || req.query?.action || "list";

    if (req.method === "GET" || action === "list") {
      const codes = await listCodes();
      return json(res, 200, { ok: true, codes });
    }

    if (req.method === "POST") {
      if (action === "create") {
        const { code, tier } = body;
        const created = await createCode(code, tier);
        return json(res, 200, { ok: true, license: created });
      }
      if (action === "setActive") {
        const lic = await setActive(body.code, body.active);
        return json(res, 200, { ok: true, license: lic });
      }
      if (action === "resetDevice") {
        const lic = await adminResetDevice(body.code);
        return json(res, 200, { ok: true, license: lic });
      }
      return json(res, 400, { ok: false, error: "action tidak dikenal" });
    }

    return json(res, 405, { ok: false, error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    return json(res, 500, { ok: false, error: err.message || "Server error" });
  }
};
