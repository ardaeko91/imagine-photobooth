/* =============================================================
   Imagine Photobooth AI — Shared localStorage store & helpers
   Digunakan bersama oleh panel Admin dan halaman User Kiosk.
   ============================================================= */

// --- Storage keys (konsisten admin & user) ---
var STORE = {
  PRESETS:     'pb_presets',
  BRAND:       'pb_branding',
  HARDWARE:    'pb_hardware',
  API_KEY:     'pb_api_key',      // Gemini / Universal API Key
  FAL_KEY:     'pb_fal_api_key',  // Fal.ai API Key khusus
  GEMINI_MODEL:'pb_gemini_model', // Target Model Gemini
  FAL_MODEL:   'pb_fal_model',    // Target Model fal.ai
  GEMINI_PROMPT_MODEL: 'pb_gemini_prompt_model', // Model teks Gemini utk menulis prompt
  FAL_PROMPT_MODEL:    'pb_fal_prompt_model',    // Model teks fal.ai utk menulis prompt
  GALLERY:     'pb_gallery',
  PHOTO:       'pb_photo',
  THEME:       'pb_theme',
  SESSION:     'pb_session_seq',
  ENGINE:      'pb_ai_engine',    // Engine AI aktif: 'gemini' | 'fal'
  QUALITY:     'pb_output_quality' // Resolusi output: '1K' | '2K' | '4K'
};

// --- Default 10 preset ---
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

// --- AI Engine aktif ('gemini' | 'fal') ---
function getAiEngine() {
  return localStorage.getItem(STORE.ENGINE) || 'gemini';
}
function saveAiEngine(engine) {
  localStorage.setItem(STORE.ENGINE, engine === 'fal' ? 'fal' : 'gemini');
  return getAiEngine();
}

// --- API Keys (Auto Deteksi & Dual Support) ---
function getApiKey() {
  return localStorage.getItem(STORE.API_KEY) || localStorage.getItem('pb_gemini_api_key') || '';
}
function saveApiKey(key) {
  key = (key || '').trim();
  // Jika input diawali fal_ maka otomatis disimpan ke fal key
  if (key.indexOf('fal_') === 0) {
    localStorage.setItem(STORE.FAL_KEY, key);
  } else {
    localStorage.setItem(STORE.API_KEY, key);
  }
  return key;
}

function getFalApiKey() {
  return localStorage.getItem(STORE.FAL_KEY) || '';
}
function saveFalApiKey(key) {
  localStorage.setItem(STORE.FAL_KEY, (key || '').trim());
  return key || '';
}

function getGeminiModel() {
  return localStorage.getItem(STORE.GEMINI_MODEL) || 'gemini-2.5-flash-image';
}
function saveGeminiModel(model) {
  localStorage.setItem(STORE.GEMINI_MODEL, (model || 'gemini-2.5-flash-image').trim());
}

// --- Model fal.ai (dipakai saat engine aktif = 'fal') ---
function getFalModel() {
  return localStorage.getItem(STORE.FAL_MODEL) || 'fal-ai/flux-lora';
}
function saveFalModel(model) {
  localStorage.setItem(STORE.FAL_MODEL, (model || 'fal-ai/flux-lora').trim());
}

// Model milik engine yang sedang AKTIF (dipakai kiosk & playground)
function getActiveModel() {
  return getAiEngine() === 'fal' ? getFalModel() : getGeminiModel();
}

// --- Model teks untuk MENULIS/merapikan prompt (engine Gemini) ---
function getGeminiPromptModel() {
  return localStorage.getItem(STORE.GEMINI_PROMPT_MODEL) || 'gemini-2.5-flash';
}
function saveGeminiPromptModel(model) {
  localStorage.setItem(STORE.GEMINI_PROMPT_MODEL, (model || 'gemini-2.5-flash').trim());
}

// --- Model teks untuk MENULIS/merapikan prompt (engine fal.ai) ---
function getFalPromptModel() {
  return localStorage.getItem(STORE.FAL_PROMPT_MODEL) || '';
}
function saveFalPromptModel(model) {
  localStorage.setItem(STORE.FAL_PROMPT_MODEL, (model || '').trim());
}

// Model teks prompt milik engine AKTIF (default bijak per engine):
// pemakai harus mengisinya bila memakai fal (fal tidak punya model global).
function getActivePromptModel() {
  var e = getAiEngine();
  if (e === 'fal') return getFalPromptModel() || getFalModel(); // fallback ke model gambar
  return getGeminiPromptModel();
}
function saveActivePromptModel(model) {
  if (getAiEngine() === 'fal') saveFalPromptModel(model);
  else saveGeminiPromptModel(model);
}

// --- Kualitas / resolusi output (1x=1K, 2x=2K, 4x=4K) ---
function getOutputQuality() {
  var q = localStorage.getItem(STORE.QUALITY);
  return (q === '2K' || q === '4K') ? q : '1K';
}
function saveOutputQuality(q) {
  localStorage.setItem(STORE.QUALITY, (q === '2K' || q === '4K') ? q : '1K');
  return getOutputQuality();
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

// --- Session sequence ---
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

// --- Toast visual ---
var PB_TOAST_EL = null;
function showToast(message, kind) {
  kind = kind || 'success';
  var color = kind === 'error' ? '#e11d48' : (kind === 'info' ? '#334155' : '#059669');
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

// Compatibility wrapper agar PhotoboothStore tetap terbaca
window.PhotoboothStore = {
  // Engine
  getAiEngine: getAiEngine,
  setAiEngine: saveAiEngine,
  // API Keys
  getApiKey: getApiKey,
  setApiKey: saveApiKey,
  getFalApiKey: getFalApiKey,
  setFalApiKey: saveFalApiKey,
  // Model
  getGeminiModel: getGeminiModel,
  setGeminiModel: saveGeminiModel,
  getFalModel: getFalModel,
  setFalModel: saveFalModel,
  getActiveModel: getActiveModel,
  // Model teks prompt (terpisah dari model gambar)
  getGeminiPromptModel: getGeminiPromptModel,
  setGeminiPromptModel: saveGeminiPromptModel,
  getFalPromptModel: getFalPromptModel,
  setFalPromptModel: saveFalPromptModel,
  getActivePromptModel: getActivePromptModel,
  setActivePromptModel: saveActivePromptModel,
  // Kualitas output
  getOutputQuality: getOutputQuality,
  setOutputQuality: saveOutputQuality,
  // Data bersama
  getPresets: getPresets,
  savePresets: savePresets,
  getPresetById: getPresetById,
  getBranding: getBranding,
  saveBranding: saveBranding,
  getGallery: getGallery,
  addToGallery: addToGallery
};
