export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BASE =
  "inline-flex min-h-touch items-center justify-center gap-2 rounded-lg px-4 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const VARIANTS: Readonly<Record<ButtonVariant, string>> = {
  primary: "bg-accent text-accent-fg hover:bg-accent/90",
  secondary:
    "border border-border-strong bg-surface text-fg hover:bg-surface-muted",
  ghost: "text-fg hover:bg-surface-muted",
  // Destructive confirmations only (restore that replaces data, deletion).
  danger: "bg-danger text-canvas hover:bg-danger/90",
};

/**
 * Classes shared by buttons and by links styled as buttons (RouterLink), so
 * both keep the same 44 px touch target (NFR-UX-02).
 */
export function buttonClasses(
  variant: ButtonVariant = "secondary",
  block = false,
): string {
  return [BASE, VARIANTS[variant], block ? "w-full" : ""].join(" ").trim();
}
