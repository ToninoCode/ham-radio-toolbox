import {
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
  type Router,
  type RouterHistory,
} from "vue-router";
import { t, type PlainMessageKey } from "@/shared/i18n";
import type { ModuleCatalog, ModuleId } from "@/shared/modules";

declare module "vue-router" {
  interface RouteMeta {
    moduleId?: ModuleId;
    titleKey?: PlainMessageKey;
  }
}

const UnderDevelopmentView = () => import("./views/UnderDevelopmentView.vue");
const NotFoundView = () => import("./views/NotFoundView.vue");

export const NOT_FOUND_ROUTE = "not-found";

export function buildRoutes(catalog: ModuleCatalog): RouteRecordRaw[] {
  const moduleRoutes = catalog.all.map((manifest): RouteRecordRaw => ({
    path: manifest.path,
    name: manifest.id,
    component:
      manifest.availability.status === "available" && manifest.view
        ? manifest.view
        : UnderDevelopmentView,
    meta: { moduleId: manifest.id, titleKey: manifest.titleKey },
  }));

  return [
    ...moduleRoutes,
    {
      path: "/:pathMatch(.*)*",
      name: NOT_FOUND_ROUTE,
      component: NotFoundView,
      meta: { titleKey: "notFound.title" },
    },
  ];
}

/**
 * History mode with base `/` (ADR-0011): deep links are served by the
 * Cloudflare Pages SPA fallback online and by the service worker offline.
 */
export function createAppRouter(
  catalog: ModuleCatalog,
  history: RouterHistory = createWebHistory(import.meta.env.BASE_URL),
): Router {
  const router = createRouter({
    history,
    routes: buildRoutes(catalog),
    scrollBehavior: (_to, _from, saved) => saved ?? { top: 0 },
  });

  router.afterEach((to, _from, failure) => {
    if (failure) return;
    const page = to.meta.titleKey ? t(to.meta.titleKey) : t("app.name");
    document.title =
      to.meta.moduleId === catalog.home.id
        ? t("app.name")
        : t("app.documentTitle", { page });
  });

  return router;
}
