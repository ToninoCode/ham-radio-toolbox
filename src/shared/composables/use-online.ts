import { onScopeDispose, readonly, ref, type Ref } from "vue";

/**
 * Network status from `navigator.onLine` and the `online`/`offline` events
 * (FR-DSH-04).
 *
 * TODO(M5): also take into account the outcome of the latest provider
 * requests (ARCHITECTURE.md § 8), once the first native provider exists.
 */
export function useOnline(): Readonly<Ref<boolean>> {
  const online = ref(navigator.onLine);

  const update = () => {
    online.value = navigator.onLine;
  };

  window.addEventListener("online", update);
  window.addEventListener("offline", update);

  onScopeDispose(() => {
    window.removeEventListener("online", update);
    window.removeEventListener("offline", update);
  });

  return readonly(online);
}
