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
    const wrap = el("div", "sv-locked");

    const badge = el("div", "sv-badge");
    badge.append(el("span", "sv-badge__dot"), el("span", null, "ข้อมูลอ่อนไหว • ต้องใส่ PIN เพื่อเปิดดู"));

    const note = el(
      "p",
      "sv-note",
      "รายละเอียดและภาพของเรื่องนี้ถูกเข้ารหัสไว้ เมื่อเปิดดู ระบบจะสร้างภาพพร้อมลายน้ำระบุตัวผู้เปิด"
    );

    const button = el("button", "sv-button", "ปลดล็อกเพื่อดูรายละเอียด");
    button.addEventListener("click", openUnlockFlow);

    wrap.append(badge, note, button);
    render(wrap);
  }

  async function openUnlockFlow() {
    const status = await getCredentialStatus();
    renderPinForm(status.hasPin ? "unlock" : "setup");
  }

  /* ---------- ขั้นที่ 2: PIN ---------- */

  function renderPinForm(mode, notice = "") {
    setState(`pin:${mode}`);
    const wrap = el("div", "sv-pin");

    wrap.append(
      el("h3", "sv-pin__title", mode === "setup" ? "ตั้ง PIN 6 หลัก" : "กรอก PIN เพื่อปลดล็อก"),
      el(
        "p",
        "sv-pin__hint",
        mode === "setup"
          ? "ใช้ PIN นี้ทุกครั้งที่เปิดดูข้อมูลอ่อนไหว"
          : "prototype: PIN คือเลขที่ตั้งไว้ หรือ 123456 ถ้ายังไม่เคยตั้ง"
      )
    );

    const input = el("input", "sv-pin__input");
    input.type = "password";
    input.inputMode = "numeric";
    input.maxLength = 6;
    input.placeholder = "••••••";

    const message = el("div", "sv-pin__message");
    if (notice) {
      message.textContent = notice;
      message.classList.add("is-notice");
    }

    const submit = el("button", "sv-button", mode === "setup" ? "ตั้ง PIN" : "ปลดล็อก");
    const cancel = el("button", "sv-button sv-button--ghost", "ยกเลิก");
    cancel.addEventListener("click", renderLocked);

    const fail = (text) => {
      message.textContent = text;
      message.classList.remove("is-notice");
      submit.disabled = false;
      input.value = "";
      input.focus();
    };

    const handleSubmit = async () => {
      const pin = input.value.trim();
      if (!/^\d{6}$/.test(pin)) return fail("PIN ต้องเป็นตัวเลข 6 หลัก");

      submit.disabled = true;
      message.textContent = "";
      try {
        if (mode === "setup") {
          await createSensitivePin(pin);
          renderPinForm("unlock", "ตั้ง PIN สำเร็จ กรุณากรอก PIN อีกครั้งเพื่อปลดล็อก");
          return;
        }
        const result = await unlockSensitiveCase(ticketId, pin);
        viewToken = result.viewToken;
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
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") handleSubmit();
    });

    const actions = el("div", "sv-pin__actions");
    actions.append(submit, cancel);
    wrap.append(input, message, actions);
    render(wrap);
    input.focus();
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

    const bar = el("div", "sv-bar");
    bar.append(
      el(
        "span",
        null,
        content.isRealRender
          ? `เปิดดูอยู่ • ภาพ render จริงจากเรื่อง ${content.ticketId} พร้อมลายน้ำ`
          : "เปิดดูอยู่ • ภาพมีลายน้ำระบุตัวผู้เปิด"
      ),
      (() => {
        const lock = el("button", "sv-bar__lock", "ล็อกอีกครั้ง");
        lock.addEventListener("click", async () => {
          await revokeViewSession(viewToken);
          viewToken = "";
          renderLocked();
        });
        return lock;
      })()
    );

    const pages = el("div", "sv-pages");
    content.pages.forEach((url, index) => {
      const figure = el("figure", "sv-page");
      const image = el("img", "sv-page__img");
      image.src = url;
      image.alt = `รายละเอียดหน้า ${index + 1}`;
      image.loading = "lazy";
      figure.append(image, el("figcaption", "sv-page__caption", `หน้า ${index + 1} / ${content.pages.length}`));
      pages.append(figure);
    });

    const mediaTitle = el("h4", "sv-media__title", "ภาพประกอบ");
    const media = el("div", "sv-media");
    content.media.forEach((item) => {
      const button = el("button", "sv-media__item");
      const image = el("img", null);
      image.src = item.url;
      image.alt = item.label;
      image.loading = "lazy";
      button.append(image, el("span", "sv-media__label", item.label));
      button.addEventListener("click", () => openLightbox(item));
      media.append(button);
    });

    wrap.append(bar, pages, mediaTitle, media);
    render(wrap);
  }

  function openLightbox(item) {
    const overlay = el("div", "sv-lightbox");
    const image = el("img", null);
    image.src = item.url;
    image.alt = item.label;
    const close = el("button", "sv-lightbox__close", "ปิด");
    overlay.append(close, image, el("div", "sv-lightbox__label", item.label));
    const dismiss = () => overlay.remove();
    close.addEventListener("click", dismiss);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) dismiss();
    });
    document.body.append(overlay);
  }

  renderLocked();

  return {
    reset: renderLocked,
    getState: () => state,
  };
}
