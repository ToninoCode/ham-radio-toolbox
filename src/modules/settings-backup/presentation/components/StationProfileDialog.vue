<script setup lang="ts">
import {
  computed,
  nextTick,
  ref,
  shallowRef,
  useId,
  useTemplateRef,
} from "vue";
import type { PersistenceError, ValidationIssue } from "@/shared/application";
import {
  issueMessage,
  persistenceMessage,
  technicalDetail,
  useI18n,
} from "@/shared/i18n";
import {
  AppButton,
  AppCheckbox,
  AppDialog,
  AppNotice,
  AppTextField,
  SegmentedControl,
  type SegmentedOption,
} from "@/shared/ui";
import type {
  StationProfile,
  StationProfileKind,
} from "../../domain/station-profile";
import {
  emptyProfileForm,
  formErrorsOf,
  profileFormOf,
  profilePatchOf,
  type ProfileFormErrors,
  type ProfileFormField,
  type ProfileFormValues,
} from "../profile-form";
import { useStationProfilesStore } from "../station-profiles-store";

/*
 * Create or edit a station profile (FR-SET-01). Validation is the entity
 * schema's (repository): its issue codes are shown next to the fields. On
 * any failure the dialog stays open with the values typed by the user.
 */

const emit = defineEmits<{ saved: [name: string] }>();

const { t } = useI18n();
const store = useStationProfilesStore();
const dialog = useTemplateRef<InstanceType<typeof AppDialog>>("dialog");
const formId = useId();

const editing = shallowRef<StationProfile>();
const values = ref<ProfileFormValues>(emptyProfileForm());
const makeDefault = ref(false);
const errors = ref<ProfileFormErrors>({});
const otherIssues = ref<readonly ValidationIssue[]>([]);
const failure = shallowRef<PersistenceError>();
const saving = ref(false);

const isFirst = computed(() => store.profiles.length === 0);

const kindOptions = computed<SegmentedOption<StationProfileKind>[]>(() => [
  { value: "ham", label: t("settings.profiles.kinds.ham") },
  { value: "swl", label: t("settings.profiles.kinds.swl") },
  { value: "both", label: t("settings.profiles.kinds.both") },
]);

function reset(): void {
  errors.value = {};
  otherIssues.value = [];
  failure.value = undefined;
  saving.value = false;
}

function openCreate(): void {
  editing.value = undefined;
  values.value = emptyProfileForm();
  makeDefault.value = false;
  reset();
  dialog.value?.open();
}

function openEdit(profile: StationProfile): void {
  editing.value = profile;
  values.value = profileFormOf(profile);
  reset();
  dialog.value?.open();
}

function errorOf(field: ProfileFormField): string | undefined {
  const code = errors.value[field];
  return code ? issueMessage(code) : undefined;
}

async function focusFirstError(): Promise<void> {
  await nextTick();
  document
    .querySelector<HTMLElement>(`#${CSS.escape(formId)} [aria-invalid="true"]`)
    ?.focus();
}

async function submit(): Promise<void> {
  if (saving.value) return;
  reset();
  const { patch, errors: local } = profilePatchOf(values.value);
  if (Object.keys(local).length > 0) {
    errors.value = local;
    await focusFirstError();
    return;
  }
  saving.value = true;
  const current = editing.value;
  const result = current
    ? await store.update(current.id, patch)
    : await store.create({
        ...patch,
        ...(makeDefault.value ? { isDefault: 1 as const } : {}),
      });
  saving.value = false;
  if (result.ok) {
    dialog.value?.close();
    emit("saved", result.value.name);
    return;
  }
  failure.value = result.error;
  if (result.error.code === "persistence.invalid-input") {
    const placed = formErrorsOf(result.error.issues);
    errors.value = placed.fields;
    otherIssues.value = placed.other;
    await focusFirstError();
  }
}

defineExpose({ openCreate, openEdit });
</script>

