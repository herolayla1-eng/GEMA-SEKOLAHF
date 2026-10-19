/** Kuota & aturan tier GEMA */
const TIER_LIMITS = {
  lite: {
    label: "Lite",
    dailySoal: 10,
    dailyChatMin: 5,
    maxSoalPerGen: 5,
    watermark: "besar",
    maxDevices: 1,
    allowDeviceChange: false
  },
  sultan: {
    label: "Sultan",
    dailySoal: 100,
    dailyChatMin: 30,
    maxSoalPerGen: 10,
    watermark: "kecil",
    maxDevices: 1,
    allowDeviceChange: false
  },
  raja: {
    label: "Raja Pro",
    dailySoal: 500,
    dailyChatMin: 90,
    maxSoalPerGen: 20,
    watermark: "none",
    maxDevices: 1,
    allowDeviceChange: true, // ganti 1x lewat admin
    maxDeviceChanges: 1
  }
};

function wibDateStr(d = new Date()) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(d);
  } catch (e) {
    const x = d instanceof Date ? d : new Date();
    return (
      x.getFullYear() +
      "-" +
      String(x.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(x.getDate()).padStart(2, "0")
    );
  }
}

function normalizeCode(code) {
  return String(code || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

module.exports = { TIER_LIMITS, wibDateStr, normalizeCode };
