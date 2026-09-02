/**
 * หน้า LIFF ผู้แจ้ง — เขียนมือให้ตรงกับของจริง
 *
 * markup กับ class ทั้งหมดลอกมาจาก fondue-liff-my-case:
 *   src/features/sensitive/SensitiveCaseView.jsx
 *   src/features/sensitive/SensitivePinModal.jsx
 *   src/features/sensitive/SensitiveFullImageViewer.jsx
 * ส่วน CSS ใช้ของจริงที่ compile จาก sensitive.scss + Detail.scss (assets/liff-real.css)
 *
 * ไม่มี React ไม่มี build ไม่เรียก API — ข้อมูลมาจาก shared/sensitive-mock.js
 */

import {
  createSensitivePin,
  getCredentialStatus,
  getRenderedContent,
  lockedCase,
  lockedTimeline,
  revokeViewSession,
  unlockSensitiveCase,
} from "../shared/sensitive-mock.js";

const root = document.getElementById("root");

const LOCK_ICON = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M7 10V7a5 5 0 0 1 9.6-1.95M6 10h12a1 1 0 0 1 1 1v9H5v-9a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const UNLOCKED_ICON = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M8 10V7a4 4 0 0 1 7.75-1.39M6 10h12a1 1 0 0 1 1 1v9H5v-9a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
const PIN_ICON = `<svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M7 10V7a5 5 0 0 1 10 0v3M6 10h12a1 1 0 0 1 1 1v9H5v-9a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const MODE_CONTENT = {
  setup: {
    title: "ตั้ง PIN สำหรับข้อมูล Sensitive",
    description: "PIN นี้ใช้สำหรับเปิดดูข้อมูล Sensitive ในเรื่องแจ้งของคุณ",
    submitLabel: "ตั้ง PIN",
  },
  unlock: {
    title: "ปลดล็อกข้อมูล Sensitive",
    description: "กรอก PIN 6 หลักเพื่อดูรายละเอียดเรื่องแจ้ง",
    submitLabel: "ปลดล็อก",
  },
};

let viewToken = "";

/* ---------- หน้าที่ยังล็อกอยู่ ---------- */

function lockedMarkup() {
  return `
    <main class="sensitive-case-view with-actions">
      <section class="sensitive-locked-toolbar">
        <div>
          <span class="sensitive-security-badge">ข้อมูล Sensitive</span>
          <strong>ข้อมูลฉบับเต็มถูกล็อก</strong>
        </div>
        <button type="button" class="sensitive-toolbar-unlock" id="unlock-button">
          ${LOCK_ICON}ปลดล็อก
        </button>
      </section>

      <div class="image-detail-container sensitive-single-image-container">
        <div class="before-image-container">
          <div class="before-text-container"><span class="before-text">แจ้ง</span></div>
          <img class="before-image" src="${lockedCase.censoredPhoto}"
               alt="ภาพที่ปิดข้อมูล Sensitive แล้ว" draggable="false">
        </div>
      </div>

      <div class="content-detail-container">
        <div class="report-header-detail-container" style="background:#fdf3d4">
          <span class="report-elapsed-time-text">แจ้ง 1 ชม. ที่แล้ว&nbsp;</span>
          <span class="report-timestamp-text">${lockedCase.reportedAt}</span>
        </div>
        <span class="report-content-detail-container">${lockedCase.censoredDescription}</span>

        <div class="current-header-detail-container" style="border:1px solid #f6d99a;background:#fdf3d4">
          <span class="current-status-text">${lockedCase.status}&nbsp;</span>
          <span class="current-timestamp-text">${lockedCase.updatedAt}&nbsp;&nbsp;</span>
        </div>
        <span class="current-content-detail-container">ข้อมูลการดำเนินงานถูกปกปิด</span>

        <div class="org-manage-text-container">
          <span class="org-manage-text-header">แก้ไขโดย</span>
          <div><span class="org-manage-text" style="color:#000">${lockedCase.org}</span></div>
        </div>
      </div>

      <div class="content-detail-container">
        <span class="report-content-detail-container" style="font-weight:700">การดำเนินงาน</span>
        ${lockedTimelineMarkup()}
      </div>

      <div class="extra-detail-container">
        <div class="ticket-id-container">
          <img class="verified-image" src="./assets/verified-Da4awtgz.png" alt="">
          <span class="ticket-id-text">#${lockedCase.ticketId}</span>
        </div>
        <div class="location-container">
          <img class="location-image" src="./assets/location-BAI0oWBL.png" alt="">
          <span class="location-text">${lockedCase.censoredAddress}</span>
        </div>
        <div class="problem-type-container">
          <span class="problem-type-text">${lockedCase.category}</span>
        </div>
      </div>
    </main>
  `;
}

/**
 * ไทม์ไลน์ตอนยังล็อก — API ส่งรายการมาครบ ตัดแค่ข้อความกับภาพ
 * ผู้แจ้งจึงยังเห็นว่าเรื่องเดินไปถึงไหนแล้ว
 */
function lockedTimelineMarkup() {
  return lockedTimeline
    .map((item, index) => {
      const state = item.tl_state_name === "ส่งต่อ" ? "forward" : "inprogress";
      const isLast = index === lockedTimeline.length - 1;

      return `
        <div class="timeline-flex">
          <div class="timeline-box"${index === 0 ? ' style="border-left:0"' : ""}>
            <span class="timeline-step-icon color-state-${state}"></span>
          </div>
          <div class="timeline-content">
            <div>
              <span class="${isLast ? "bold-timeline-text" : "regular-timeline-text"}">${item.tl_state_name}&nbsp;</span>
              <span class="timestamp-timeline-text">${item.updated_on} น.</span>
            </div>
            <span class="org-manage-text">โดย ${item.group_name || item.first_name}</span>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderLocked() {
  root.innerHTML = lockedMarkup();
  document
    .getElementById("unlock-button")
    .addEventListener("click", openUnlockFlow);
}

