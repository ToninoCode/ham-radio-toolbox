import { onScopeDispose, readonly, shallowRef, type ShallowRef } from "vue";

/**
 * Current time, refreshed on every second boundary. The `Date` is an absolute
 * instant: format it with the UTC formatters of `shared/i18n`.
 */
export function useUtcClock(): Readonly<ShallowRef<Date>> {
  const now = shallowRef(new Date());
  let timer: ReturnType<typeof setTimeout> | undefined;

  const tick = () => {
    now.value = new Date();
    timer = setTimeout(tick, 1000 - (now.value.getTime() % 1000));
  };

  timer = setTimeout(tick, 1000 - (now.value.getTime() % 1000));

  onScopeDispose(() => clearTimeout(timer));

  return readonly(now);
}
