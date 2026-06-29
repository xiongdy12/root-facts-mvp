import { CAMERA_CONFIG } from "../../config.js";
import { isValidDetection, logError } from "../../utils/index.js";

/**
 * HomePresenter = PRESENTER (dalam pola MVP).
 * Menjembatani View <-> Service. Semua keputusan logika ada di sini:
 *  - memuat kedua model (CV + GenAI) dengan progress,
 *  - mengontrol siklus kamera & loop deteksi (dengan FPS limit),
 *  - memicu generasi fun fact saat sayuran baru terdeteksi,
 *  - menangani salin-ke-clipboard, ganti kamera, FPS, & persona.
 */
export default class HomePresenter {
  #view;
  #camera;
  #detection;
  #rootFacts;

  // State loop
  #isRunning = false;
  #isPredicting = false;
  #isBusyGenerating = false;
  #rafId = null;
  #lastFrameTime = 0;
  #currentFps = CAMERA_CONFIG.defaultFps;
  #lastLabel = null;
  #currentFact = "";

  constructor({ view, cameraService, detectionService, rootFactsService }) {
    this.#view = view;
    this.#camera = cameraService;
    this.#detection = detectionService;
    this.#rootFacts = rootFactsService;
  }

  async init() {
    this.#bindEvents();
    this.#view.showIdle();
    this.#view.setHeaderStatus("Memuat...", false);
    await this.#loadModels();
  }

  #bindEvents() {
    this.#view.bindToggleCamera(() => this.#handleToggle());
    this.#view.bindFpsChange((fps) => this.#handleFpsChange(fps));
    this.#view.bindCameraChange((value) => this.#handleCameraChange(value));
    this.#view.bindToneChange((tone) => this.#handleToneChange(tone));
    this.#view.bindCopy(() => this.#handleCopy());
  }

  // ---- Pemuatan model dengan indikator persentase -------------------
  async #loadModels() {
    try {
      // 1) Model Computer Vision (TensorFlow.js)
      this.#view.setHeaderStatus("Menunggu Model... 0%", false);
      const { backend } = await this.#detection.loadModel((fraction) => {
        const pct = Math.round(fraction * 100);
        this.#view.setHeaderStatus(`Menunggu Model... ${pct}%`, false);
      });
      console.info(`✅ Model CV siap (backend: ${backend})`);

      // 2) Model Generative AI (Transformers.js) — diunduh sekali, lalu cache.
      this.#view.setHeaderStatus("Menyiapkan AI... 0%", false);
      await this.#rootFacts.loadModel((percent) => {
        this.#view.setHeaderStatus(`Menyiapkan AI... ${percent}%`, false);
      });

      this.#view.setHeaderStatus("Siap", false);
    } catch (error) {
      logError("loadModels", error);
      this.#view.setHeaderStatus("Gagal memuat model", false);
    }
  }

  // ---- Toggle mulai/berhenti kamera ---------------------------------
  async #handleToggle() {
    if (this.#isRunning) {
      this.#stop();
    } else {
      await this.#start();
    }
  }

  async #start() {
    if (!this.#detection.isReady()) {
      this.#view.setHeaderStatus("Model belum siap", false);
      return;
    }
    try {
      await this.#camera.startCamera(
        "media-video",
        "media-canvas",
        this.#view.getCameraSelect(),
      );
      await this.#camera.setFPS(this.#currentFps);

      this.#isRunning = true;
      this.#lastLabel = null;
      this.#view.showCameraActive();
      this.#view.showSearching();
      this.#view.setHeaderStatus("Mendeteksi...", true);

      this.#lastFrameTime = 0;
      this.#rafId = requestAnimationFrame((t) => this.#loop(t));
    } catch (error) {
      logError("start camera", error);
      this.#view.setHeaderStatus("Kamera gagal", false);
    }
  }

  #stop() {
    this.#isRunning = false;
    if (this.#rafId) cancelAnimationFrame(this.#rafId);
    this.#rafId = null;
    this.#camera.stopCamera();
    this.#view.showCameraInactive();
    this.#view.showIdle();
    this.#view.setHeaderStatus("Siap", false);
  }

  // ---- Loop deteksi dengan pembatasan FPS ---------------------------
  #loop(timestamp) {
    if (!this.#isRunning) return;

    const interval = 1000 / this.#currentFps;
    if (timestamp - this.#lastFrameTime >= interval) {
      this.#lastFrameTime = timestamp;
      this.#processFrame(); // async, tapi dijaga reentrancy-nya
    }
    this.#rafId = requestAnimationFrame((t) => this.#loop(t));
  }

  async #processFrame() {
    if (this.#isPredicting || !this.#camera.isActive()) return;
    this.#isPredicting = true;

    try {
      const video = this.#view.getVideoElement();
      if (!video || video.readyState < 2) return;

      const result = await this.#detection.predict(video);

      if (isValidDetection(result)) {
        this.#view.showResult(result);

        // Hanya regenerasi fakta bila label BERUBAH & tidak sedang sibuk.
        if (result.label !== this.#lastLabel && !this.#isBusyGenerating) {
          this.#lastLabel = result.label;
          await this.#generateFact(result.label);
        }
      }
    } catch (error) {
      logError("processFrame", error);
    } finally {
      this.#isPredicting = false;
    }
  }

  // ---- Jembatan ke Generative AI ------------------------------------
  async #generateFact(label) {
    this.#isBusyGenerating = true;
    this.#view.setFunFactLoading(true);
    try {
      const tone = this.#view.getSelectedTone();
      const fact = await this.#rootFacts.generateFacts(label, tone);
      this.#currentFact = fact || "";
      this.#view.setFunFact(this.#currentFact);
    } catch (error) {
      logError("generateFact", error);
      this.#view.setFunFact("Gagal menghasilkan fakta. Coba lagi.");
    } finally {
      this.#view.setFunFactLoading(false);
      this.#isBusyGenerating = false;
    }
  }

  // ---- Handler pengaturan -------------------------------------------
  async #handleFpsChange(fps) {
    this.#currentFps = fps;
    this.#view.setFpsLabel(fps);
    await this.#camera.setFPS(fps);
  }

  async #handleCameraChange() {
    if (!this.#isRunning) return;
    // Mulai ulang kamera dengan perangkat baru.
    await this.#camera.startCamera(
      "media-video",
      "media-canvas",
      this.#view.getCameraSelect(),
    );
    await this.#camera.setFPS(this.#currentFps);
  }

  #handleToneChange(tone) {
    this.#rootFacts.setTone(tone);
    // Bila ada sayuran yang sedang ditampilkan, regenerasi dengan persona baru.
    if (this.#lastLabel && !this.#isBusyGenerating) {
      this.#generateFact(this.#lastLabel);
    }
  }

  async #handleCopy() {
    if (!this.#currentFact) return;
    try {
      await navigator.clipboard.writeText(this.#currentFact);
      this.#view.setCopied(true);
      setTimeout(() => this.#view.setCopied(false), 1500);
    } catch (error) {
      logError("copy", error);
    }
  }
}
