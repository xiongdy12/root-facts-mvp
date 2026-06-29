import { pipeline, env } from "@huggingface/transformers";
import { AI_CONFIG, TONE_CONFIG } from "../config.js";
import { logError, isWebGPUSupported } from "../utils/index.js";

// Ambil model dari Hugging Face Hub (bukan dari folder lokal).
env.allowLocalModels = false;

/**
 * RootFactsService
 * Membungkus "Si Otak": memuat pipeline text2text-generation Transformers.js
 * lalu mengubah label sayuran menjadi fun fact sesuai persona/tone terpilih.
 */
class RootFactsService {
  constructor() {
    this.generator = null;
    this.isModelLoaded = false;
    this.isGenerating = false;
    this.config = { ...AI_CONFIG };
    this.currentBackend = null;
    this.currentTone = "normal";
  }

  /**
   * [Basic] Muat model & inisialisasi pipeline text2text-generation.
   * [Advance] Backend adaptif: WebGPU bila tersedia, jika tidak WASM.
   * @param {(percent:number, label:string)=>void} onProgress
   */
  async loadModel(onProgress = () => {}) {
    const { task, modelId, dtype } = this.config;

    // Backend adaptif untuk Transformers.js (onnxruntime-web).
    this.currentBackend = isWebGPUSupported() ? "webgpu" : "wasm";

    try {
      this.generator = await pipeline(task, modelId, {
        dtype,
        device: this.currentBackend,
        progress_callback: (data) => {
          if (data.status === "progress" && data.total) {
            const percent = Math.round((data.loaded / data.total) * 100);
            onProgress(percent, data.file || "model");
          }
        },
      });
    } catch (error) {
      // Fallback aman ke WASM bila WebGPU bermasalah di perangkat tertentu.
      logError("Pipeline WebGPU gagal, fallback ke WASM", error);
      this.currentBackend = "wasm";
      this.generator = await pipeline(task, modelId, {
        dtype,
        device: "wasm",
        progress_callback: (data) => {
          if (data.status === "progress" && data.total) {
            onProgress(Math.round((data.loaded / data.total) * 100), data.file);
          }
        },
      });
    }

    this.isModelLoaded = true;
    return { backend: this.currentBackend };
  }

  // [Advance] Mengatur tone/persona fakta yang dihasilkan.
  setTone(tone) {
    if (TONE_CONFIG[tone]) {
      this.currentTone = tone;
    }
  }

  /**
   * Membersihkan input dari karakter khusus & membatasi panjangnya
   * untuk mencegah prompt injection. Label sayuran hanya berupa huruf.
   */
  #sanitizeInput(raw) {
    return String(raw ?? "")
      .replace(/[^a-zA-Z\s]/g, "")
      .trim()
      .slice(0, this.config.maxInputLength);
  }

  // Menyusun prompt berbahasa Inggris sesuai instruksi persona.
  #buildPrompt(vegetable, tone) {
    const persona = TONE_CONFIG[tone] ?? TONE_CONFIG.normal;
    return `${persona.instruction}\nVegetable: ${vegetable}\nFun fact:`;
  }

  /**
   * [Basic] Hasilkan fun fact dari label sayuran.
   * [Skilled] Memakai parameter generasi (temperature, top_p, dst).
   * [Advance] Menerapkan tone untuk mengatur nada fakta.
   */
  async generateFacts(vegetable, tone = this.currentTone) {
    if (!this.isReady()) {
      throw new Error("Model belum siap digunakan.");
    }
    if (this.isGenerating) {
      return null; // cegah generasi paralel yang membebani browser.
    }

    const safeVegetable = this.#sanitizeInput(vegetable);
    if (!safeVegetable) {
      return "Maaf, label sayuran tidak valid untuk diproses.";
    }

    this.isGenerating = true;
    try {
      const prompt = this.#buildPrompt(safeVegetable, tone);
      const output = await this.generator(prompt, this.config.generation);

      // text2text-generation -> [{ generated_text: "..." }]
      const text = Array.isArray(output)
        ? output[0]?.generated_text
        : output?.generated_text;

      return (text || "").trim() || "Tidak ada fakta yang dihasilkan.";
    } finally {
      this.isGenerating = false;
    }
  }

  // [Basic] Periksa apakah model sudah dimuat & siap.
  isReady() {
    return this.isModelLoaded && this.generator !== null;
  }

  getBackend() {
    return this.currentBackend;
  }
}

export default RootFactsService;
