import "../styles/styles.css";
import App from "./pages/app.js";

// Registrasi Service Worker dijalankan SEGERA & independen — tidak menunggu
// pemuatan model (yang lama), dan tidak bergantung pada event window "load".
function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  navigator.serviceWorker
    .register("/sw.js")
    .then((registration) =>
      console.info("✅ Service Worker terdaftar:", registration.scope),
    )
    .catch((error) =>
      console.warn(
        "Service Worker belum tersedia (normal di mode dev):",
        error.message,
      ),
    );
}

document.addEventListener("DOMContentLoaded", async () => {
  registerServiceWorker();

  const app = new App({
    container: document.querySelector("#main-content"),
  });

  await app.renderPage();

  if (typeof lucide !== "undefined") {
    lucide.createIcons();
  }
});