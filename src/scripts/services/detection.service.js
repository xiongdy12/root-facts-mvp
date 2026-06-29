import { MODEL_CONFIG, APP_CONFIG } from "../config.js";
import { logError, isWebGPUSupported } from "../utils/index.js";

// TensorFlow.js dimuat dari CDN sebagai global `window.tf` (lihat index.html).
// Cara ini menghindari error registrasi flag saat tfjs di-bundle webpack.
const tf = window.tf;

/**
 * DetectionService
 * Membungkus seluruh logika "Si Mata":
 *  - Memuat model Teachable Machine (TensorFlow.js Layers) + metadata.
 *  - Memilih backend secara adaptif (WebGPU -> fallback WebGL).
 *  - Melakukan inferensi pada frame video dengan manajemen memori ketat.
 */
class DetectionService {
  constructor() {
    this.model = null;
    this.labels = [];
    this.config = { ...MODEL_CONFIG };
    this.backend = null;
    this.performanceStats = {
      operations: 0,
      totalTime: 0,
      averageTime: 0,
    };
  }

  /**
   * [Advance] Menentukan & mengaktifkan backend TensorFlow.js terbaik.
   * Mengecek navigator.gpu; jika ada, coba WebGPU, jika gagal jatuh ke WebGL.
   */
  async #setupBackend() {
    if (isWebGPUSupported()) {
      try {
        // Backend WebGPU sudah diregistrasikan oleh script CDN di index.html,
        // jadi cukup aktifkan. (Mengatasi error "Backend 'webgpu' not found".)
        await tf.setBackend("webgpu");
        await tf.ready();
        this.backend = "webgpu";
        return;
      } catch (error) {
        logError("WebGPU setup gagal, fallback ke WebGL", error);
      }
    }
    await tf.setBackend("webgl");
    await tf.ready();
    this.backend = tf.getBackend();
  }

  /**
   * [Basic] Muat model & metadata secara bersamaan, lalu simpan ke instance.
   * @param {(fraction:number)=>void} onProgress callback 0..1 untuk UI loading.
   */
  async loadModel(onProgress = () => {}) {
    if (!tf) {
      throw new Error(
        "TensorFlow.js tidak termuat. Pastikan koneksi internet aktif saat pertama kali membuka aplikasi (script CDN tf.min.js).",
      );
    }
    await this.#setupBackend();

    const { modelUrl, metadataUrl } = this.config;

    // Muat metadata (label) & bobot model secara paralel.
    const [metadata, model] = await Promise.all([
      fetch(metadataUrl).then((res) => res.json()),
      tf.loadLayersModel(modelUrl, {
        onProgress: (fraction) => onProgress(fraction),
      }),
    ]);

    this.labels = metadata.labels || [];
    this.model = model;

    // Warm-up: jalankan 1 prediksi dummy agar inferensi pertama tidak lambat.
    tf.tidy(() => {
      const dummy = tf.zeros([
        1,
        this.config.imageSize,
        this.config.imageSize,
        3,
      ]);
      const warm = this.model.predict(dummy);
      warm.dataSync();
    });

    return { labels: this.labels, backend: this.backend };
  }

  // Memotong tensor gambar menjadi persegi di bagian tengah (center-crop)
  // agar rasio sesuai input model 224x224 — meniru perilaku Teachable Machine.
  #cropToSquare(imageTensor) {
    const [height, width] = imageTensor.shape;
    const size = Math.min(height, width);
    const startH = Math.floor((height - size) / 2);
    const startW = Math.floor((width - size) / 2);
    return imageTensor.slice([startH, startW, 0], [size, size, 3]);
  }

  /**
   * [Basic] Lakukan prediksi pada elemen gambar/video & kembalikan hasil.
   * Manajemen memori: semua tensor antara dibungkus tf.tidy(), tensor hasil
   * di-dispose() manual setelah datanya diambil.
   */
  async predict(imageElement) {
    if (!this.model) {
      return { isValid: false, label: null, confidence: 0 };
    }

    const start = performance.now();
    const { imageSize, normalizeOffset } = this.config;

    // tf.tidy membersihkan SEMUA tensor antara secara otomatis.
    const logits = tf.tidy(() => {
      const pixels = tf.browser.fromPixels(imageElement);
      const cropped = this.#cropToSquare(pixels);
      const resized = tf.image.resizeBilinear(cropped, [imageSize, imageSize]);
      // Normalisasi Teachable Machine: [0,255] -> [-1,1].
      const normalized = resized.toFloat().div(normalizeOffset).sub(1);
      const batched = normalized.expandDims(0);
      return this.model.predict(batched);
    });

    const probabilities = await logits.data();
    logits.dispose(); // wajib: bebaskan memori GPU/CPU tiap siklus.

    // Cari label dengan probabilitas tertinggi (argmax manual).
    let maxIndex = 0;
    for (let i = 1; i < probabilities.length; i++) {
      if (probabilities[i] > probabilities[maxIndex]) maxIndex = i;
    }

    const confidence = probabilities[maxIndex] * 100;
    const label = this.labels[maxIndex] ?? "Unknown";

    this.#updateStats(performance.now() - start);

    return {
      isValid: confidence >= APP_CONFIG.detectionConfidenceThreshold,
      label,
      confidence,
      backend: this.backend,
    };
  }

  #updateStats(elapsed) {
    const stats = this.performanceStats;
    stats.operations += 1;
    stats.totalTime += elapsed;
    stats.averageTime = stats.totalTime / stats.operations;
  }

  getBackend() {
    return this.backend;
  }

  isReady() {
    return this.model !== null;
  }
}

export default DetectionService;
