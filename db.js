/**
 * Database kode GEMA via Vercel KV (Upstash Redis).
 * Env yang dibutuhkan di Vercel:
 *   KV_REST_API_URL
 *   KV_REST_API_TOKEN
 *   ADMIN_PASSWORD
 */
const { kv } = require("@vercel/kv");
const { TIER_LIMITS, wibDateStr, normalizeCode } = require("./tiers");

function licenseKey(code) {
  return "license:" + normalizeCode(code);
}
function usageKey(code, dateStr) {
  return "usage:" + normalizeCode(code) + ":" + dateStr;
}
function indexKey() {
  return "license:index";
}

async function getLicense(code) {
  const c = normalizeCode(code);
  if (!c) return null;
  const data = await kv.get(licenseKey(c));
  return data || null;
}

async function saveLicense(code, data) {
  const c = normalizeCode(code);
  await kv.set(licenseKey(c), data);
  // jaga index daftar kode
  try {
    await kv.sadd(indexKey(), c);
  } catch (e) {
    /* optional */
  }
}

async function listCodes() {
  let codes = [];
  try {
    codes = (await kv.smembers(indexKey())) || [];
  } catch (e) {
    codes = [];
  }
  const out = [];
  for (const c of codes) {
    const lic = await getLicense(c);
    if (lic) out.push({ code: c, ...lic });
  }
  // urut terbaru
  out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return out;
}

async function createCode(code, tier) {
  const c = normalizeCode(code);
  const t = String(tier || "").toLowerCase();
  if (!c) throw new Error("Kode kosong");
  if (!TIER_LIMITS[t]) throw new Error("Tier tidak valid (lite/sultan/raja)");
  const existing = await getLicense(c);
  if (existing) throw new Error("Kode sudah ada");
  const data = {
    tier: t,
    active: true,
    deviceId: null,
    deviceChanges: 0,
    createdAt: Date.now(),
    note: ""
  };
  await saveLicense(c, data);
  return { code: c, ...data };
}

async function setActive(code, active) {
  const lic = await getLicense(code);
  if (!lic) throw new Error("Kode tidak ditemukan");
  lic.active = !!active;
  await saveLicense(code, lic);
  return lic;
}

/** Ganti device Raja Pro (max 1x) — hanya dipanggil admin */
async function adminResetDevice(code) {
  const lic = await getLicense(code);
  if (!lic) throw new Error("Kode tidak ditemukan");
  if (lic.tier !== "raja") throw new Error("Ganti device hanya untuk Raja Pro");
  const max = (TIER_LIMITS.raja.maxDeviceChanges || 1);
  if ((lic.deviceChanges || 0) >= max) {
    throw new Error("Jatah ganti device sudah habis (" + max + "x)");
  }
  lic.deviceId = null;
  lic.deviceChanges = (lic.deviceChanges || 0) + 1;
  await saveLicense(code, lic);
  return lic;
}

async function getUsage(code, dateStr) {
  const date = dateStr || wibDateStr();
  const u = await kv.get(usageKey(code, date));
  return u || { date, soal: 0, chatSec: 0 };
}

async function saveUsage(code, usage) {
  const date = usage.date || wibDateStr();
  await kv.set(usageKey(code, date), {
    date,
    soal: usage.soal || 0,
    chatSec: usage.chatSec || 0
  });
}

function quotaSnapshot(lic, usage) {
  const lim = TIER_LIMITS[lic.tier] || TIER_LIMITS.lite;
  const soalUsed = usage.soal || 0;
  const chatSec = usage.chatSec || 0;
  const chatUsedMin = Math.floor(chatSec / 60);
  return {
    tier: lic.tier,
    label: lim.label,
    soalUsed,
    soalMax: lim.dailySoal,
    soalLeft: Math.max(0, lim.dailySoal - soalUsed),
    chatUsedMin,
    chatMaxMin: lim.dailyChatMin,
    chatLeftSec: Math.max(0, lim.dailyChatMin * 60 - chatSec),
    soalExhausted: soalUsed >= lim.dailySoal,
    chatExhausted: chatSec >= lim.dailyChatMin * 60,
    maxSoalPerGen: lim.maxSoalPerGen,
    watermark: lim.watermark
  };
}

/**
 * Aktivasi model PASSWORD (bukan voucher).
 * Kode berlaku SELAMANYA, bisa login berkali-kali di HP manapun.
 * Tidak menandai "terpakai", tidak mengikat device.
 */
async function activate(code, deviceId) {
  const c = normalizeCode(code);
  const lic = await getLicense(c);
  if (!lic) return { ok: false, error: "Kode tidak valid" };
  if (!lic.active) return { ok: false, error: "Kode dinonaktifkan" };

  // Catat last login opsional (bukan pengunci)
  lic.lastLoginAt = Date.now();
  if (!lic.activatedAt) lic.activatedAt = Date.now();
  // Jangan set / jangan cek deviceId sebagai syarat
  await saveLicense(c, lic);

  const usage = await getUsage(c);
  return {
    ok: true,
    code: c,
    tier: lic.tier,
    quota: quotaSnapshot(lic, usage),
    mode: "password",
    message: "Kode berlaku selamanya. Bisa dipakai di HP manapun."
  };
}

/**
 * Potong kuota soal atau chat
 * type: 'soal' | 'chat'
 * amount: jumlah soal atau detik chat
 */
async function useQuota(code, deviceId, type, amount) {
  const c = normalizeCode(code);
  const lic = await getLicense(c);
  if (!lic) return { ok: false, error: "Kode tidak valid" };
  if (!lic.active) return { ok: false, error: "Kode dinonaktifkan" };
  // Model password: tidak cek device

  const lim = TIER_LIMITS[lic.tier] || TIER_LIMITS.lite;
  const usage = await getUsage(c);
  const n = Math.max(0, parseInt(amount, 10) || 0);

  if (type === "soal") {
    if (usage.soal + n > lim.dailySoal) {
      return {
        ok: false,
        error: "Kuota soal hari ini habis",
        quota: quotaSnapshot(lic, usage)
      };
    }
    usage.soal += n;
  } else if (type === "chat") {
    const maxSec = lim.dailyChatMin * 60;
    if (usage.chatSec >= maxSec) {
      return {
        ok: false,
        error: "Kuota ngobrol hari ini habis",
        quota: quotaSnapshot(lic, usage)
      };
    }
    usage.chatSec = Math.min(maxSec, usage.chatSec + n);
  } else {
    return { ok: false, error: "type harus soal atau chat" };
  }

  await saveUsage(c, usage);
  return { ok: true, quota: quotaSnapshot(lic, usage) };
}

async function checkQuota(code, deviceId) {
  const c = normalizeCode(code);
  const lic = await getLicense(c);
  if (!lic) return { ok: false, error: "Kode tidak valid" };
  if (!lic.active) return { ok: false, error: "Kode dinonaktifkan" };
  // Model password: tidak cek device
  const usage = await getUsage(c);
  return { ok: true, tier: lic.tier, quota: quotaSnapshot(lic, usage), mode: "password" };
}

function checkAdmin(password) {
  const expected = process.env.ADMIN_PASSWORD || "";
  if (!expected) return false;
  return String(password || "") === expected;
}

module.exports = {
  getLicense,
  saveLicense,
  listCodes,
  createCode,
  setActive,
  adminResetDevice,
  getUsage,
  activate,
  useQuota,
  checkQuota,
  checkAdmin,
  quotaSnapshot
};
