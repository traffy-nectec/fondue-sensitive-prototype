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
import { SENSITIVE_TEXT as T } from "./sensitive-text.js";

/* ไอคอนกลาง — ปุ่มเดียวกันต้องใช้ไอคอนตัวเดียวกันทุก platform */
export const LOCK_ICON_SVG = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 9.6-1.95M6 10h12a1 1 0 0 1 1 1v9H5v-9a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
export const GALLERY_ICON_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`;

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
    cover.alt = T.locked.photoAlt;
    cover.draggable = false;

    const overlay = el("div", "sv-locked-overlay");
    overlay.append(el("span", "sv-locked-overlay-label", T.locked.photoLabel));

    const button = el("button", "sv-unlock sv-unlock--onscrim");
    button.type = "button";
    button.innerHTML = `${LOCK_ICON_SVG}${T.locked.unlockButton}`;
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
    const copy = mode === "setup" ? T.pin.setup : T.pin.unlock;
    const overlay = el("div", "sv-modal-overlay");

    const modal = el("div", "sv-pin-modal");

    const iconWrap = el("div", "sv-pin-modal-icon");
    iconWrap.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#714727" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`;

    const title = el("h3", "sv-pin-modal-title", copy.title);
    const hint = el("p", "sv-pin-modal-subtitle", copy.description);

    const form = el("div", "sv-pin-modal-form");

    // ติดป้ายช่องกรอกทุกโหมด ไม่ใช่เฉพาะตอนตั้ง PIN
    // เดิมโหมด unlock ไม่มีป้าย ผู้ใช้เห็นแต่ช่องว่างไม่รู้ว่าต้องกรอกกี่หลัก
    const group1 = el("div", "sv-pin-input-group");
    group1.append(el("label", null, copy.pinLabel));
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
      group2.append(el("label", null, T.pin.setup.confirmLabel));
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
    const cancel = el("button", "sv-pin-btn-cancel", T.pin.cancel);
    const submit = el("button", "sv-pin-btn-submit", copy.submit);

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
      submit.textContent = copy.submit;
      input1.value = "";
      if (input2) input2.value = "";
      input1.focus();
    };

    const handleSubmit = async () => {
      const pin = input1.value.trim();
      if (!/^\d{6}$/.test(pin)) return fail(T.pin.errors.length);

      if (mode === "setup") {
        const pin2 = input2.value.trim();
        if (pin !== pin2) return fail(T.pin.errors.mismatch);
      }

      submit.disabled = true;
      submit.textContent = T.pin.submitting;
      message.textContent = "";
      try {
        if (mode === "setup") {
          await createSensitivePin(pin);
          overlay.remove();
          showPinModal("unlock", T.pin.setupDone);
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
    render(el("div", "sv-loading", T.unlocked.loading));

    let content;
    try {
      content = await getRenderedContent(ticketId);
    } catch {
      setState("error");
      const retry = el("button", "sv-unlock sv-unlock--solid", T.unlocked.retry);
      retry.type = "button";
      retry.addEventListener("click", renderLocked);
      const wrap = el("div", "sv-render-error");
      wrap.append(el("p", "sv-note", T.unlocked.renderFailed), retry);
      render(wrap);
      return;
    }

    setState("unlocked");
    const wrap = el("div", "sv-unlocked");

    // แถบหัวการ์ดแบบเดียวกับ LIFF และ web — [SENSITIVE] [n หน้า] ... [ดูภาพทั้งหมด (n)]
    // เดิม app ใช้หัวข้อ "ข้อมูล Sensitive" กับปุ่มที่ไม่บอกจำนวนภาพ ทำให้ไม่ตรงกับอีกสองหน้า
    const header = el("div", "sv-rendered-toolbar");

    const badges = el("div", "sv-rendered-badges");
    badges.append(
      el("span", "sv-security-badge", T.unlocked.badge),
      el("span", "sv-page-count", T.unlocked.pageCount(content.pages.length))
    );

    const galleryBtn = el("button", "sv-gallery-btn");
    galleryBtn.type = "button";
    galleryBtn.innerHTML = `${GALLERY_ICON_SVG}${T.unlocked.galleryButton(content.media.length)}`;
    galleryBtn.disabled = !content.media?.length;
    galleryBtn.addEventListener("click", () => {
      if (content.media?.length) openLightbox(content.media, 0);
    });

    header.append(badges, galleryBtn);

    const pages = el("div", "sv-pages-new");
    const pageMedia = content.pages.map((pUrl, pIdx) => ({
      url: pUrl,
      label: `หน้าที่ ${pIdx + 1} จาก ${content.pages.length} (รายละเอียดและไทม์ไลน์)`,
    }));

    content.pages.forEach((url, index) => {
      const figure = el("figure", "sv-page-card");
      const image = el("img", "sv-page-img");
      image.src = url;
      image.alt = `หน้า ${index + 1}`;
      image.loading = "lazy";

      const zoomHint = el("button", "sv-page-zoom-hint");
      zoomHint.type = "button";
      zoomHint.innerHTML = `<span>🔍</span> แตะเพื่อซูม`;

      figure.append(image, zoomHint);
      figure.addEventListener("click", () => {
        const root = container.closest(".phone") || document.body;
        openSecureZoomModal(pageMedia, index, root);
      });
      pages.append(figure);
    });

    // ห่อ toolbar + หน้าไว้ในการ์ดใบเดียวเหมือน .sensitive-rendered-card ของ LIFF
    // เพื่อให้โครงหลังปลดล็อกเป็นก้อนเดียวกันทั้งสามหน้า
    const card = el("section", "sv-rendered-card");
    card.append(header, pages);
    wrap.append(card);
    render(wrap);
  }

  function openLightbox(mediaArray, startIndex = 0) {
    const root = container.closest(".phone") || document.body;
    openSecureZoomModal(mediaArray, startIndex, root);
  }

  renderLocked();

  return {
    reset: renderLocked,
    getState: () => state,
    // เปิด flow ปลดล็อกจากข้างนอกได้ — shell เอาไปผูกกับปุ่มปลดล็อกที่อยู่ท้ายข้อความ
    // รายละเอียด ซึ่งวาดอยู่นอก container ของ flow
    unlock: openUnlockFlow,
  };
}

/**
 * ปุ่มปลดล็อกที่ต่อท้ายข้อความรายละเอียด
 *
 * ผู้ใช้ที่สนใจ "ข้อความ" มากกว่า "ภาพ" จะได้ไม่ต้องไปหาปุ่มที่มุมภาพ
 * shell ไหนก็เรียกได้ ขอแค่มี element ของข้อความรายละเอียดให้ต่อท้าย
 */
export function attachDescriptionUnlock(afterNode, onUnlock) {
  if (!afterNode) return null;

  const row = document.createElement("div");
  row.className = "sv-desc-unlock";

  const hint = document.createElement("span");
  hint.className = "sv-desc-unlock__hint";
  hint.textContent = T.locked.descriptionHint;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "sv-unlock sv-unlock--solid";
  button.innerHTML = `${LOCK_ICON_SVG}${T.locked.unlockButton}`;
  button.addEventListener("click", onUnlock);

  row.append(hint, button);
  afterNode.insertAdjacentElement("afterend", row);
  return row;
}

/**
 * ฟังก์ชันเปิดดูภาพ/เอกสารแบบซูมขยายและป้องกันการบันทึกภาพ (Zoom & Anti-Download Viewer)
 * ใช้งานร่วมกันทั้ง App, LIFF, และ Web
 */
export function openSecureZoomModal(mediaArray, startIndex = 0, rootNode = document.body) {
  if (!mediaArray || mediaArray.length === 0) return;

  let currentIndex = Math.max(0, Math.min(startIndex, mediaArray.length - 1));
  let scale = 1.0;
  let posX = 0;
  let posY = 0;

  const MIN_SCALE = 1.0;
  const MAX_SCALE = 4.0;
  const STEP_SCALE = 0.5;

  const clamp = (val, min, max) => Math.max(min, Math.min(val, max));

  const overlay = el("div", "sv-lightbox");
  overlay.oncontextmenu = (e) => e.preventDefault();

  // Header
  const header = el("div", "sv-lightbox-header");
  const heading = el("div", "sv-lightbox__heading");
  const titleEl = el(
    "strong",
    "sv-lightbox__title",
    mediaArray[currentIndex]?.label || T.gallery.untitled
  );
  const counterEl = el(
    "span",
    "sv-lightbox__counter",
    T.gallery.counter(currentIndex, mediaArray.length)
  );
  heading.append(titleEl, counterEl);

  const closeBtn = el("button", "sv-lightbox__close", "×");
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", T.gallery.close);
  closeBtn.addEventListener("click", () => {
    overlay.remove();
    document.body.style.overflow = "";
  });
  header.append(heading, closeBtn);

  // Viewport
  const viewport = el("div", "sv-zoom-viewport");

  // Nav buttons
  const prevBtn = el("button", "sv-lightbox-nav prev", "‹");
  const nextBtn = el("button", "sv-lightbox-nav next", "›");
  prevBtn.type = "button";
  nextBtn.type = "button";
  prevBtn.setAttribute("aria-label", T.gallery.previous);
  nextBtn.setAttribute("aria-label", T.gallery.next);

  // Zoom Container & Image
  const zoomContainer = el("div", "sv-zoom-container");
  const imgEl = el("img", "sv-zoom-image");
  imgEl.draggable = false;
  imgEl.oncontextmenu = (e) => e.preventDefault();
  zoomContainer.append(imgEl);

  // Transparent Shield Layer
  const shield = el("div", "sv-zoom-shield");
  shield.oncontextmenu = (e) => e.preventDefault();

  viewport.append(prevBtn, nextBtn, zoomContainer, shield);

  // Floating Zoom Controls Bar
  const controls = el("div", "sv-zoom-controls");
  const zoomOutBtn = el("button", "sv-zoom-btn", "−");
  zoomOutBtn.type = "button";
  zoomOutBtn.setAttribute("aria-label", "ซูมออก");

  const badgeBtn = el("button", "sv-zoom-badge", "100%");
  badgeBtn.type = "button";
  badgeBtn.title = "แตะเพื่อรีเซ็ต 100%";

  const zoomInBtn = el("button", "sv-zoom-btn", "+");
  zoomInBtn.type = "button";
  zoomInBtn.setAttribute("aria-label", "ซูมเข้า");

  const resetBtn = el("button", "sv-zoom-reset", "รีเซ็ต");
  resetBtn.type = "button";
  resetBtn.style.display = "none";

  controls.append(zoomOutBtn, badgeBtn, zoomInBtn, resetBtn);

  // Security Notice Footer
  const notice = el("div", "sv-zoom-notice");
  const noticeText = el("span", null, "🔒 โหมดความปลอดภัย: ป้องกันการดาวน์โหลดและบันทึกภาพ");
  const noticeHint = el("small", null, "แตะ 2 ครั้ง หรือกางสองนิ้วเพื่อซูม");
  notice.append(noticeText, noticeHint);

  overlay.append(header, viewport, controls, notice);

  function updateTransform(withTransition = false) {
    zoomContainer.style.transition = withTransition
      ? "transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)"
      : "none";
    zoomContainer.style.transform = `translate(${posX}px, ${posY}px) scale(${scale})`;
    badgeBtn.textContent = `${Math.round(scale * 100)}%`;
    resetBtn.style.display = scale > 1.1 ? "inline-block" : "none";
    zoomOutBtn.disabled = scale <= MIN_SCALE;
    zoomInBtn.disabled = scale >= MAX_SCALE;

    if (mediaArray.length > 1) {
      prevBtn.style.display = scale <= 1.1 && currentIndex > 0 ? "flex" : "none";
      nextBtn.style.display =
        scale <= 1.1 && currentIndex < mediaArray.length - 1 ? "flex" : "none";
    } else {
      prevBtn.style.display = "none";
      nextBtn.style.display = "none";
    }
  }

  function resetZoom() {
    scale = 1.0;
    posX = 0;
    posY = 0;
    updateTransform(true);
  }

  function setSlide(idx) {
    currentIndex = idx;
    const item = mediaArray[currentIndex];
    imgEl.src = item.url;
    imgEl.alt = item.label || T.gallery.untitled;
    titleEl.textContent = item.label || T.gallery.untitled;
    counterEl.textContent = T.gallery.counter(currentIndex, mediaArray.length);
    resetZoom();
  }

  // Zoom button handlers
  zoomInBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    scale = clamp(scale + STEP_SCALE, MIN_SCALE, MAX_SCALE);
    updateTransform(true);
  });

  zoomOutBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    scale = clamp(scale - STEP_SCALE, MIN_SCALE, MAX_SCALE);
    if (scale <= 1.05) {
      posX = 0;
      posY = 0;
    }
    updateTransform(true);
  });

  badgeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    resetZoom();
  });

  resetBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    resetZoom();
  });

  prevBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (currentIndex > 0) setSlide(currentIndex - 1);
  });

  nextBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (currentIndex < mediaArray.length - 1) setSlide(currentIndex + 1);
  });

  // Touch gesture handling
  let touchStartDist = 0;
  let touchStartScale = 1;
  let isPinching = false;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartTx = 0;
  let dragStartTy = 0;
  let lastTapTime = 0;

  const getDistance = (t1, t2) =>
    Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

  viewport.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length === 2) {
        isPinching = true;
        isDragging = false;
        touchStartDist = getDistance(e.touches[0], e.touches[1]);
        touchStartScale = scale;
      } else if (e.touches.length === 1) {
        isPinching = false;
        if (scale > 1.05) {
          isDragging = true;
          dragStartX = e.touches[0].clientX;
          dragStartY = e.touches[0].clientY;
          dragStartTx = posX;
          dragStartTy = posY;
        }
      }
    },
    { passive: true }
  );

  viewport.addEventListener(
    "touchmove",
    (e) => {
      if (isPinching && e.touches.length === 2) {
        e.preventDefault();
        const dist = getDistance(e.touches[0], e.touches[1]);
        const ratio = dist / (touchStartDist || 1);
        scale = clamp(touchStartScale * ratio, MIN_SCALE, MAX_SCALE);
        updateTransform(false);
      } else if (isDragging && e.touches.length === 1) {
        e.preventDefault();
        const dx = e.touches[0].clientX - dragStartX;
        const dy = e.touches[0].clientY - dragStartY;
        const rect = viewport.getBoundingClientRect();
        const maxTx = ((scale - 1) * rect.width) / 2;
        const maxTy = ((scale - 1) * rect.height) / 2;
        posX = clamp(dragStartTx + dx, -maxTx, maxTx);
        posY = clamp(dragStartTy + dy, -maxTy, maxTy);
        updateTransform(false);
      }
    },
    { passive: false }
  );

  viewport.addEventListener(
    "touchend",
    (e) => {
      if (e.touches.length < 2) isPinching = false;
      if (e.touches.length === 0) {
        isDragging = false;
        if (scale < 1.05) resetZoom();
      }
    },
    { passive: true }
  );

  viewport.addEventListener("click", (e) => {
    if (
      e.target === prevBtn ||
      e.target === nextBtn ||
      e.target.closest(".sv-zoom-controls")
    )
      return;
    const now = Date.now();
    if (now - lastTapTime < 320) {
      if (scale > 1.2) {
        resetZoom();
      } else {
        scale = 2.5;
        posX = 0;
        posY = 0;
        updateTransform(true);
      }
      lastTapTime = 0;
    } else {
      lastTapTime = now;
    }
  });

  // Wheel zoom (Desktop / Web)
  viewport.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.25 : -0.25;
      scale = clamp(scale + delta, MIN_SCALE, MAX_SCALE);
      if (scale <= 1.05) {
        posX = 0;
        posY = 0;
      }
      updateTransform(true);
    },
    { passive: false }
  );

  // Mouse drag pan (Desktop / Web)
  let isMouseDown = false;
  let mouseStartX = 0;
  let mouseStartY = 0;
  let mouseStartTx = 0;
  let mouseStartTy = 0;

  viewport.addEventListener("mousedown", (e) => {
    if (scale > 1.05) {
      isMouseDown = true;
      mouseStartX = e.clientX;
      mouseStartY = e.clientY;
      mouseStartTx = posX;
      mouseStartTy = posY;
    }
  });

  window.addEventListener("mousemove", (e) => {
    if (isMouseDown && scale > 1.05) {
      const dx = e.clientX - mouseStartX;
      const dy = e.clientY - mouseStartY;
      const rect = viewport.getBoundingClientRect();
      const maxTx = ((scale - 1) * rect.width) / 2;
      const maxTy = ((scale - 1) * rect.height) / 2;
      posX = clamp(mouseStartTx + dx, -maxTx, maxTx);
      posY = clamp(mouseStartTy + dy, -maxTy, maxTy);
      updateTransform(false);
    }
  });

  window.addEventListener("mouseup", () => {
    isMouseDown = false;
  });

  // Keyboard navigation
  const keyHandler = (e) => {
    if (e.key === "Escape") {
      overlay.remove();
      document.body.style.overflow = "";
      window.removeEventListener("keydown", keyHandler);
    } else if (e.key === "ArrowLeft" && currentIndex > 0) {
      setSlide(currentIndex - 1);
    } else if (e.key === "ArrowRight" && currentIndex < mediaArray.length - 1) {
      setSlide(currentIndex + 1);
    }
  };
  window.addEventListener("keydown", keyHandler);

  setSlide(currentIndex);
  document.body.style.overflow = "hidden";
  rootNode.append(overlay);
}
