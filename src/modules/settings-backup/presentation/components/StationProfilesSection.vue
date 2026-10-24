<script setup lang="ts">
import { onMounted, ref, shallowRef, useTemplateRef } from "vue";
import type { PersistenceError } from "@/shared/application";
import { persistenceMessage, technicalDetail, useI18n } from "@/shared/i18n";
import {
  AppBadge,
  AppButton,
  AppDialog,
  AppIcon,
  AppNotice,
  EmptyState,
} from "@/shared/ui";
import type { StationProfile } from "../../domain/station-profile";
import { useStationProfilesStore } from "../station-profiles-store";
import StationProfileDialog from "./StationProfileDialog.vue";

/*
 * Station profiles (FR-SET-01): list, default profile, create, edit and
 * delete with confirmation. The repository enforces the rules (referenced
 * and last profiles cannot be deleted); the view explains them.
 */

const { t } = useI18n();
const store = useStationProfilesStore();
const editor =
  useTemplateRef<InstanceType<typeof StationProfileDialog>>("editor");
const removeDialog = useTemplateRef<InstanceType<typeof AppDialog>>("remove");

const message = ref<string>();
const failure = shallowRef<PersistenceError>();
const removing = shallowRef<StationProfile>();
const busy = ref(false);

function done(text: string): void {
  failure.value = undefined;
  message.value = text;
}

function failed(error: PersistenceError): void {
  message.value = undefined;
  failure.value = error;
}

async function makeDefault(profile: StationProfile): Promise<void> {
  busy.value = true;
  const result = await store.setDefault(profile.id);
  busy.value = false;
  if (result.ok) {
    done(t("settings.profiles.defaultChanged", { name: profile.name }));
  } else {
    failed(result.error);
  }
}

function askRemove(profile: StationProfile): void {
  removing.value = profile;
  removeDialog.value?.open();
}

async function confirmRemove(): Promise<void> {
  const profile = removing.value;
  if (!profile) return;
  busy.value = true;
  const result = await store.remove(profile.id);
  busy.value = false;
  removeDialog.value?.close();
  if (result.ok) {
    done(t("settings.profiles.removed", { name: profile.name }));
  } else {
    failed(result.error);
  }
}

function kindLabel(profile: StationProfile): string {
  return t(`settings.profiles.kinds.${profile.kind}`);
}

onMounted(() => void store.load());
</script>

