/* =============================================================
   js/api.js — Integrasi AI multi-engine (Gemini & fal.ai)
   Dipakai bersama oleh admin/preset-editor.html & user/process.html
   Butuh js/store.js dimuat lebih dulu (menggunakan store helpers).
   ============================================================= */

var GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
var FAL_API_URL = 'https://fal.run';

/**
 * Konversi sumber gambar (dataURL / URL) menjadi string base64 murni.
 * Mengembalikan dummy pixel 1x1 yang aman bila fetch gagal (CORS dll),
 * supaya pemanggil tidak pernah menggantung.
 */
async function imageUrlToBase64(src) {
  var SAFE_DUMMY = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  if (!src) return SAFE_DUMMY;
  if (src.indexOf('data:image') === 0) {
    return src.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');
  }
  try {
    var res = await fetch(src, { mode: 'cors' });
    var blob = await res.blob();
    return await new Promise(function (resolve) {
      var reader = new FileReader();
      reader.onloadend = function () {
        var b64 = (reader.result || '').replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');
        resolve(b64 || SAFE_DUMMY);
      };
      reader.onerror = function () { resolve(SAFE_DUMMY); };
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    return SAFE_DUMMY;
  }
}

/**
 * Kompres dataURL ke JPEG dengan sisi terpanjang = maxSide.
 * Penting agar hasil AI muat di localStorage (kiosk & gallery).
 */
function downscaleDataUrl(dataUrl, maxSide, quality) {
  maxSide = maxSide || 1280;
  quality = quality || 0.85;
  return new Promise(function (resolve) {
    var img = new Image();
    img.onload = function () {
      var scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      var w = Math.max(1, Math.round(img.width * scale));
      var h = Math.max(1, Math.round(img.height * scale));
      var canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      try { resolve(canvas.toDataURL('image/jpeg', quality)); }
      catch (e) { resolve(dataUrl); }
    };
    img.onerror = function () { resolve(dataUrl); };
    img.src = dataUrl;
  });
}

/* ---------------- Adapter: Google Gemini ---------------- */
async function geminiGenerate(opts) {
  var activeKey = opts.apiKey || getApiKey();
  var activeModel = opts.model || getGeminiModel();
  if (!activeKey) throw new Error('API Key Google AI Studio belum dikonfigurasi di Admin Panel!');

  var parts = [{ text: opts.prompt }];
  (opts.imageBase64List || []).forEach(function (b64) {
    parts.push({ inline_data: { mime_type: 'image/jpeg', data: b64 } });
  });

  // Model harus model GAMBAR (nama mengandung 'image'/'nano'). Model teks murni
  // (mis. gemini-3.8-flash) tidak pernah mengembalikan gambar -> gagal cepat, hemat credit.
  var isImageModel = activeModel.indexOf('image') !== -1 || activeModel.indexOf('nano') !== -1;
  if (!isImageModel) {
    throw new Error('Model "' + activeModel + '" adalah model TEKS, bukan model gambar. Pilih model *-image (contoh: gemini-3.1-flash-image).');
  }
  var payload = { contents: [{ parts: parts }] };
  if (isImageModel) {
    var genCfg = { responseModalities: ['TEXT', 'IMAGE'] };
    // Gemini 3 image: aspectRatio & imageSize (1K/2K/4K) dikirim native
    var imgCfg = {};
    if (opts.aspectRatio) imgCfg.aspectRatio = opts.aspectRatio;
    if (opts.imageSize && opts.imageSize !== '1K') imgCfg.imageSize = opts.imageSize;
    if (imgCfg.aspectRatio || imgCfg.imageSize) genCfg.imageConfig = imgCfg;
    payload.generationConfig = genCfg;
  }

  var response = await fetch(GEMINI_API_URL + '/' + activeModel + ':generateContent?key=' + encodeURIComponent(activeKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  var data = await response.json();
  if (data.error) throw new Error(data.error.message || 'Gagal memanggil Gemini API');

  var out = { text: '', imageDataUrl: null };
  // Diagnosis respons kosong: safety block, panjang maksimal, dsb.
  if (data.promptFeedback && data.promptFeedback.blockReason) {
    throw new Error('Permintaan DIBLOKIR safety filter Gemini: ' + data.promptFeedback.blockReason +
      '. Coba foto lain atau revisi prompt (hindari kata yang sensitif).');
  }
  var cand = data.candidates && data.candidates[0];
  if (!cand) {
    throw new Error('Gemini tidak mengembalikan candidate. Respons: ' + JSON.stringify(data).slice(0, 300));
  }
  if (cand.finishReason && cand.finishReason !== 'STOP' && !out.imageDataUrl) {
    out.blockReason = cand.finishReason;
  }
  var candParts = cand.content && cand.content.parts || [];
  // REST Gemini mengembalikan camelCase (inlineData/mimeType); fallback snake_case utk aman
  candParts.forEach(function (p) {
    if (p.text) out.text += (out.text ? '\n' : '') + p.text;
    var img = p.inlineData || p.inline_data;
    if (img && img.data) {
      out.imageDataUrl = 'data:' + (img.mimeType || img.mime_type || 'image/png') + ';base64,' + img.data;
    }
  });
  return out;
}

/* ---------------- Adapter: fal.ai ---------------- */
async function falGenerate(opts) {
  var activeKey = opts.apiKey || getFalApiKey();
  var activeModel = opts.model || getFalModel();
  if (!activeKey) throw new Error('API Key fal.ai belum dikonfigurasi di Admin Panel!');

  var body = { prompt: opts.prompt };
  // Resolusi output (1K/2K/4K) untuk model fal yang mendukung
  if (opts.imageSize && opts.imageSize !== '1K') body.image_size = opts.imageSize;
  if (opts.imageBase64List && opts.imageBase64List.length) {
    // fal.ai menerima gambar sebagai data URI
    body.image_urls = opts.imageBase64List.map(function (b64) {
      return 'data:image/jpeg;base64,' + b64;
    });
    if (opts.imageBase64List.length === 1) body.image_url = body.image_urls[0];
  }

  var response = await fetch(FAL_API_URL + '/' + activeModel, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Key ' + activeKey
    },
    body: JSON.stringify(body)
  });

  var data = await response.json();
  if (data.error || data.detail) {
    var msg = (typeof data.detail === 'string') ? data.detail
      : (data.error && (data.error.message || JSON.stringify(data.error))) || 'Gagal memanggil fal.ai';
    throw new Error(msg);
  }

  var out = { text: '', imageDataUrl: null };
  if (data.images && data.images[0] && data.images[0].url) out.imageDataUrl = data.images[0].url;
  else if (data.image && data.image.url) out.imageDataUrl = data.image.url;
  else if (typeof data.output === 'string') out.imageDataUrl = data.output;
  return out;
}

/**
 * API utama: generate foto bergaya memakai engine AKTIF dari Admin.
 * opts = { imageSources: [dataURL/URL, ...], prompt: string, model?: string }
 * Return: { imageDataUrl: string|null, text: string }
 */
async function generateStyledPhoto(opts) {
  opts = opts || {};
  // Terima dua format:
  //  1) images: [{ role: 'guest'|'outfit'|..., source: dataURL/URL }, ...]  ← baru (role-based)
  //  2) imageSources: [dataURL/URL, ...]                                     ← lama (kompatibilitas)
  var imgs = (opts.images || (opts.imageSources || []).map(function (s) { return { source: s }; }))
    .filter(function (im) { return im && im.source; });

  // Backward-compat: gambar tanpa role → pertama = guest, sisanya = outfit
  imgs.forEach(function (im, i) { if (!im.role) im.role = (i === 0) ? 'guest' : 'outfit'; });

  // URUTAN KANONIK: guest selalu gambar #1, outfit #2 — apa pun urutan upload di UI.
  var order = { guest: 0, face: 1, outfit: 2 };
  imgs.sort(function (a, b) {
    return (order[a.role] !== undefined ? order[a.role] : 9) - (order[b.role] !== undefined ? order[b.role] : 9);
  });

  var b64List = [];
  for (var i = 0; i < imgs.length; i++) {
    b64List.push(await imageUrlToBase64(imgs[i].source));
  }
  for (var d = 0; d < b64List.length; d++) {
    if (b64List[d].length < 200) {
      throw new Error('Foto referensi #' + (d + 1) + ' gagal dimuat (CORS / URL salah). Upload foto itu secara manual lewat slot.');
    }
  }

  // Penjelas peran MINIMAL & netral — identitas diserahkan penuh ke prompt admin
  // (instruksi identitas ganda/larangan justru terbukti menurunkan kemiripan wajah).
  var prompt = opts.prompt || '';
  if (imgs.length >= 2) {
    prompt = "Image 1 = the guest's photo. Image 2 = the reference image whose composition, outfit, background and typography must be replicated. " + prompt;
  }

  var engine = getAiEngine();
  var result = (engine === 'fal')
    ? await falGenerate({ prompt: prompt, imageBase64List: b64List, model: opts.model, imageSize: opts.quality })
    : await geminiGenerate({ prompt: prompt, imageBase64List: b64List, model: opts.model, aspectRatio: opts.aspectRatio, imageSize: opts.quality });

  // Kompres hasil agar aman disimpan di localStorage.
  // Cap mengikuti kualitas terpilih — hanya menurunkan, tidak pernah menaikkan.
  if (result.imageDataUrl) {
    var cap = opts.quality === '4K' ? 4096 : (opts.quality === '2K' ? 2048 : 1280);
    result.imageDataUrl = await downscaleDataUrl(result.imageDataUrl, cap, 0.9);
  }
  return result;
}

/**
 * Ambil daftar model gambar langsung dari API Google (pakai key user).
 * Return: [{ id, label }, ...]
 */
async function listGeminiModels(apiKey) {
  var key = apiKey || getApiKey();
  if (!key) throw new Error('Isi API Key dulu, lalu muat daftar model.');
  var res = await fetch(GEMINI_API_URL + '?key=' + encodeURIComponent(key) + '&pageSize=200');
  if (!res.ok) {
    var e = await res.json().catch(function () { return {}; });
    throw new Error((e.error && e.error.message) || ('Gagal memuat daftar model (HTTP ' + res.status + ')'));
  }
  var data = await res.json();
  return (data.models || [])
    .filter(function (m) {
      var n = (m.name || '').toLowerCase();
      var methods = (m.supportedGenerationMethods || []).join(' ');
      return (n.indexOf('image') !== -1 || n.indexOf('nano') !== -1) &&
             (methods === '' || methods.indexOf('generateContent') !== -1);
    })
    .map(function (m) { var id = m.name.replace(/^models\//, ''); return { id: id, label: id + (m.displayName ? ' — ' + m.displayName : '') }; });
}

/**
 * Teks-only: minta Gemini menganalisis foto & membuat prompt diffusion
 * (dipertahankan untuk kompatibilitas pemanggilan lama).
 */
async function generateAIPrompt(imageInput, stylePrompt, apiKey) {
  var b64 = await imageUrlToBase64(imageInput);
  var result = await geminiGenerate({
    prompt: 'Analyze this photo and merge it with the style concept: "' + stylePrompt + '". Output a highly detailed diffusion prompt for image generation.',
    imageBase64List: [b64],
    apiKey: apiKey,
    model: 'gemini-3.1-flash-image'
  });
  return result.text;
}

/** true bila engine aktif sudah punya API key tersimpan */
function isAiConfigured() {
  return (getAiEngine() === 'fal') ? !!getFalApiKey() : !!getApiKey();
}

window.GeminiAPI = {
  generateStyledPhoto: generateStyledPhoto,
  listGeminiModels: listGeminiModels,
  generateAIPrompt: generateAIPrompt,
  imageUrlToBase64: imageUrlToBase64,
  downscaleDataUrl: downscaleDataUrl,
  isConfigured: isAiConfigured
};
