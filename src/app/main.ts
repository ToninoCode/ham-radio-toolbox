import "@/shared/ui/styles/main.css";
import { createPinia } from "pinia";
import { createApp } from "vue";
import { MODULE_CATALOG_KEY } from "@/shared/modules";
import App from "./App.vue";
import { APP_CONTAINER_KEY, createContainer } from "./container";
import { moduleCatalog } from "./modules";
import { createAppRouter } from "./router";
import { useThemeStore } from "./theme/theme-store";

const pinia = createPinia();
const router = createAppRouter(moduleCatalog);

const app = createApp(App);
app.use(pinia);
app.use(router);
app.provide(MODULE_CATALOG_KEY, moduleCatalog);
// The database opens lazily, on the first repository call (Dexie autoOpen).
app.provide(APP_CONTAINER_KEY, createContainer());

useThemeStore(pinia).start();

app.mount("#app");
