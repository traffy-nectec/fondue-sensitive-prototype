/**
 * Mock ของฟีเจอร์ sensitive สำหรับ prototype — ไม่มี backend ไม่มี login
 *
 * ไฟล์นี้คือ "สัญญา" ระหว่าง 3 platform: LIFF, citydata-web, FondueManager
 * ทุกฝั่งต้องเรียกลำดับเดียวกันนี้ ต่างกันแค่ UI
 *
 *   1. getCredentialStatus()          → เคยตั้ง PIN ไว้หรือยัง
 *   2. createSensitivePin(pin)        → ตั้ง PIN ครั้งแรก (ถ้ายังไม่เคย)
 *   3. unlockSensitiveCase(id, pin)   → ปลดล็อก ได้ view token กลับมา
 *   4. getRenderedContent(id, token)  → ได้ URL ภาพหลายหน้า + ภาพแนบ
 *   5. revokeViewSession(token)       → ปิดหน้าจอ คืน session
 *
 * ของจริงเป็น HTTP ไปที่ access API และ render service ตัว signature เหมือนกัน
 * ดู sensitiveApi.js ใน fondue-liff-my-case เป็นตัวอ้างอิง
 */

const PIN_KEY = "fondue_sensitive_proto_pin";
const ATTEMPT_KEY = "fondue_sensitive_proto_attempts";
const MAX_ATTEMPTS = 5;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const base = (() => {
  // ทำงานได้ทั้งตอนเปิดจาก root ของ Pages และตอนเปิดไฟล์ตรงๆ
  const parts = window.location.pathname.split("/");
  parts.pop();
  parts.pop();
  return parts.join("/") + "/shared/";
})();

const readPin = () => {
  try {
    return JSON.parse(sessionStorage.getItem(PIN_KEY) || "null");
  } catch {
    return null;
  }
};

export const assetUrl = (name) => base + name;

export async function getCredentialStatus() {
  await wait(250);
  return { hasPin: readPin() !== null };
}

export async function createSensitivePin(pin) {
  await wait(350);
  sessionStorage.setItem(PIN_KEY, JSON.stringify({ pin }));
  sessionStorage.removeItem(ATTEMPT_KEY);
  return { success: true };
}

export async function resetSensitivePin(pin) {
  return createSensitivePin(pin);
}

export async function unlockSensitiveCase(ticketId, pin) {
  await wait(500);
  const expected = readPin()?.pin || "123456";

  if (pin !== expected) {
    const failed = Number(sessionStorage.getItem(ATTEMPT_KEY) || 0) + 1;
    sessionStorage.setItem(ATTEMPT_KEY, String(failed));
    const error = new Error("PIN ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง");
    error.code = failed >= MAX_ATTEMPTS ? "PIN_LOCKED" : "INVALID_PIN";
    error.attemptsRemaining = Math.max(0, MAX_ATTEMPTS - failed);
    if (error.code === "PIN_LOCKED") {
      error.message = "กรอก PIN ผิดเกินกำหนด ถูกล็อกชั่วคราว";
    }
    throw error;
  }

  sessionStorage.removeItem(ATTEMPT_KEY);
  return { viewToken: "proto-view-token", expiresInSeconds: 300 };
}

/**
 * ถ้ามีภาพ render จริงอยู่ใน shared/real-render/ ให้ใช้ตัวนั้นแทน SVG จำลอง
 * ดึงมาด้วย scripts/fetch-real-render.sh — ไม่มีก็ตกกลับไปใช้ของจำลองเงียบๆ
 */
let realRenderPromise = null;

async function loadRealRender() {
  if (!realRenderPromise) {
    realRenderPromise = fetch(assetUrl("real-render/manifest.json"), { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null);
  }
  return realRenderPromise;
}

export async function getRenderedContent(ticketId) {
  await wait(600);

  const real = await loadRealRender();
  if (real) {
    return {
      ticketId: real.ticketId || ticketId,
      renderId: "real-render",
      isRealRender: true,
      pages: real.pages.map((file) => assetUrl(`real-render/${file}`)),
      media: real.media.map((item) => ({
        id: item.id,
        label: item.label,
        url: assetUrl(`real-render/${item.file}`),
      })),
    };
  }

  return {
    ticketId,
    renderId: "proto-render-ticket",
    // ของจริงเป็น WebP หลายหน้าจาก render service — prototype ใช้ SVG แทน
    pages: [assetUrl("rendered-detail.svg"), assetUrl("rendered-detail-2.svg")],
    media: [
      { id: "report-image", label: "ภาพตอนแจ้ง", url: assetUrl("full-report-image.svg") },
      { id: "timeline-1", label: "ภาพการดำเนินงาน 1", url: assetUrl("full-timeline-image-1.svg") },
      { id: "timeline-2", label: "ภาพการดำเนินงาน 2", url: assetUrl("full-timeline-image-2.svg") },
    ],
  };
}

export async function revokeViewSession() {
  await wait(120);
  return { success: true };
}

/** ข้อมูลเรื่องแจ้งฉบับที่ยังไม่ปลดล็อก — ทุกฝั่งเห็นเหมือนกัน */
export const lockedCase = {
  ticketId: "2026-6U23NF",
  status: "กำลังดำเนินการ",
  category: "ทางเท้า",
  org: "Traffy @ ITS Lab2",
  reportedAt: "20 ส.ค. 69 14:20",
  updatedAt: "21 ส.ค. 69 11:30",
  securityLevel: 1,
  censoredDescription:
    "ผู้แจ้งชื่อ ***** แจ้งเหตุบริเวณ ***** กรุณาติดต่อกลับที่หมายเลข *****",
  censoredAddress: "*****",
  censoredPhoto: assetUrl("redacted-image.svg"),
};
