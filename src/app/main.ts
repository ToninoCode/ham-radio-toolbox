import "@/shared/ui/styles/main.css";
import { createPinia } from "pinia";
import { createApp } from "vue";
import { MODULE_CATALOG_KEY } from "@/shared/modules";
import App from "./App.vue";
import { moduleCatalog } from "./modules";
import { createAppRouter } from "./router";
import { useThemeStore } from "./theme/theme-store";

const pinia = createPinia();
const router = createAppRouter(moduleCatalog);

const app = createApp(App);
app.use(pinia);
app.use(router);
app.provide(MODULE_CATALOG_KEY, moduleCatalog);

useThemeStore(pinia).start();

app.mount("#app");
