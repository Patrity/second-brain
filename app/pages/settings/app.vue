<script setup lang="ts">
import type { NotificationPreferences, NotificationResource, NotificationAction } from '~~/shared/types'
import { defaultNotificationPreferences } from '~~/shared/utils/notification-defaults'

const toast = useToast()
const { updatePreferences } = useNotificationBus()

// === App URL ===
const appUrl = ref('')
const appUrlSaving = ref(false)

async function loadAppUrl() {
  try {
    const { data } = await $fetch<{ data: { key: string, value: string } }>('/api/secrets/APP_URL')
    appUrl.value = data.value || ''
  } catch {
    // APP_URL secret doesn't exist; fall back to BETTER_AUTH_URL from env
    try {
      const health = await $fetch<{ appUrl: string | null }>('/api/health')
      appUrl.value = health.appUrl || ''
    } catch {
      appUrl.value = ''
    }
  }
}

async function saveAppUrl() {
  appUrlSaving.value = true
  try {
    if (appUrl.value) {
      // Try update first, create if it doesn't exist
      try {
        await $fetch('/api/secrets/APP_URL', {
          method: 'PUT',
          body: { value: appUrl.value, description: 'Public URL for webhooks and auth callbacks' }
        })
      } catch {
        await $fetch('/api/secrets', {
          method: 'POST',
          body: { key: 'APP_URL', value: appUrl.value, description: 'Public URL for webhooks and auth callbacks' }
        })
      }
    } else {
      try {
        await $fetch('/api/secrets/APP_URL', { method: 'DELETE' })
      } catch {
        // Secret may not exist, ignore
      }
    }
    toast.add({ title: 'Public URL saved', description: 'Restart running integrations for changes to take effect.', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to save URL', color: 'error' })
  }
  appUrlSaving.value = false
}

// === Version & Updates ===
interface UpdateInfo {
  currentVersion: string
  channel: string
  latestVersion: string | null
  updateAvailable: boolean
  updateCommand: string | null
}

const versionInfo = ref<UpdateInfo | null>(null)
const versionLoading = ref(true)
const checkingUpdate = ref(false)

async function loadVersionInfo() {
  versionLoading.value = true
  try {
    const health = await $fetch<{ version: string, channel: string }>('/api/health')
    versionInfo.value = {
      currentVersion: health.version,
      channel: health.channel,
      latestVersion: null,
      updateAvailable: false,
      updateCommand: null
    }
  } catch {
    // ignore
  }
  versionLoading.value = false
}

async function checkForUpdates() {
  checkingUpdate.value = true
  try {
    const { data } = await $fetch<{ data: UpdateInfo }>('/api/update-check')
    versionInfo.value = data
    if (data.updateAvailable)
      toast.add({ title: `Update available: v${data.latestVersion}`, color: 'info' })
    else
      toast.add({ title: 'You are on the latest version', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to check for updates', color: 'error' })
  }
  checkingUpdate.value = false
}

// === Notification Preferences ===
const notifPrefs = ref<NotificationPreferences>({ ...defaultNotificationPreferences })
const notifLoading = ref(false)
const notifSaving = ref(false)
const expandedResources = ref<Set<string>>(new Set())

const resourceConfig: { key: NotificationResource, label: string, icon: string, subtypes: NotificationAction[] }[] = [
  { key: 'task', label: 'Tasks', icon: 'i-lucide-check-square', subtypes: ['create', 'edit', 'delete', 'restore'] },
  { key: 'project', label: 'Projects', icon: 'i-lucide-folder', subtypes: ['create', 'edit', 'delete'] },
  { key: 'agent', label: 'Agents', icon: 'i-lucide-bot', subtypes: ['create', 'edit', 'delete', 'run', 'complete', 'fail', 'cancel'] },
  { key: 'document', label: 'Documents', icon: 'i-lucide-file-text', subtypes: ['edit', 'delete', 'restore'] },
  { key: 'memory', label: 'Memories', icon: 'i-lucide-brain', subtypes: ['create', 'delete'] },
  { key: 'reminder', label: 'Reminders', icon: 'i-lucide-bell', subtypes: ['create'] },
  { key: 'secret', label: 'Secrets', icon: 'i-lucide-key-round', subtypes: ['create', 'edit', 'delete'] },
  { key: 'hook', label: 'Hooks', icon: 'i-lucide-webhook', subtypes: ['create'] },
  { key: 'conversation', label: 'Conversations', icon: 'i-lucide-message-square', subtypes: ['delete'] },
  { key: 'bridge', label: 'Bridges', icon: 'i-lucide-plug', subtypes: ['create', 'edit', 'delete', 'complete', 'fail'] }
]

async function loadNotificationPrefs() {
  notifLoading.value = true
  try {
    const { data } = await $fetch<{ data: { notifications: NotificationPreferences } }>('/api/settings')
    notifPrefs.value = { ...defaultNotificationPreferences, ...data.notifications }
  } catch {
    notifPrefs.value = { ...defaultNotificationPreferences }
  }
  notifLoading.value = false
}

async function saveNotificationPrefs() {
  notifSaving.value = true
  try {
    await $fetch('/api/settings', {
      method: 'PUT',
      body: { notifications: notifPrefs.value }
    })
    updatePreferences(notifPrefs.value)
    toast.add({ title: 'Notification preferences saved', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to save preferences', color: 'error' })
  }
  notifSaving.value = false
}

function toggleResourceExpand(key: string) {
  if (expandedResources.value.has(key))
    expandedResources.value.delete(key)
  else
    expandedResources.value.add(key)
}

function setResourceEnabled(key: NotificationResource, enabled: boolean) {
  notifPrefs.value[key] = { ...notifPrefs.value[key], enabled }
}

function setSubtypeEnabled(key: NotificationResource, subtype: NotificationAction, enabled: boolean) {
  const current = notifPrefs.value[key]
  notifPrefs.value[key] = {
    ...current,
    subtypes: { ...current?.subtypes, [subtype]: enabled }
  }
}

onMounted(() => {
  loadAppUrl()
  loadVersionInfo()
  loadNotificationPrefs()
})
</script>

<template>
  <div class="max-w-2xl mx-auto py-6">
    <!-- Public URL -->
    <div class="mb-8">
      <h3 class="text-lg font-semibold mb-1">
        Public URL
      </h3>
      <p class="text-sm text-dimmed mb-4">
        The publicly accessible URL for this instance. Used for Telegram webhooks, auth callbacks, and other integrations that need to reach your server.
      </p>
      <div class="flex gap-2">
        <UInput
          v-model="appUrl"
          placeholder="https://example.com"
          class="flex-1"
        />
        <UButton
          :loading="appUrlSaving"
          @click="saveAppUrl"
        >
          Save
        </UButton>
      </div>
      <p class="text-xs text-dimmed mt-2">
        Leave empty to use long-polling for Telegram instead of webhooks. Changes require restarting running integrations.
      </p>
    </div>

    <USeparator class="mb-8" />

    <!-- Version & Updates -->
    <div class="mb-8">
      <h3 class="text-lg font-semibold mb-1">
        Version & Updates
      </h3>
      <p class="text-sm text-dimmed mb-4">
        Current installation version and update status.
      </p>

      <div
        v-if="versionLoading"
        class="space-y-2"
      >
        <USkeleton class="h-5 w-48" />
        <USkeleton class="h-5 w-32" />
      </div>

      <div
        v-else-if="versionInfo"
        class="space-y-3"
      >
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium">Version:</span>
          <span class="text-sm font-mono">v{{ versionInfo.currentVersion }}</span>
          <UBadge
            :color="versionInfo.channel === 'latest' ? 'success' : 'warning'"
            variant="subtle"
            size="xs"
          >
            {{ versionInfo.channel }}
          </UBadge>
        </div>

        <div
          v-if="versionInfo.updateAvailable && versionInfo.latestVersion"
          class="flex items-center gap-2"
        >
          <UIcon
            name="i-lucide-arrow-up-circle"
            class="size-4 text-info"
          />
          <span class="text-sm">
            Update available: <span class="font-mono font-medium">v{{ versionInfo.latestVersion }}</span>
          </span>
        </div>

        <div
          v-if="versionInfo.updateAvailable && versionInfo.updateCommand"
          class="rounded-md bg-elevated p-3"
        >
          <p class="text-xs text-dimmed mb-1">
            Run in your terminal:
          </p>
          <code class="text-sm font-mono">{{ versionInfo.updateCommand }}</code>
        </div>

        <div
          v-if="versionInfo.latestVersion && !versionInfo.updateAvailable"
          class="flex items-center gap-2"
        >
          <UIcon
            name="i-lucide-check-circle"
            class="size-4 text-success"
          />
          <span class="text-sm text-dimmed">Up to date</span>
        </div>

        <UButton
          variant="outline"
          :loading="checkingUpdate"
          icon="i-lucide-refresh-cw"
          @click="checkForUpdates"
        >
          Check for Updates
        </UButton>
      </div>
    </div>

    <USeparator class="mb-8" />

    <!-- Notification Preferences -->
    <div class="mb-6">
      <h3 class="text-lg font-semibold mb-1">
        Notification Preferences
      </h3>
      <p class="text-sm text-dimmed">
        Choose which resource changes show toast notifications.
      </p>
    </div>

    <div
      v-if="notifLoading"
      class="space-y-3"
    >
      <USkeleton
        v-for="i in 5"
        :key="i"
        class="h-12 w-full"
      />
    </div>

    <div
      v-else
      class="space-y-2"
    >
      <div
        v-for="rc in resourceConfig"
        :key="rc.key"
        class="border border-default rounded-lg"
      >
        <div class="flex items-center justify-between px-4 py-3">
          <div class="flex items-center gap-3">
            <UButton
              variant="ghost"
              size="xs"
              :icon="expandedResources.has(rc.key) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
              @click="toggleResourceExpand(rc.key)"
            />
            <UIcon
              :name="rc.icon"
              class="size-5 text-dimmed"
            />
            <span class="font-medium">{{ rc.label }}</span>
          </div>
          <USwitch
            :model-value="notifPrefs[rc.key]?.enabled ?? false"
            @update:model-value="(v: boolean) => setResourceEnabled(rc.key, v)"
          />
        </div>

        <div
          v-if="expandedResources.has(rc.key) && notifPrefs[rc.key]?.enabled"
          class="border-t border-default px-4 py-3 space-y-2 bg-elevated/50"
        >
          <div
            v-for="subtype in rc.subtypes"
            :key="subtype"
            class="flex items-center justify-between pl-11"
          >
            <span class="text-sm text-dimmed capitalize">{{ subtype }}</span>
            <USwitch
              :model-value="notifPrefs[rc.key]?.subtypes?.[subtype] !== false"
              size="sm"
              @update:model-value="(v: boolean) => setSubtypeEnabled(rc.key, subtype, v)"
            />
          </div>
        </div>
      </div>
    </div>

    <div class="mt-6">
      <UButton
        :loading="notifSaving"
        @click="saveNotificationPrefs"
      >
        Save Preferences
      </UButton>
    </div>
  </div>
</template>
