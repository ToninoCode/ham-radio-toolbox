<script setup lang="ts">
import { computed } from "vue";
import { buttonClasses, type ButtonVariant } from "../button-styles";
import type { IconName } from "../icons";
import AppIcon from "./AppIcon.vue";

const props = withDefaults(
  defineProps<{
    variant?: ButtonVariant;
    type?: "button" | "submit" | "reset";
    icon?: IconName;
    block?: boolean;
    disabled?: boolean;
  }>(),
  {
    variant: "secondary",
    type: "button",
    icon: undefined,
    block: false,
    disabled: false,
  },
);

const classes = computed(() => buttonClasses(props.variant, props.block));
</script>

<template>
  <button :type="type" :class="classes" :disabled="disabled">
    <AppIcon v-if="icon" :name="icon" :size="20" />
    <slot />
  </button>
</template>
