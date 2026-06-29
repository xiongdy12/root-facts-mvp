import "../styles/styles.css";
import App from "./pages/app.js";

document.addEventListener("DOMContentLoaded", async () => {
  const app = new App({
    container: document.querySelector("#main-content"),
  });

  await app.renderPage();

  if (typeof lucide !== "undefined") {
    lucide.createIcons();
  }

  // Registrasi Service Worker (dihasilkan Workbox saat build production).
  // Di mode dev (webpack-dev-server) berkas sw.js tidak ada, jadi dilewati.
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", async () => {
      try {
        const registration =
          await navigator.serviceWorker.register("/sw.js");
        console.info("✅ Service Worker terdaftar:", registration.scope);
      } catch (error) {
        console.warn("Service Worker belum tersedia (mode dev):", error.message);
      }
    });
  }
});