async function openUnlockFlow() {
  const button = document.getElementById("unlock-button");
  button.disabled = true;
  button.innerHTML = `${LOCK_ICON}กำลังตรวจสอบ...`;
  const status = await getCredentialStatus();
  openPinModal(status.hasPin ? "unlock" : "setup");
  button.disabled = false;
  button.innerHTML = `${LOCK_ICON}ปลดล็อก`;
}

/* ---------- modal ใส่ PIN ---------- */

function pinFieldMarkup(id, label) {
  return `
    <label class="sensitive-pin-label" for="${id}">${label}</label>
    <div class="sensitive-pin-field">
      <input id="${id}" class="sensitive-pin-native-input" type="password"
             inputmode="numeric" maxlength="6" autocomplete="off">
      <div class="sensitive-pin-dots" aria-hidden="true">
        ${Array.from({ length: 6 }, () => '<span class="sensitive-pin-dot"></span>').join("")}
      </div>
    </div>
  `;
}

function openPinModal(mode, notice = "") {
  const content = MODE_CONTENT[mode] || MODE_CONTENT.unlock;
  const needsConfirm = mode === "setup";

  const backdrop = document.createElement("div");
  backdrop.className = "sensitive-modal-backdrop";
  backdrop.innerHTML = `
    <div class="sensitive-pin-modal" role="dialog" aria-modal="true">
      <button type="button" class="sensitive-modal-close" aria-label="ปิด">×</button>
      <div class="sensitive-pin-icon" aria-hidden="true">${PIN_ICON}</div>
      <h2>${content.title}</h2>
      <p class="sensitive-pin-description">${content.description}</p>
      ${notice ? `<div class="sensitive-pin-notice">${notice}</div>` : ""}
      <form>
        ${pinFieldMarkup("sensitive-pin", "PIN 6 หลัก")}
        ${needsConfirm ? pinFieldMarkup("sensitive-confirm-pin", "ยืนยัน PIN") : ""}
        <div class="sensitive-pin-error" role="alert" hidden></div>
        <button type="submit" class="sensitive-primary-button">${content.submitLabel}</button>
      </form>
    </div>
  `;
  document.body.append(backdrop);
  document.body.style.overflow = "hidden";

  const close = () => {
    backdrop.remove();
    document.body.style.overflow = "";
  };

  // จุดแทน PIN ต้องขยับตามจำนวนหลักที่พิมพ์ เหมือน PinField ของจริง
  backdrop.querySelectorAll(".sensitive-pin-field").forEach((field) => {
    const input = field.querySelector("input");
    const dots = [...field.querySelectorAll(".sensitive-pin-dot")];
    input.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "").slice(0, 6);
      dots.forEach((dot, index) =>
        dot.classList.toggle("is-filled", index < input.value.length)
      );
    });
  });

  const errorBox = backdrop.querySelector(".sensitive-pin-error");
  const showError = (text) => {
    errorBox.textContent = text;
    errorBox.hidden = false;
  };

  backdrop.querySelector(".sensitive-modal-close").addEventListener("click", close);
  backdrop.querySelector("form").addEventListener("submit", async (event) => {
    event.preventDefault();
    errorBox.hidden = true;

    const pin = backdrop.querySelector("#sensitive-pin").value;
    if (pin.length !== 6) return showError("กรุณากรอก PIN เป็นตัวเลข 6 หลัก");

    if (needsConfirm) {
      const confirmPin = backdrop.querySelector("#sensitive-confirm-pin").value;
      if (pin !== confirmPin) return showError("PIN และยืนยัน PIN ไม่ตรงกัน");
    }

    const submit = backdrop.querySelector(".sensitive-primary-button");
    submit.disabled = true;
    submit.textContent = "กำลังดำเนินการ...";

    try {
      if (mode === "setup") {
        await createSensitivePin(pin);
        close();
        openPinModal("unlock", "ตั้ง PIN สำเร็จ กรุณากรอก PIN อีกครั้งเพื่อปลดล็อก");
        return;
      }

      const result = await unlockSensitiveCase(lockedCase.ticketId, pin);
      viewToken = result.viewToken;
      close();
      await renderUnlocked();
    } catch (error) {
      submit.disabled = false;
      submit.textContent = content.submitLabel;
      showError(
        error.code === "INVALID_PIN" && error.attemptsRemaining != null
          ? `${error.message} (เหลืออีก ${error.attemptsRemaining} ครั้ง)`
          : error.message
      );
    }
  });

  backdrop.querySelector("#sensitive-pin").focus();
}

