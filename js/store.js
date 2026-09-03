/* =============================================================
   Imagine Photobooth AI — Shared localStorage store & helpers
   Digunakan bersama oleh panel Admin dan halaman User Kiosk.
   ============================================================= */

// --- Storage keys (konsisten admin & user) ---
var STORE = {
  PRESETS:  'pb_presets',
  BRAND:    'pb_branding',
  HARDWARE: 'pb_hardware',
  API_KEY:  'pb_api_key',
  GALLERY:  'pb_gallery',
  PHOTO:    'pb_photo',
  THEME:    'pb_theme',
  SESSION:  'pb_session_seq'
};

// --- Default 10 preset (seed awal, mengikuti gaya asli style.html) ---
var DEFAULT_PRESETS = [
  { id: 'p1',  name: 'Cyberpunk 2077', image: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&auto=format&fit=crop', prompt: 'Neon cyberpunk city, futuristic neon lights, high detail, cinematic', ratio: '9:16', active: true },
  { id: 'p2',  name: 'Anime World',    image: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop', prompt: 'Anime illustration style, vibrant colors, clean lineart', ratio: '9:16', active: true },
  { id: 'p3',  name: 'Retro 90s',      image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop', prompt: 'Retro 90s film aesthetic, vintage tone, grainy film photo', ratio: '9:16', active: true },
  { id: 'p4',  name: '3D Render',      image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop', prompt: 'High quality 3D render, octane render look, soft studio lighting', ratio: '9:16', active: true },
  { id: 'p5',  name: 'Ghibli Studio',  image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop', prompt: 'Studio Ghibli style, warm handpainted background, whimsical', ratio: '9:16', active: true },
  { id: 'p6',  name: 'Cyber Samurai',  image: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=600&auto=format&fit=crop', prompt: 'Cybernetic samurai warrior, futuristic armor, dramatic lighting', ratio: '9:16', active: true },
  { id: 'p7',  name: 'Futuristic Mecha', image: 'https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?w=600&auto=format&fit=crop', prompt: 'Futuristic mecha robot, metallic details, sci-fi atmosphere', ratio: '9:16', active: true },
  { id: 'p8',  name: 'Fantasy Elf',    image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop', prompt: 'Fantasy elf character, magical forest, ethereal glow', ratio: '9:16', active: true },
  { id: 'p9',  name: 'Pixel Art',      image: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop', prompt: 'Pixel art 8-bit style, retro game aesthetic', ratio: '9:16', active: true },
  { id: 'p10', name: 'Neon Noir',      image: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop', prompt: 'Neon noir, moody cinematic, teal and magenta neon', ratio: '9:16', active: true }
];

// --- Utilitas kecil ---
function uid(prefix) {
  return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function safeJSON(key, fallback) {
  try {
    var raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

// Seed presets default hanya jika belum pernah dibuat.
function seedPresets() {
  if (!localStorage.getItem(STORE.PRESETS)) {
    localStorage.setItem(STORE.PRESETS, JSON.stringify(DEFAULT_PRESETS));
  }
}

// --- Presets ---
function getPresets() {
  seedPresets();
  return safeJSON(STORE.PRESETS, DEFAULT_PRESETS);
}
function savePresets(list) {
  localStorage.setItem(STORE.PRESETS, JSON.stringify(list));
  return list;
}
function getPresetById(id) {
  return getPresets().find(function (p) { return p.id === String(id); }) || null;
}

// --- Branding ---
function getBranding() {
  return safeJSON(STORE.BRAND, { brandName: 'Imagine Photobooth AI', igHandle: '@ardaeko', frameDataUrl: null });
}
function saveBranding(data) {
  localStorage.setItem(STORE.BRAND, JSON.stringify(data));
  return data;
}

// --- Hardware ---
function getHardware() {
  var d = safeJSON(STORE.HARDWARE, { camera: 'webcam', countdown: 5 });
  if (d.countdown === undefined) d.countdown = 5;
  if (!d.camera) d.camera = 'webcam';
  return d;
}
function saveHardware(data) {
  localStorage.setItem(STORE.HARDWARE, JSON.stringify(data));
  return data;
}

// --- API key ---
function getApiKey() {
  return localStorage.getItem(STORE.API_KEY) || '';
}
function saveApiKey(key) {
  localStorage.setItem(STORE.API_KEY, key || '');
  return key || '';
}

// --- Gallery ---
function getGallery() {
  return safeJSON(STORE.GALLERY, []);
}
function saveGallery(list) {
  localStorage.setItem(STORE.GALLERY, JSON.stringify(list));
  return list;
}
function addToGallery(item) {
  var list = getGallery();
  list.unshift(item);
  saveGallery(list);
  return item;
}
function removeFromGallery(id) {
  saveGallery(getGallery().filter(function (g) { return g.id !== String(id); }));
}

// --- Session sequence (untuk nomor sesi unik) ---
function nextSessionSeq() {
  var n = parseInt(localStorage.getItem(STORE.SESSION) || '0', 10) + 1;
  localStorage.setItem(STORE.SESSION, String(n));
  return n;
}

// --- Reset / cache ---
function resetUserSession() {
  localStorage.removeItem(STORE.PHOTO);
  localStorage.removeItem(STORE.THEME);
}
function clearGallery() {
  localStorage.removeItem(STORE.GALLERY);
}

// --- Toast sederhana untuk feedback visual (pengganti alert) ---
var PB_TOAST_EL = null;
function showToast(message, kind) {
  kind = kind || 'success'; // success | error | info
  var color = kind === 'error' ? 'bg-rose-600' : (kind === 'info' ? 'bg-slate-700' : 'bg-emerald-600');
  if (!PB_TOAST_EL) {
    PB_TOAST_EL = document.createElement('div');
    PB_TOAST_EL.id = 'pbToast';
    PB_TOAST_EL.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(20px);z-index:9999;padding:12px 22px;border-radius:14px;color:#fff;font:600 13px system-ui;box-shadow:0 10px 30px rgba(0,0,0,.5);opacity:0;transition:opacity .25s, transform .25s;pointer-events:none;';
    document.body.appendChild(PB_TOAST_EL);
  }
  PB_TOAST_EL.textContent = message;
  PB_TOAST_EL.style.background = color;
  PB_TOAST_EL.style.opacity = '1';
  PB_TOAST_EL.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(PB_TOAST_EL._t);
  PB_TOAST_EL._t = setTimeout(function () {
    PB_TOAST_EL.style.opacity = '0';
    PB_TOAST_EL.style.transform = 'translateX(-50%) translateY(20px)';
  }, 2200);
}