<template>
  <section
    class="flex flex-col gap-4 rounded-card border border-border bg-surface p-4 sm:p-5"
    aria-labelledby="profiles-title"
    data-testid="profiles-section"
  >
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2
        id="profiles-title"
        class="flex items-center gap-2 text-xl font-semibold"
      >
        <AppIcon name="antenna" :size="22" />
        {{ t("settings.profiles.title") }}
      </h2>
      <AppButton
        variant="primary"
        icon="plus"
        :disabled="store.status !== 'ready'"
        data-testid="profile-add"
        @click="editor?.openCreate()"
      >
        {{ t("settings.profiles.add") }}
      </AppButton>
    </div>
    <p class="text-sm text-fg-muted">{{ t("settings.profiles.intro") }}</p>

    <div aria-live="polite">
      <AppNotice v-if="message" tone="success" data-testid="profiles-message">
        {{ message }}
      </AppNotice>
    </div>
    <AppNotice
      v-if="failure"
      tone="danger"
      role="alert"
      :title="t('settings.profiles.actionFailed')"
      data-testid="profiles-error"
    >
      <p>{{ persistenceMessage(failure) }}</p>
      <p class="text-xs text-fg-muted">{{ technicalDetail(failure) }}</p>
    </AppNotice>

    <p
      v-if="store.status === 'loading' || store.status === 'idle'"
      role="status"
      class="text-sm text-fg-muted"
    >
      {{ t("settings.profiles.loading") }}
    </p>
    <AppNotice
      v-else-if="store.status === 'error' && store.loadError"
      tone="danger"
      :title="t('settings.profiles.loadError')"
    >
      <p>{{ persistenceMessage(store.loadError) }}</p>
      <p class="text-xs text-fg-muted">
        {{ technicalDetail(store.loadError) }}
      </p>
    </AppNotice>
    <EmptyState
      v-else-if="store.profiles.length === 0"
      :title="t('settings.profiles.empty')"
      icon="antenna"
      compact
    >
      {{ t("settings.profiles.emptyBody") }}
    </EmptyState>
    <ul
      v-else
      class="flex flex-col gap-3"
      :aria-label="t('settings.profiles.list')"
      data-testid="profile-list"
    >
      <li
        v-for="profile in store.profiles"
        :key="profile.id"
        class="flex flex-col gap-3 rounded-card border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
        :data-profile="profile.id"
        data-testid="profile-item"
      >
        <div class="flex min-w-0 flex-col gap-1">
          <p class="flex flex-wrap items-center gap-2 font-semibold">
            <span class="break-words">{{ profile.name }}</span>
            <AppBadge>{{ kindLabel(profile) }}</AppBadge>
            <AppBadge
              v-if="profile.isDefault === 1"
              tone="success"
              data-testid="profile-default"
            >
              {{ t("settings.profiles.default") }}
            </AppBadge>
          </p>
          <p
            v-if="profile.callsign || profile.swlId || profile.locator"
            class="font-mono text-sm text-fg-muted"
          >
            {{
              [profile.callsign, profile.swlId, profile.locator]
                .filter(Boolean)
                .join(" · ")
            }}
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <AppButton
            v-if="profile.isDefault !== 1"
            :disabled="busy"
            :aria-label="
              t('settings.profiles.makeDefaultLabel', { name: profile.name })
            "
            data-testid="profile-make-default"
            @click="makeDefault(profile)"
          >
            {{ t("settings.profiles.makeDefault") }}
          </AppButton>
          <AppButton
            icon="edit"
            :aria-label="
              t('settings.profiles.editLabel', { name: profile.name })
            "
            data-testid="profile-edit"
            @click="editor?.openEdit(profile)"
          >
            {{ t("settings.profiles.edit") }}
          </AppButton>
          <AppButton
            icon="trash"
            :disabled="busy || store.profiles.length <= 1"
            :aria-label="
              t('settings.profiles.removeLabel', { name: profile.name })
            "
            :aria-describedby="
              store.profiles.length <= 1 ? 'profiles-only-one' : undefined
            "
            data-testid="profile-remove"
            @click="askRemove(profile)"
          >
            {{ t("settings.profiles.remove") }}
          </AppButton>
        </div>
      </li>
    </ul>
    <p
      v-if="store.status === 'ready' && store.profiles.length === 1"
      id="profiles-only-one"
      class="text-sm text-fg-muted"
    >
      {{ t("settings.profiles.onlyProfile") }}
    </p>

    <StationProfileDialog
      ref="editor"
      @saved="(name) => done(t('settings.profiles.saved', { name }))"
    />

    <AppDialog
      ref="remove"
      :title="t('settings.profiles.removeDialog.title')"
      @close="removing = undefined"
    >
      <template v-if="removing">
        <p>
          {{
            t("settings.profiles.removeDialog.body", { name: removing.name })
          }}
        </p>
        <p v-if="removing.isDefault === 1">
          {{ t("settings.profiles.removeDialog.promoted") }}
        </p>
      </template>
      <template #actions>
        <AppButton @click="removeDialog?.close()">
          {{ t("settings.profiles.removeDialog.cancel") }}
        </AppButton>
        <AppButton
          variant="danger"
          icon="trash"
          :disabled="busy"
          data-testid="profile-remove-confirm"
          @click="confirmRemove"
        >
          {{ t("settings.profiles.removeDialog.confirm") }}
        </AppButton>
      </template>
    </AppDialog>
  </section>
</template>
