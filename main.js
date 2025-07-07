// ====================================================================
//  Gabriel Remote Assistants – Core Front‑End Module
//  ▸ handles: modal open/close, simple carousel, language toggle,
//            focus management, CSP‑safe (no eval / Function)
//  ▸ vanilla ES2023 – no bundler required, works under strict CSP
// ====================================================================

'use strict';

/* ------------------------------ Helpers ------------------------------ */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const trapStack = []; // keeps track of nested dialogs for focus trapping

/* --------------------------- Modal logic ----------------------------- */
function openModal(targetId) {
  const dlg = document.getElementById(targetId);
  if (!dlg) return;
  dlg.showModal();
  dlg.dataset.open = 'true';
  trapStack.push(dlg);
  // focus first focusable element inside
  const focusable = dlg.querySelector(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  if (focusable) focusable.focus();
}

function closeModal(dlg) {
  dlg.close();
  dlg.dataset.open = 'false';
  trapStack.pop();
  // restore focus to last element that opened modal
  const lastTrigger = dlg.triggerBtn;
  if (lastTrigger) lastTrigger.focus();
}

// trap focus inside topmost dialog
function handleFocus(event) {
  const top = trapStack[trapStack.length - 1];
  if (!top) return;
  if (!top.contains(event.target)) {
    event.stopPropagation();
    top.focus();
  }
}

document.addEventListener('focusin', handleFocus);

document.addEventListener('click', (e) => {
  // open modal buttons
  const btn = e.target.closest('[data-target]');
  if (btn) {
    e.preventDefault();
    openModal(btn.dataset.target);
    const dlg = document.getElementById(btn.dataset.target);
    if (dlg) dlg.triggerBtn = btn;
  }
  // close buttons
  const closer = e.target.closest('.modal-close');
  if (closer) closeModal(closer.closest('dialog'));
});

// close on ESC key
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const top = trapStack[trapStack.length - 1];
    if (top) {
      e.preventDefault();
      closeModal(top);
    }
  }
});

/* --------------------------- Carousel --------------------------------
   A minimal swipe/arrow carousel tied to each .carousel container.      */
class SimpleCarousel {
  constructor(root) {
    this.root = root;
    this.slides = [];
    this.index = 0;
    this.init();
  }
  async init() {
    const src = this.root.dataset.source;
    // Fetch images list JSON (would be statically hosted) – placeholder:
    try {
      const res = await fetch(`assets/${src}.json`, {cache:'force-cache'});
      if (!res.ok) throw new Error("Image list not found");
      const data = await res.json();
      this.slides = data;
      this.render();
    } catch(err) {
      console.error(err);
    }
  }
  render() {
    if (!this.slides.length) return;
    this.root.innerHTML = `
      <div class="carousel-track"></div>
      <button class="car-nav prev" aria-label="Previous">◀</button>
      <button class="car-nav next" aria-label="Next">▶</button>`;
    this.track = $('.carousel-track', this.root);
    this.track.style.display = 'flex';
    this.track.style.transition = 'transform .4s ease';
    this.track.style.willChange = 'transform';
    this.track.innerHTML = this.slides
      .map((src) => `<img src="${src}" alt="" loading="lazy">`)
      .join('');
    this.update();
    $('.prev', this.root).addEventListener('click', () => this.move(-1));
    $('.next', this.root).addEventListener('click', () => this.move(1));
  }
  move(step) {
    const len = this.slides.length;
    this.index = (this.index + step + len) % len;
    this.update();
  }
  update() {
    const offset = -this.index * 100;
    this.track.style.transform = `translateX(${offset}%)`;
  }
}

// init carousels on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  $$('.carousel').forEach((c) => new SimpleCarousel(c));
});

/* ------------------------ Language toggle --------------------------- */
const langBtn = $('#lang-toggle');
let currentLang = 'en';

function switchLang() {
  currentLang = currentLang === 'en' ? 'es' : 'en';
  langBtn.textContent = currentLang.toUpperCase();
  // swap data-en / data-es attributes
  $$('[data-en-placeholder]').forEach((el) => {
    const key = currentLang === 'en' ? 'en' : 'es';
    if (el.placeholder) el.placeholder = el.dataset[`${key}Placeholder`];
  });
  $$('[data-en-label]').forEach((el) => {
    const key = currentLang === 'en' ? 'en' : 'es';
    el.setAttribute('aria-label', el.dataset[`${key}Label`]);
  });
  $$('[data-en]').forEach((el) => {
    const key = currentLang;
    el.textContent = el.dataset[key];
  });
}

langBtn.addEventListener('click', switchLang);

/* ------------------ Progressive enhancement hooks ------------------- */
// register service‑worker if supported (PWA stage) – will be filled in Phase 7
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(console.error);
}
