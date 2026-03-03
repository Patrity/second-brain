<script setup lang="ts">
definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})

const route = useRoute()

const tabs = [
  { label: 'Account', icon: 'i-lucide-user', value: 'account' },
  { label: 'Secrets', icon: 'i-lucide-key', value: 'secrets' },
  { label: 'Integrations', icon: 'i-lucide-plug', value: 'integrations' },
  { label: 'App', icon: 'i-lucide-settings', value: 'app' }
]

const activeTab = computed(() => {
  const path = route.path
  const segment = path.split('/').pop()
  return tabs.some(t => t.value === segment) ? segment : 'account'
})

function navigateTab(value: string | number) {
  navigateTo(`/settings/${value}`)
}
</script>

<template>
  <UDashboardPanel
    id="settings"
    grow
  >
    <UDashboardNavbar title="Settings">
      <template #right>
        <UColorModeButton />
      </template>
    </UDashboardNavbar>

    <div class="p-6 overflow-auto">
      <UTabs
        :items="tabs"
        :model-value="activeTab"
        :content="false"
        class="w-full mx-auto"
        :ui="{ list: 'max-w-xl' }"
        @update:model-value="navigateTab"
      />
      <NuxtPage />
    </div>
  </UDashboardPanel>
</template>
