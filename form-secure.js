// ====================================================================
//  Gabriel Remote Assistants – Secure‑Form Module  (Phase 4)
//  ▸ Encrypts form payload with AES‑256‑GCM before POST
//  ▸ Adds reCAPTCHA‑v3 token & CSRF nonce header
//  ▸ Falls back to plaintext if WebCrypto unavailable
//  --------------------------------------------------------------------
//  Usage: <form class="secure-form" data-endpoint="/api/submit" ...>
//         • Employment modal, Contact‐us modal, etc.
//         • Include a hidden input[name="honeypot"] for bot trap (empty)
// ====================================================================

'use strict';

// ---------- Config ----------------------------------------------------
const SITE_KEY = 'YOUR_RECAPTCHA_SITE_KEY';     // replace in build pipeline
const PASS_PHRASE = 'ops‑remote‑v1';            // derive AES‑GCM key (may rotate)
const CSRF_NONCE = document.querySelector('meta[http-equiv="Content-Security-Policy"]').getAttribute('nonce');

// ---------- Utilities -------------------------------------------------
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

// derive a CryptoKey from passphrase (PBKDF2 → rawKey → AES‑GCM key)
async function deriveKey(passphrase) {
  const salt = textEncoder.encode('ops‑assist');
  const baseKey = await crypto.subtle.importKey(
    'raw', textEncoder.encode(passphrase), {name: 'PBKDF2'}, false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256'},
    baseKey,
    {name: 'AES-GCM', length: 256},
    false,
    ['encrypt']
  );
}

async function encryptJSON(json, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96‑bit IV
  const encoded = textEncoder.encode(JSON.stringify(json));
  const cipher = await crypto.subtle.encrypt({name: 'AES-GCM', iv}, key, encoded);
  // return base64 strings for transport
  return {
    iv: btoa(String.fromCharCode(...iv)),
    data: btoa(String.fromCharCode(...new Uint8Array(cipher)))
  };
}

function getFormData(form) {
  const fd = new FormData(form);
  // strip honeypot
  if (fd.get('honeypot')) throw new Error('Bot suspected');
  const obj = {};
  for (const [k,v] of fd.entries()) obj[k] = v;
  return obj;
}

async function getRecaptchaToken() {
  if (!window.grecaptcha) return null;
  return grecaptcha.execute(SITE_KEY, {action: 'submit'});
}

// ---------- Submission handler ---------------------------------------
async function handleSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const endpoint = form.dataset.endpoint;
  if (!endpoint) return console.error('No endpoint specified');

  // basic client‑side validation (HTML5 constraints already run)
  if (!form.checkValidity()) return form.reportValidity();

  // gather + sanitise fields (DOMPurify optional)
  let payload = getFormData(form);
  if (window.DOMPurify) {
    for (const k in payload) payload[k] = DOMPurify.sanitize(payload[k]);
  }

  // add recaptcha token
  try {
    const token = await getRecaptchaToken();
    if (token) payload['recaptcha'] = token;
  } catch(err) {
    console.warn('reCAPTCHA failed', err);
  }

  let body, headers = {'Content-Type':'application/json'};
  if (window.crypto && crypto.subtle) {
    try {
      const key = await deriveKey(PASS_PHRASE);
      const enc = await encryptJSON(payload, key);
      body = JSON.stringify(enc);
      headers['X-Payload-Enc'] = 'aes-gcm';
    } catch(err) {
      console.error('Encryption error, sending plaintext', err);
      body = JSON.stringify(payload);
    }
  } else {
    body = JSON.stringify(payload);
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST', headers: {...headers, 'CSRF-Nonce': CSRF_NONCE}, body, mode: 'cors', credentials: 'omit'
    });
    if (!res.ok) throw new Error(await res.text());
    // Success – show thank‑you state
    form.reset();
    alert('Submitted successfully!');
  } catch(err) {
    console.error(err);
    alert('Submission failed: ' + err.message);
  }
}

// ---------- Init ------------------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('form.secure-form').forEach(form => {
    form.addEventListener('submit', handleSubmit);
  });
});
