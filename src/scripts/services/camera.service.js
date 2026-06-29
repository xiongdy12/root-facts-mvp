import { CAMERA_CONFIG } from "../config.js";
import { logError } from "../utils/index.js";

/**
 * CameraService
 * Bertanggung jawab penuh atas siklus hidup kamera (getUserMedia):
 * memilih perangkat, memulai/menghentikan stream, mengatur FPS, dan
 * menyediakan elemen video sebagai sumber frame untuk model.
 */
class CameraService {
  constructor() {
    this.stream = null;
    this.video = null;
    this.canvas = null;
    this.config = { ...CAMERA_CONFIG };
    this.currentFps = CAMERA_CONFIG.defaultFps;
    this.devices = [];
  }

  // [Basic] Inisiasi elemen video dan canvas dari DOM.
  initializeElements(videoId, canvasId) {
    this.video = document.getElementById(videoId);
    this.canvas = document.getElementById(canvasId);
  }

  // [Basic] Dapatkan daftar perangkat input video (kamera) yang tersedia.
  async loadCameras(cameraSelect) {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.devices = devices.filter((d) => d.kind === "videoinput");

      // Jika elemen <select> dilewatkan, isi opsinya secara dinamis.
      if (cameraSelect && this.devices.length > 0) {
        cameraSelect.innerHTML = "";
        this.devices.forEach((device, index) => {
          const option = document.createElement("option");
          option.value = device.deviceId;
          option.textContent = device.label || `Kamera ${index + 1}`;
          cameraSelect.appendChild(option);
        });
      }
      return this.devices;
    } catch (error) {
      logError("loadCameras", error);
      return [];
    }
  }

  // Membangun constraints getUserMedia berdasarkan pilihan pengguna.
  #buildConstraints(selectedValue) {
    const { idealWidth, idealHeight, defaultFacingMode, frontFacingMode } =
      this.config;

    const videoConstraints = {
      width: { ideal: idealWidth },
      height: { ideal: idealHeight },
      frameRate: { ideal: this.currentFps, max: this.currentFps },
    };

    if (selectedValue === "front") {
      videoConstraints.facingMode = frontFacingMode;
    } else if (selectedValue === "default" || !selectedValue) {
      videoConstraints.facingMode = defaultFacingMode;
    } else {
      // Anggap nilai adalah deviceId konkret hasil enumerateDevices().
      videoConstraints.deviceId = { exact: selectedValue };
    }

    return { video: videoConstraints, audio: false };
  }

  // [Basic] Memulai kamera & menampilkan stream pada elemen <video>.
  async startCamera(videoId, canvasId, cameraSelect) {
    this.initializeElements(videoId, canvasId);

    // Hentikan stream lama bila ada (mis. ganti kamera).
    this.stopCamera();

    const selectedValue = cameraSelect?.value;
    const constraints = this.#buildConstraints(selectedValue);

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      // Fallback: longgarkan constraint bila gagal (mis. deviceId tak cocok).
      logError("startCamera (strict constraints)", error);
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
    }

    this.video.srcObject = this.stream;

    // Tunggu metadata agar dimensi video tersedia sebelum diproses.
    await new Promise((resolve) => {
      this.video.onloadedmetadata = () => {
        this.video.play();
        if (this.canvas) {
          this.canvas.width = this.video.videoWidth;
          this.canvas.height = this.video.videoHeight;
        }
        resolve();
      };
    });

    return this.stream;
  }

  // [Basic] Menghentikan siaran kamera & membersihkan sumber daya.
  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
    }
  }

  // [Skilled] Mengatur FPS kamera. Diterapkan ke track aktif via
  // applyConstraints sehingga bisa diubah real-time dari UI.
  async setFPS(fps) {
    this.currentFps = fps;
    if (!this.stream) return;

    const [videoTrack] = this.stream.getVideoTracks();
    if (videoTrack && videoTrack.applyConstraints) {
      try {
        await videoTrack.applyConstraints({
          frameRate: { ideal: fps, max: fps },
        });
      } catch (error) {
        logError("setFPS", error);
      }
    }
  }

  // [Basic] Periksa apakah kamera sedang aktif.
  isActive() {
    return (
      this.stream !== null &&
      this.stream.getVideoTracks().some((track) => track.readyState === "live")
    );
  }

  // Mengembalikan elemen video sebagai sumber frame untuk model.
  getVideoElement() {
    return this.video;
  }
}

export default CameraService;
