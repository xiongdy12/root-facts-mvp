// =====================================================================
//  KONFIGURASI TERPUSAT APLIKASI ROOTFACTS
//  Semua "angka ajaib" & path penting dikumpulkan di sini agar mudah
//  dirawat dan tidak tersebar (single source of truth).
// =====================================================================

const APP_CONFIG = {
  // Ambang batas keyakinan minimum (%) agar sebuah deteksi dianggap valid.
  detectionConfidenceThreshold: 70,
  // Jeda animasi/analisa (ms).
  analyzingDelay: 2000,
  factsGenerationDelay: 2000,
  // Interval percobaan deteksi ketika model belum siap (ms).
  detectionRetryInterval: 100,
};

// --- Konfigurasi Model Computer Vision (TensorFlow.js) ---------------
const MODEL_CONFIG = {
  // Path relatif terhadap root deploy (disalin oleh CopyWebpackPlugin).
  modelUrl: "model/model.json",
  metadataUrl: "model/metadata.json",
  // Ukuran input model Teachable Machine (224x224x3).
  imageSize: 224,
  // Teachable Machine menormalisasi piksel ke rentang [-1, 1] (x/127.5 - 1).
  normalizeOffset: 127.5,
};

// --- Konfigurasi Kamera ---------------------------------------------
const CAMERA_CONFIG = {
  defaultFacingMode: "environment", // kamera belakang
  frontFacingMode: "user", // kamera depan
  defaultFps: 30,
  minFps: 15,
  maxFps: 60,
  idealWidth: 1280,
  idealHeight: 720,
};

// --- Konfigurasi Generative AI (Transformers.js) --------------------
const AI_CONFIG = {
  // Model text2text-generation yang ringan & instruction-tuned.
  // q4 = kuantisasi 4-bit agar ukuran unduh jauh lebih kecil.
  // Alternatif lebih ringan: "Xenova/LaMini-Flan-T5-248M".
  modelId: "Xenova/LaMini-Flan-T5-783M",
  task: "text2text-generation",
  dtype: "q4",
  // Parameter generasi — dibatasi agar browser tidak "freeze".
  generation: {
    max_new_tokens: 150,
    temperature: 0.7,
    top_p: 0.9,
    do_sample: true,
    repetition_penalty: 1.3,
  },
  // Batas keamanan input untuk mencegah prompt injection.
  maxInputLength: 40,
};

// --- Definisi Persona / Tone (Advanced) -----------------------------
// Setiap tone mengubah instruksi sistem yang dikirim ke model bahasa.
const TONE_CONFIG = {
  normal: {
    label: "Normal",
    instruction:
      "Write one short, accurate, and interesting fun fact about the vegetable below.",
  },
  funny: {
    label: "Lucu",
    instruction:
      "Write one short, humorous, and playful fun fact about the vegetable below. Make the reader smile.",
  },
  professional: {
    label: "Profesional",
    instruction:
      "Write one short, scientific, and educational fact about the vegetable below, focusing on nutrition or biology.",
  },
  casual: {
    label: "Santai",
    instruction:
      "Write one short, casual, and friendly fun fact about the vegetable below, as if chatting with a friend.",
  },
};

const UI_CONFIG = {
  animationDuration: 300,
  fadeAnimation: "fadeIn 0.5s ease-out forwards",
  confidenceThresholds: {
    excellent: 90,
    good: 80,
  },
  factsCardOpacity: {
    loading: 0.6,
    normal: 1.0,
  },
};

export {
  APP_CONFIG,
  MODEL_CONFIG,
  CAMERA_CONFIG,
  AI_CONFIG,
  TONE_CONFIG,
  UI_CONFIG,
};