/* ---------- หน้าหลังปลดล็อก ---------- */

async function renderUnlocked() {
  root.innerHTML = `
    <main class="sensitive-case-view with-actions">
      <div class="sensitive-loading-card">
        <div class="sensitive-spinner"></div>
        <span>กำลังโหลดข้อมูล Sensitive</span>
      </div>
    </main>
  `;

  const content = await getRenderedContent(lockedCase.ticketId);

  root.innerHTML = `
    <main class="sensitive-case-view with-actions">
      <section class="sensitive-unlocked-heading" id="unlocked-banner">
        <div>
          <span class="sensitive-security-badge">ปลดล็อกแล้ว</span>
          <h1>รายละเอียดเรื่องแจ้ง</h1>
          <p>ข้อมูลแสดงเป็นภาพและฝังลายน้ำของผู้เปิดดูแล้ว</p>
        </div>
        ${UNLOCKED_ICON}
      </section>

      <button type="button" class="sensitive-view-all-button" id="open-gallery">
        <span class="sensitive-view-all-icon" aria-hidden="true">▣</span>
        <span>
          <strong>ดูภาพทั้งหมด</strong>
          <small>${content.media.length} ภาพ พร้อมลายน้ำ</small>
        </span>
        <span aria-hidden="true">›</span>
      </button>

      <section class="sensitive-rendered-card">
        ${content.pages
          .map(
            (url, index) =>
              `<div class="sensitive-rendered-page is-loaded">
                 <img class="sensitive-rendered-detail" src="${url}"
                      alt="รายละเอียดหน้า ${index + 1}" draggable="false" loading="lazy">
               </div>`
          )
          .join("")}
      </section>
    </main>
  `;

  document
    .getElementById("open-gallery")
    .addEventListener("click", () => openGallery(content.media));

  // แจ้งว่าปลดล็อกสำเร็จแล้วค่อยหายไปเอง ไม่ต้องกินพื้นที่ถาวร
  // เพราะภาพที่แสดงอยู่ก็บอกอยู่แล้วว่าปลดล็อกได้
  const banner = document.getElementById("unlocked-banner");
  if (banner) {
    banner.style.transition = "opacity .4s ease, max-height .4s ease, margin .4s ease";
    setTimeout(() => {
      banner.style.opacity = "0";
      banner.style.maxHeight = "0";
      banner.style.margin = "0";
      banner.style.overflow = "hidden";
      setTimeout(() => banner.remove(), 450);
    }, 2600);
  }
}

/* ---------- แกลเลอรีภาพเต็ม ---------- */

function openGallery(media) {
  let index = 0;

  const backdrop = document.createElement("div");
  backdrop.className = "sensitive-gallery-backdrop";
  document.body.append(backdrop);

  const draw = () => {
    const current = media[index];
    backdrop.innerHTML = `
      <div class="sensitive-gallery-toolbar">
        <div>
          <strong>${current.label}</strong>
          <span>${index + 1} / ${media.length}</span>
        </div>
        <button type="button" aria-label="ปิดภาพเต็ม">×</button>
      </div>
      <div class="sensitive-gallery-content">
        ${media.length > 1 ? '<button type="button" class="sensitive-gallery-navigation previous" aria-label="ภาพก่อนหน้า">‹</button>' : ""}
        <img src="${current.url}" alt="${current.label}" draggable="false">
        ${media.length > 1 ? '<button type="button" class="sensitive-gallery-navigation next" aria-label="ภาพถัดไป">›</button>' : ""}
      </div>
    `;

    backdrop
      .querySelector(".sensitive-gallery-toolbar button")
      .addEventListener("click", () => backdrop.remove());
    backdrop.querySelector(".previous")?.addEventListener("click", () => {
      index = (index - 1 + media.length) % media.length;
      draw();
    });
    backdrop.querySelector(".next")?.addEventListener("click", () => {
      index = (index + 1) % media.length;
      draw();
    });
  };

  draw();
}

renderLocked();
