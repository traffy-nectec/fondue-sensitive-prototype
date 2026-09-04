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
import { SENSITIVE_TEXT as T } from "../shared/sensitive-text.js";
import { GALLERY_ICON_SVG, LOCK_ICON_SVG, openSecureZoomModal } from "../shared/sensitive-flow.js?v=4";

const root = document.getElementById("root");

const PIN_ICON = `<svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M7 10V7a5 5 0 0 1 10 0v3M6 10h12a1 1 0 0 1 1 1v9H5v-9a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// ข้อความทั้งหมดมาจาก shared/sensitive-text.js — อย่าเขียนคำทับในไฟล์นี้
const MODE_CONTENT = { setup: T.pin.setup, unlock: T.pin.unlock };

let viewToken = "";

/* ---------- หน้าที่ยังล็อกอยู่ ---------- */

function lockedMarkup() {
  return `
    <main class="sensitive-case-view with-actions">
      <div class="image-detail-container sensitive-single-image-container">
        <div class="before-image-container">
          <div class="before-text-container"><span class="before-text">แจ้ง</span></div>
          <img class="before-image" src="${lockedCase.censoredPhoto}"
               alt="${T.locked.photoAlt}" draggable="false">
          <div class="sensitive-image-lock-overlay">
            <span>${T.locked.photoLabel}</span>
            <button type="button" class="sv-unlock sv-unlock--onscrim" id="unlock-button">
              ${LOCK_ICON_SVG}${T.locked.unlockButton}
            </button>
          </div>
        </div>
      </div>

      <div class="content-detail-container">
        <div class="report-header-detail-container" style="background:#fdf3d4">
          <span class="report-elapsed-time-text">แจ้ง 1 ชม. ที่แล้ว&nbsp;</span>
          <span class="report-timestamp-text">${lockedCase.reportedAt}</span>
        </div>
        <span class="report-content-detail-container">${lockedCase.censoredDescription}</span>

        <!-- ปุ่มปลดล็อกจุดที่สอง ต่อท้ายข้อความรายละเอียด
             ผู้แจ้งที่อยากอ่านข้อความเต็มจะได้ไม่ต้องเลื่อนกลับขึ้นไปหาปุ่มบนภาพ -->
        <div class="sv-desc-unlock">
          <span class="sv-desc-unlock__hint">${T.locked.descriptionHint}</span>
          <button type="button" class="sv-unlock sv-unlock--solid" id="unlock-button-description">
            ${LOCK_ICON_SVG}${T.locked.unlockButton}
          </button>
        </div>

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

      <div class="timeline-detail-container">${lockedTimelineMarkup()}</div>
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
      const state = item.state || "inprogress";
      const isLast = index === lockedTimeline.length - 1;

      return `
        <div class="timeline-flex">
          <div class="timeline-box"${index === 0 ? ' style="border-left:0"' : ""}>
            <span class="timeline-step-icon color-state-${state}"></span>
          </div>
          <div class="timeline-content">
            <div>
              <span class="${isLast ? "bold-timeline-text" : "regular-timeline-text"}">${item.tl_state_name}&nbsp;</span>
              <span class="timestamp-timeline-text">${item.display_date} น.</span>
            </div>
            ${item.group_name ? `<span class="${isLast ? "bold-timeline-text" : "regular-timeline-text"}">ใช้เวลา ${formatElapsed(item.updated_on)}</span>` : ""}
            <span class="org-manage-text">โดย ${item.group_name || item.first_name}</span>
          </div>
        </div>
      `;
    })
    .join("");
}

function formatElapsed(updatedOn) {
  const started = new Date("2026-08-11T10:01:00+07:00");
  const updated = new Date(updatedOn.replace(" ", "T") + ":00+07:00");
  let minutes = Math.max(0, Math.floor((updated - started) / 60000));
  const days = Math.floor(minutes / 1440);
  minutes %= 1440;
  const hours = Math.floor(minutes / 60);
  minutes %= 60;
  return [days && `${days} วัน`, hours && `${hours} ชม.`, minutes && `${minutes} นาที`]
    .filter(Boolean)
    .join(" ") || "0 นาที";
}

function renderLocked() {
  root.innerHTML = lockedMarkup();
  // ปุ่มปลดล็อกทั้งสองจุดเรียก flow เดียวกัน
  document
    .getElementById("unlock-button")
    .addEventListener("click", openUnlockFlow);
  document
    .getElementById("unlock-button-description")
    .addEventListener("click", openUnlockFlow);
}

