<script setup lang="ts">
import { computed, useId } from "vue";
import AppIcon from "./AppIcon.vue";

/**
 * Labelled text input. Hint and error are tied to the input with
 * `aria-describedby`; an error also sets `aria-invalid`. The error text
 * is always visible: colour is never its only carrier.
 */
const props = withDefaults(
  defineProps<{
    label: string;
    hint?: string;
    error?: string;
    required?: boolean;
    type?: "text" | "number";
    inputmode?: "text" | "decimal" | "numeric";
    autocomplete?: string;
    autocapitalize?: "off" | "characters" | "words" | "sentences";
    maxlength?: number;
    name?: string;
  }>(),
  {
    hint: undefined,
    error: undefined,
    required: false,
    type: "text",
    inputmode: "text",
    autocomplete: "off",
    autocapitalize: "off",
    maxlength: undefined,
    name: undefined,
  },
);

const model = defineModel<string>({ required: true });
const id = useId();
const hintId = `${id}-hint`;
const errorId = `${id}-error`;

const describedBy = computed(
  () =>
    [props.hint ? hintId : "", props.error ? errorId : ""]
      .filter(Boolean)
      .join(" ") || undefined,
);
</script>

<template>
  <div class="flex flex-col gap-1">
    <label :for="id" class="text-sm font-medium text-fg">
      {{ label }}
      <span v-if="required" class="text-fg-muted" aria-hidden="true">*</span>
    </label>
    <input
      :id="id"
      v-model="model"
      :name="name"
      :type="type"
      :inputmode="inputmode"
      :autocomplete="autocomplete"
      :autocapitalize="autocapitalize"
      :maxlength="maxlength"
      :required="required"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="describedBy"
      spellcheck="false"
      class="min-h-touch rounded-lg border bg-surface px-3 text-fg focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
      :class="error ? 'border-danger' : 'border-border-strong'"
    />
    <p v-if="hint" :id="hintId" class="text-sm text-fg-muted">{{ hint }}</p>
    <p
      v-if="error"
      :id="errorId"
      class="flex items-start gap-1 text-sm font-medium text-danger"
    >
      <AppIcon name="alert" :size="18" />
      <span>{{ error }}</span>
    </p>
  </div>
</template>
