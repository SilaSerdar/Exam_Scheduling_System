import { createApp } from "vue";
import PrimeVue from "primevue/config";
import Aura from "@primevue/themes/aura";
import ToastService from "primevue/toastservice";

import "primeicons/primeicons.css";
import "primeflex/primeflex.css";
import "./style.css";

import App from "./App.vue";
import { router } from "./router";

const app = createApp(App);

app.use(router);
app.use(PrimeVue, {
  theme: {
    preset: Aura,
    // Only enable dark mode when a class is explicitly applied.
    // This avoids "mixed theme" when OS/browser prefers dark.
    options: {
      darkModeSelector: ".p-dark",
    },
  },
  ripple: true,
});
app.use(ToastService);

app.mount("#app");