async function openUnlockFlow(event) {
  const button = event.currentTarget;
  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = `${LOCK_ICON_SVG}${T.locked.checking}`;
  const status = await getCredentialStatus();
  openPinModal(status.hasPin ? "unlock" : "setup");
  button.disabled = false;
  button.innerHTML = original;
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
      <button type="button" class="sensitive-modal-close" aria-label="${T.pin.closeLabel}">×</button>
      <div class="sensitive-pin-icon" aria-hidden="true">${PIN_ICON}</div>
      <h2>${content.title}</h2>
      <p class="sensitive-pin-description">${content.description}</p>
      ${notice ? `<div class="sensitive-pin-notice">${notice}</div>` : ""}
      <form>
        ${pinFieldMarkup("sensitive-pin", content.pinLabel)}
        ${needsConfirm ? pinFieldMarkup("sensitive-confirm-pin", T.pin.setup.confirmLabel) : ""}
        <div class="sensitive-pin-error" role="alert" hidden></div>
        <!-- เพิ่มปุ่มยกเลิกให้ตรงกับ web และ app เดิมมีแต่ปุ่ม × มุมบน
             ซึ่งบนมือถือกดยากและผู้ใช้มักไม่เห็น -->
        <div class="sensitive-pin-actions">
          <button type="button" class="sensitive-secondary-button sensitive-modal-cancel">${T.pin.cancel}</button>
          <button type="submit" class="sensitive-primary-button">${content.submit}</button>
        </div>
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

  backdrop
    .querySelectorAll(".sensitive-modal-close, .sensitive-modal-cancel")
    .forEach((button) => button.addEventListener("click", close));
  backdrop.querySelector("form").addEventListener("submit", async (event) => {
    event.preventDefault();
    errorBox.hidden = true;

    const pin = backdrop.querySelector("#sensitive-pin").value;
    if (!/^\d{6}$/.test(pin)) return showError(T.pin.errors.length);

    if (needsConfirm) {
      const confirmPin = backdrop.querySelector("#sensitive-confirm-pin").value;
      if (pin !== confirmPin) return showError(T.pin.errors.mismatch);
    }

    const submit = backdrop.querySelector(".sensitive-primary-button");
    submit.disabled = true;
    submit.textContent = T.pin.submitting;

    try {
      if (mode === "setup") {
        await createSensitivePin(pin);
        close();
        openPinModal("unlock", T.pin.setupDone);
        return;
      }

      const result = await unlockSensitiveCase(lockedCase.ticketId, pin);
      viewToken = result.viewToken;
      close();
      await renderUnlocked();
    } catch (error) {
      submit.disabled = false;
      submit.textContent = content.submit;
      showError(
        error.code === "INVALID_PIN" && error.attemptsRemaining != null
          ? `${error.message} (เหลืออีก ${error.attemptsRemaining} ครั้ง)`
          : error.message || T.pin.errors.generic
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
        <span>${T.unlocked.loading}</span>
      </div>
    </main>
  `;

  let content;
  try {
    content = await getRenderedContent(lockedCase.ticketId);
  } catch {
    // เดิมหน้านี้ไม่มี state นี้ ถ้า render ล้มจะค้างที่ spinner ตลอดไป
    root.innerHTML = `
      <main class="sensitive-case-view with-actions">
        <div class="sv-render-error">
          <p style="margin:0">${T.unlocked.renderFailed}</p>
          <button type="button" class="sv-unlock sv-unlock--solid" id="render-retry">${T.unlocked.retry}</button>
        </div>
      </main>
    `;
    document.getElementById("render-retry").addEventListener("click", renderLocked);
    return;
  }

  root.innerHTML = `
    <main class="sensitive-case-view with-actions">
      <section class="sensitive-rendered-card">
        <div class="sv-rendered-toolbar">
          <div class="sv-rendered-badges">
            <span class="sv-security-badge">${T.unlocked.badge}</span>
            <span class="sv-page-count">${T.unlocked.pageCount(content.pages.length)}</span>
          </div>
          <button type="button" class="sv-gallery-btn" id="open-gallery">
            ${GALLERY_ICON_SVG}${T.unlocked.galleryButton(content.media.length)}
          </button>
        </div>
        ${content.pages
          .map(
            (url, index) =>
              `<div class="sensitive-rendered-page is-loaded sensitive-rendered-page-clickable" data-page-index="${index}">
                 <img class="sensitive-rendered-detail" src="${url}"
                      alt="รายละเอียดหน้า ${index + 1}" draggable="false" loading="lazy">
                 <button type="button" class="sensitive-rendered-page-zoom-hint sv-page-zoom-hint" data-page-index="${index}">
                   <span>🔍</span> แตะเพื่อซูม
                 </button>
               </div>`
          )
          .join("")}
      </section>
    </main>
  `;

  const pageMedia = content.pages.map((pUrl, pIdx) => ({
    url: pUrl,
    label: `หน้าที่ ${pIdx + 1} จาก ${content.pages.length} (รายละเอียดและไทม์ไลน์)`,
  }));

  root.querySelectorAll(".sensitive-rendered-page-clickable").forEach((card) => {
    card.addEventListener("click", () => {
      const idx = Number(card.dataset.pageIndex || 0);
      openSecureZoomModal(pageMedia, idx, document.body);
    });
  });

  document
    .getElementById("open-gallery")
    .addEventListener("click", () => openSecureZoomModal(content.media, 0, document.body));
}

renderLocked();