<template>
  <AppDialog
    ref="dialog"
    :title="
      editing
        ? t('settings.profiles.form.editTitle')
        : t('settings.profiles.form.createTitle')
    "
  >
    <form
      :id="formId"
      class="flex flex-col gap-4"
      novalidate
      data-testid="profile-form"
      @submit.prevent="submit"
    >
      <p class="text-fg-muted">{{ t("settings.profiles.form.required") }}</p>

      <div role="alert" class="empty:hidden">
        <AppNotice
          v-if="failure"
          tone="danger"
          :title="t('settings.profiles.form.invalid')"
        >
          <p v-if="failure.code !== 'persistence.invalid-input'">
            {{ persistenceMessage(failure) }}
          </p>
          <ul v-if="otherIssues.length > 0" class="list-disc pl-5">
            <li v-for="issue in otherIssues" :key="issue.path">
              {{ issueMessage(issue.code) }}
            </li>
          </ul>
          <p>{{ t("settings.profiles.form.keptOnFailure") }}</p>
          <p class="text-xs text-fg-muted">{{ technicalDetail(failure) }}</p>
        </AppNotice>
      </div>

      <AppTextField
        v-model="values.name"
        :label="t('settings.profiles.form.name')"
        :hint="t('settings.profiles.form.nameHint')"
        :error="errorOf('name')"
        required
        :maxlength="120"
        autocapitalize="sentences"
        name="name"
      />
      <SegmentedControl
        v-model="values.kind"
        :legend="t('settings.profiles.kindLabel')"
        :options="kindOptions"
        data-testid="profile-kind"
      />
      <div class="grid gap-4 sm:grid-cols-2">
        <AppTextField
          v-model="values.callsign"
          :label="t('settings.profiles.form.callsign')"
          :hint="t('settings.profiles.form.callsignHint')"
          :error="errorOf('callsign')"
          :required="values.kind !== 'swl'"
          autocapitalize="characters"
          :maxlength="20"
          name="callsign"
        />
        <AppTextField
          v-model="values.swlId"
          :label="t('settings.profiles.form.swlId')"
          :hint="t('settings.profiles.form.swlIdHint')"
          :error="errorOf('swlId')"
          :maxlength="40"
          name="swlId"
        />
        <AppTextField
          v-model="values.operatorName"
          :label="t('settings.profiles.form.operatorName')"
          :error="errorOf('operatorName')"
          autocapitalize="words"
          :maxlength="120"
          name="operatorName"
        />
        <AppTextField
          v-model="values.locator"
          :label="t('settings.profiles.form.locator')"
          :hint="t('settings.profiles.form.locatorHint')"
          :error="errorOf('locator')"
          :maxlength="8"
          name="locator"
        />
        <AppTextField
          v-model="values.qth"
          :label="t('settings.profiles.form.qth')"
          :error="errorOf('qth')"
          autocapitalize="words"
          :maxlength="120"
          name="qth"
        />
        <AppTextField
          v-model="values.country"
          :label="t('settings.profiles.form.country')"
          :error="errorOf('country')"
          autocapitalize="words"
          :maxlength="80"
          name="country"
        />
        <AppTextField
          v-model="values.dxcc"
          :label="t('settings.profiles.form.dxcc')"
          :hint="t('settings.profiles.form.dxccHint')"
          :error="errorOf('dxcc')"
          inputmode="numeric"
          :maxlength="4"
          name="dxcc"
        />
        <AppTextField
          v-model="values.cqZone"
          :label="t('settings.profiles.form.cqZone')"
          :error="errorOf('cqZone')"
          inputmode="numeric"
          :maxlength="2"
          name="cqZone"
        />
        <AppTextField
          v-model="values.ituZone"
          :label="t('settings.profiles.form.ituZone')"
          :error="errorOf('ituZone')"
          inputmode="numeric"
          :maxlength="2"
          name="ituZone"
        />
        <AppTextField
          v-model="values.altitudeM"
          :label="t('settings.profiles.form.altitudeM')"
          :error="errorOf('altitudeM')"
          inputmode="decimal"
          :maxlength="8"
          name="altitudeM"
        />
      </div>

      <fieldset class="flex flex-col gap-4">
        <legend class="mb-2 font-semibold">
          {{ t("settings.profiles.form.equipment") }}
        </legend>
        <div class="grid gap-4 sm:grid-cols-2">
          <AppTextField
            v-model="values.rig"
            :label="t('settings.profiles.form.rig')"
            :error="errorOf('rig')"
            :maxlength="120"
            name="rig"
          />
          <AppTextField
            v-model="values.receiver"
            :label="t('settings.profiles.form.receiver')"
            :error="errorOf('receiver')"
            :maxlength="120"
            name="receiver"
          />
          <AppTextField
            v-model="values.antenna"
            :label="t('settings.profiles.form.antenna')"
            :error="errorOf('antenna')"
            :maxlength="120"
            name="antenna"
          />
          <AppTextField
            v-model="values.powerW"
            :label="t('settings.profiles.form.powerW')"
            :error="errorOf('powerW')"
            inputmode="decimal"
            :maxlength="8"
            name="powerW"
          />
        </div>
      </fieldset>

      <template v-if="!editing">
        <p v-if="isFirst" class="text-fg-muted" data-testid="first-default">
          {{ t("settings.profiles.form.firstDefault") }}
        </p>
        <AppCheckbox
          v-else
          v-model="makeDefault"
          :label="t('settings.profiles.form.makeDefault')"
        />
      </template>
    </form>

    <template #actions>
      <AppButton @click="dialog?.close()">
        {{ t("settings.profiles.form.cancel") }}
      </AppButton>
      <AppButton
        variant="primary"
        type="submit"
        :form="formId"
        :disabled="saving"
        icon="check"
      >
        {{
          saving
            ? t("settings.profiles.form.saving")
            : t("settings.profiles.form.save")
        }}
      </AppButton>
    </template>
  </AppDialog>
</template>
