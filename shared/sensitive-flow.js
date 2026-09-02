/**
 * UI flow กลางของฟีเจอร์ sensitive — ใช้ร่วมกันทั้ง web และ app shell
 *
 * ตั้งใจเขียนเป็น vanilla JS ไม่ผูกกับ framework เพื่อให้ทั้งสองฝั่งเอาไป
 * "แปล" เป็นของตัวเองได้ง่าย (citydata-web = React, FondueManager = React Native)
 * สิ่งที่ควรลอกไปคือ *ลำดับการเรียก* และ *state ที่ต้องมี* ไม่ใช่ markup
 *
 * state ที่ทุกฝั่งต้องมี
 *   locked        → ยังไม่ปลดล็อก แสดงข้อมูลฉบับปกปิด + ปุ่มปลดล็อก
 *   pin:setup     → ยังไม่เคยตั้ง PIN ต้องตั้งก่อน
 *   pin:unlock    → มี PIN แล้ว ให้กรอกเพื่อเปิด
 *   loading       → กำลัง render ภาพ
 *   unlocked      → แสดงภาพหลายหน้า + ภาพแนบ
 *   error         → render ล้มเหลว / ticket หมดอายุ ให้ปลดล็อกใหม่
 */

import {
  createSensitivePin,
  getCredentialStatus,
  getRenderedContent,
  lockedCase,
  revokeViewSession,
  unlockSensitiveCase,
} from "./sensitive-mock.js";

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

