import {
  generateCameraSection,
  generateInfoPanel,
  generateFooter,
} from "../../templates.js";
import HomePresenter from "./home-presenter.js";
import CameraService from "../../services/camera.service.js";
import DetectionService from "../../services/detection.service.js";
import RootFactsService from "../../services/rootfacts.service.js";
import {
  hideElement,
  showElement,
  setElementText,
} from "../../utils/index.js";

/**
 * HomePage = VIEW (dalam pola MVP).
 * Tugasnya HANYA menyentuh DOM: render markup, cache elemen, mengikat event
 * ke handler presenter, dan menampilkan data. View tidak tahu logika AI —
 * semua keputusan ada di Presenter.
 */
export default class HomePage {
  #presenter = null;
  #elements = {};

  async render() {
    return `
      <main class="main-content">
        ${generateCameraSection()}
        ${generateInfoPanel()}
      </main>
      ${generateFooter()}
    `;
  }

  async afterRender() {
    this.#cacheElements();

    // Inisialisasi Presenter dengan menyuntikkan View + ketiga Service.
    this.#presenter = new HomePresenter({
      view: this,
      cameraService: new CameraService(),
      detectionService: new DetectionService(),
      rootFactsService: new RootFactsService(),
    });

    await this.#presenter.init();
  }

  #cacheElements() {
    const $ = (id) => document.getElementById(id);
    this.#elements = {
      video: $("media-video"),
      canvas: $("media-canvas"),
      placeholder: $("camera-placeholder"),
      btnToggle: $("btn-toggle"),
      cameraSelect: $("camera-select"),
      fpsSlider: $("fps-slider"),
      fpsLabel: $("fps-label"),
      toneSelect: $("tone-select"),
      statusDot: $("status-dot"),
      statusText: $("status-text"),
      stateIdle: $("state-idle"),
      stateLoading: $("state-loading"),
      stateResult: $("state-result"),
      detectedName: $("detected-name"),
      confidenceFill: $("confidence-fill"),
      detectedConfidence: $("detected-confidence"),
      funFactLoading: $("fun-fact-loading"),
      funFactContent: $("fun-fact-content"),
      funFactText: $("fun-fact-text"),
      btnCopy: $("btn-copy"),
    };
  }

  // ---- Event binding (View -> Presenter) ----------------------------
  bindToggleCamera(handler) {
    this.#elements.btnToggle.addEventListener("click", handler);
  }
  bindFpsChange(handler) {
    this.#elements.fpsSlider.addEventListener("input", (e) =>
      handler(parseInt(e.target.value, 10)),
    );
  }
  bindCameraChange(handler) {
    this.#elements.cameraSelect.addEventListener("change", (e) =>
      handler(e.target.value),
    );
  }
  bindToneChange(handler) {
    this.#elements.toneSelect.addEventListener("change", (e) =>
      handler(e.target.value),
    );
  }
  bindCopy(handler) {
    this.#elements.btnCopy.addEventListener("click", handler);
  }

  // ---- Getter -------------------------------------------------------
  getVideoElement() {
    return this.#elements.video;
  }
  getCameraSelect() {
    return this.#elements.cameraSelect;
  }
  getSelectedTone() {
    return this.#elements.toneSelect.value;
  }
  getSelectedFps() {
    return parseInt(this.#elements.fpsSlider.value, 10);
  }

  // ---- Status header ------------------------------------------------
  setHeaderStatus(text, active = false) {
    setElementText(this.#elements.statusText, text);
    this.#elements.statusDot.classList.toggle("active", active);
  }

  // ---- Status kamera ------------------------------------------------
  showCameraActive() {
    hideElement(this.#elements.placeholder);
    this.#elements.btnToggle.classList.add("scanning");
  }
  showCameraInactive() {
    showElement(this.#elements.placeholder);
    this.#elements.btnToggle.classList.remove("scanning");
  }

  // ---- Panel hasil (3 state) ----------------------------------------
  showIdle() {
    showElement(this.#elements.stateIdle);
    hideElement(this.#elements.stateLoading);
    hideElement(this.#elements.stateResult);
  }
  showSearching() {
    hideElement(this.#elements.stateIdle);
    showElement(this.#elements.stateLoading);
    hideElement(this.#elements.stateResult);
  }
  showResult({ label, confidence }) {
    hideElement(this.#elements.stateIdle);
    hideElement(this.#elements.stateLoading);
    showElement(this.#elements.stateResult);

    setElementText(this.#elements.detectedName, label);
    const pct = Math.round(confidence);
    setElementText(this.#elements.detectedConfidence, `${pct}%`);
    this.#elements.confidenceFill.style.width = `${pct}%`;
  }

  // ---- Fun fact -----------------------------------------------------
  setFunFactLoading(isLoading) {
    if (isLoading) {
      showElement(this.#elements.funFactLoading);
      hideElement(this.#elements.funFactContent);
    } else {
      hideElement(this.#elements.funFactLoading);
      showElement(this.#elements.funFactContent);
    }
  }
  setFunFact(text) {
    setElementText(this.#elements.funFactText, text);
  }

  // ---- Feedback tombol salin ----------------------------------------
  setCopied(isCopied) {
    this.#elements.btnCopy.classList.toggle("copied", isCopied);
  }

  // ---- Label FPS ----------------------------------------------------
  setFpsLabel(fps) {
    setElementText(this.#elements.fpsLabel, `${fps} FPS`);
  }

  refreshIcons() {
    if (typeof window !== "undefined" && window.lucide) {
      window.lucide.createIcons();
    }
  }
}