export function mountSensitiveFlow(container, { ticketId, onStateChange }) {
  let viewToken = "";
  let state = "locked";

  const setState = (next) => {
    state = next;
    onStateChange?.(next);
  };

  const render = (node) => {
    container.replaceChildren(node);
  };

  /* ---------- ขั้นที่ 1: ยังล็อกอยู่ ---------- */

  function renderLocked() {
    setState("locked");
    const wrap = el("div", "sv-locked sv-locked-new");
    const media = el("div", "sv-locked-media");

    // ภาพตอนล็อกต้องเป็นภาพเดียวกันทั้ง 3 platform เปลี่ยนที่ lockedCase.censoredPhoto ที่เดียว
    const cover = el("img", "sv-locked-cover");
    cover.src = lockedCase.censoredPhoto;
    cover.alt = "ภาพถูกปกปิดข้อมูลอ่อนไหว";
    cover.draggable = false;

    const overlay = el("div", "sv-locked-overlay");
    overlay.append(el("span", "sv-locked-overlay-label", "ภาพถูกซ่อน"));

    const button = el("button", "sv-button sv-button-unlock");
    button.innerHTML = '<i class="fa-solid fa-unlock" style="font-size: 14px;"></i> ปลดล็อก';
    button.addEventListener("click", openUnlockFlow);

    overlay.append(button);
    media.append(cover, overlay);
    wrap.append(media);
    render(wrap);
  }

  async function openUnlockFlow() {
    const status = await getCredentialStatus();
    showPinModal(status.hasPin ? "unlock" : "setup");
  }

  /* ---------- ขั้นที่ 2: PIN ---------- */

  function showPinModal(mode, notice = "") {
    setState(`pin:${mode}`);
    const overlay = el("div", "sv-modal-overlay");
    
    const modal = el("div", "sv-pin-modal");
    
    const iconWrap = el("div", "sv-pin-modal-icon");
    iconWrap.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#714727" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`;

    const title = el("h3", "sv-pin-modal-title", mode === "setup" ? "ตั้งรหัสผ่านความปลอดภัย" : "ปลดล็อกข้อมูล Sensitive");
    const hint = el("p", "sv-pin-modal-subtitle", mode === "setup" ? "กรุณาตั้งรหัสผ่าน 6 หลักสำหรับการเข้าดูข้อมูล Sensitive" : "กรุณาใส่รหัสผ่าน 6 หลักของคุณ");

    const form = el("div", "sv-pin-modal-form");
    
    const group1 = el("div", "sv-pin-input-group");
    if (mode === "setup") {
      group1.append(el("label", null, "รหัสผ่าน"));
    }
    const input1 = el("input", "sv-pin-modal-input");
    input1.type = "password";
    input1.inputMode = "numeric";
    input1.maxLength = 6;
    input1.placeholder = "••••••";
    group1.append(input1);
    form.append(group1);

    let input2;
    if (mode === "setup") {
      const group2 = el("div", "sv-pin-input-group");
      group2.append(el("label", null, "ยืนยันรหัสผ่าน"));
      input2 = el("input", "sv-pin-modal-input");
      input2.type = "password";
      input2.inputMode = "numeric";
      input2.maxLength = 6;
      input2.placeholder = "••••••";
      group2.append(input2);
      form.append(group2);
    }

    const message = el("div", "sv-pin-modal-error");
    if (notice) {
      message.textContent = notice;
      message.classList.add("is-notice");
    }

    const actions = el("div", "sv-pin-modal-actions");
    const cancel = el("button", "sv-pin-btn-cancel", "ยกเลิก");
    const submit = el("button", "sv-pin-btn-submit", mode === "setup" ? "บันทึกและปลดล็อก" : "ตกลง");
    
    actions.append(cancel, submit);
    form.append(message, actions);
    
    modal.append(iconWrap, title, hint, form);
    overlay.append(modal);

    const dismiss = () => {
      overlay.remove();
      renderLocked();
    };

    cancel.addEventListener("click", dismiss);
    
    const fail = (text) => {
      message.textContent = text;
      message.classList.remove("is-notice");
      submit.disabled = false;
      input1.value = "";
      if (input2) input2.value = "";
      input1.focus();
    };

    const handleSubmit = async () => {
      const pin = input1.value.trim();
      if (!/^\d{6}$/.test(pin)) return fail("PIN ต้องเป็นตัวเลข 6 หลัก");

      if (mode === "setup") {
        const pin2 = input2.value.trim();
        if (pin !== pin2) return fail("รหัสผ่านไม่ตรงกัน");
      }

      submit.disabled = true;
      message.textContent = "";
      try {
        if (mode === "setup") {
          await createSensitivePin(pin);
          overlay.remove();
          showPinModal("unlock", "ตั้ง PIN สำเร็จ กรุณากรอก PIN อีกครั้งเพื่อปลดล็อก");
          return;
        }
        const result = await unlockSensitiveCase(ticketId, pin);
        viewToken = result.viewToken;
        overlay.remove();
        await renderUnlocked();
      } catch (error) {
        const remaining = error.attemptsRemaining;
        fail(
          remaining != null && error.code === "INVALID_PIN"
            ? `${error.message} (เหลืออีก ${remaining} ครั้ง)`
            : error.message
        );
      }
    };

    submit.addEventListener("click", handleSubmit);
    input1.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        if (mode === "setup") input2.focus();
        else handleSubmit();
      }
    });
    if (input2) {
      input2.addEventListener("keydown", (event) => {
        if (event.key === "Enter") handleSubmit();
      });
    }

    const root = container.closest('.phone') || document.body;
    root.append(overlay);
    input1.focus();
  }

  /* ---------- ขั้นที่ 3: ปลดล็อกแล้ว ---------- */

  async function renderUnlocked() {
    setState("loading");
    render(el("div", "sv-loading", "กำลังสร้างภาพรายละเอียด..."));

    let content;
    try {
      content = await getRenderedContent(ticketId);
    } catch {
      setState("error");
      const retry = el("button", "sv-button", "ลองอีกครั้ง");
      retry.addEventListener("click", renderLocked);
      const wrap = el("div", "sv-locked");
      wrap.append(el("p", "sv-note", "สร้างภาพไม่สำเร็จ กรุณาปลดล็อกใหม่อีกครั้ง"), retry);
      render(wrap);
      return;
    }

    setState("unlocked");
    const wrap = el("div", "sv-unlocked");

    const header = el("div", "sv-unlocked-header");
    
    const titleWrap = el("div", "sv-unlocked-title-wrap");
    titleWrap.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#714727" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg> <span class="sv-unlocked-title-text">ข้อมูล Sensitive</span>`;
    
    const galleryBtn = el("button", "sv-unlocked-gallery-btn");
    galleryBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg> ดูภาพทั้งหมด`;
    galleryBtn.addEventListener("click", () => {
       if (content.media && content.media.length > 0) {
           openLightbox(content.media, 0);
       }
    });

    header.append(titleWrap, galleryBtn);

    const pages = el("div", "sv-pages-new");
    content.pages.forEach((url, index) => {
      const figure = el("figure", "sv-page-card");
      const image = el("img", "sv-page-img");
      image.src = url;
      image.alt = `หน้า ${index + 1}`;
      image.loading = "lazy";
      figure.append(image);
      pages.append(figure);
    });

    wrap.append(header, pages);
    render(wrap);
  }

  function openLightbox(mediaArray, startIndex = 0) {
    const overlay = el("div", "sv-lightbox");
    
    // Header section
    const header = el("div", "sv-lightbox-header");
    const counter = el("span", "sv-lightbox__counter", `${startIndex + 1} / ${mediaArray.length}`);
    const close = el("button", "sv-lightbox__close", "×");
    header.append(counter, close);
    
    const track = el("div", "sv-lightbox-track");
    
    // Add Next/Prev buttons for desktop testing support
    const prevBtn = el("button", "sv-lightbox-nav prev", "❮");
    const nextBtn = el("button", "sv-lightbox-nav next", "❯");
    
    prevBtn.addEventListener("click", () => {
      track.scrollBy({ left: -track.clientWidth, behavior: 'smooth' });
    });
    nextBtn.addEventListener("click", () => {
      track.scrollBy({ left: track.clientWidth, behavior: 'smooth' });
    });

    mediaArray.forEach((item) => {
      const slide = el("div", "sv-lightbox-slide");
      const image = el("img", null);
      image.src = item.url;
      image.alt = item.label || "รูปภาพปัญหา";
      
      const caption = el("div", "sv-lightbox__label", item.label || "ไม่มีชื่อภาพ");
      slide.append(image, caption);
      track.append(slide);
    });

    overlay.append(header, prevBtn, nextBtn, track);

    const dismiss = () => overlay.remove();
    close.addEventListener("click", dismiss);
    
    // Update counter on scroll
    track.addEventListener("scroll", () => {
      const slideWidth = track.clientWidth;
      if (slideWidth > 0) {
        const currentIndex = Math.round(track.scrollLeft / slideWidth);
        counter.textContent = `${currentIndex + 1} / ${mediaArray.length}`;
        
        // Hide/Show buttons
        prevBtn.style.display = currentIndex === 0 ? "none" : "flex";
        nextBtn.style.display = currentIndex === mediaArray.length - 1 ? "none" : "flex";
      }
    });

    const root = container.closest('.phone') || document.body;
    root.append(overlay);
    
    // Initial button state
    prevBtn.style.display = startIndex === 0 ? "none" : "flex";
    nextBtn.style.display = startIndex === mediaArray.length - 1 ? "none" : "flex";

    if (startIndex > 0) {
      setTimeout(() => {
        track.scrollLeft = startIndex * track.clientWidth;
      }, 0);
    }
  }

  renderLocked();

  return {
    reset: renderLocked,
    getState: () => state,
  };
}
