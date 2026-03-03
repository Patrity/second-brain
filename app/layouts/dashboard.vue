<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const { user, logout } = useAuth()
const { sidebarOpen } = usePreferences()
const open = ref(sidebarOpen.value)

// Sync sidebar state to preference
watch(open, v => sidebarOpen.value = v)

// Initialize notification bus on client
const { connect: connectNotificationBus } = useNotificationBus()
onMounted(() => {
  connectNotificationBus()
})

const links = [[{
  label: 'Dashboard',
  icon: 'i-lucide-home',
  to: '/dashboard',
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Docs',
  icon: 'i-lucide-file-text',
  to: '/docs',
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Tasks',
  icon: 'i-lucide-check-square',
  to: '/tasks',
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Agents',
  icon: 'i-lucide-bot',
  to: '/agents',
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Hooks',
  icon: 'i-lucide-webhook',
  to: '/hooks',
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Skills',
  icon: 'i-lucide-puzzle',
  to: '/skills',
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Memories',
  icon: 'i-lucide-brain',
  to: '/memories',
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Usage',
  icon: 'i-lucide-bar-chart-3',
  to: '/usage',
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Chat',
  icon: 'i-lucide-message-square',
  to: '/chat',
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Settings',
  icon: 'i-lucide-settings',
  to: '/settings/account',
  onSelect: () => {
    open.value = false
  }
}]] satisfies NavigationMenuItem[][]
</script>

<template>
  <UDashboardGroup unit="rem">
    <UDashboardSidebar
      id="main"
      v-model:open="open"
      collapsible
      resizable
      class="bg-elevated/25"
      :ui="{ footer: 'lg:border-t lg:border-default' }"
    >
      <template #header="{ collapsed }">
        <div class="flex items-center gap-2 px-2 py-1.5">
          <UIcon
            name="i-lucide-brain"
            class="size-6 text-primary shrink-0"
          />
          <span
            v-if="!collapsed"
            class="font-semibold text-lg"
          >Cognova</span>
        </div>
      </template>

      <template #default="{ collapsed }">
        <ClientOnly>
          <UDashboardSearchButton :collapsed="collapsed" />
          <template #fallback>
            <UButton
              :label="collapsed ? undefined : 'Search...'"
              icon="i-lucide-search"
              color="neutral"
              variant="ghost"
              class="w-full justify-start"
              :ui="{ trailingIcon: 'ms-auto' }"
            >
              <template
                v-if="!collapsed"
                #trailing
              >
                <UKbd>⌘K</UKbd>
              </template>
            </UButton>
          </template>
        </ClientOnly>

        <UNavigationMenu
          :collapsed="collapsed"
          :items="links[0]"
          orientation="vertical"
          tooltip
          popover
        />
      </template>

      <template #footer="{ collapsed }">
        <ClientOnly>
          <UDropdownMenu
            :items="[[
              { label: 'Sign out', icon: 'i-lucide-log-out', onSelect: logout }
            ]]"
          >
            <UButton
              variant="ghost"
              class="w-full justify-start"
              :ui="{ leadingIcon: 'size-5' }"
            >
              <UAvatar
                :alt="user?.name || 'User'"
                size="2xs"
              />
              <span
                v-if="!collapsed"
                class="text-sm truncate"
              >{{ user?.name || user?.email || 'User' }}</span>
            </UButton>
          </UDropdownMenu>

          <template #fallback>
            <UButton
              variant="ghost"
              class="w-full justify-start"
              :ui="{ leadingIcon: 'size-5' }"
            >
              <USkeleton class="size-5 rounded-full" />
              <USkeleton
                v-if="!collapsed"
                class="h-4 w-20"
              />
            </UButton>
          </template>
        </ClientOnly>
      </template>
    </UDashboardSidebar>

    <ClientOnly>
      <SearchDashboardSearch />
      <template #fallback>
        <span />
      </template>
    </ClientOnly>
    
    <slot />

    <ClientOnly>
      <AssistantPanel />
      <template #fallback>
        <span />
      </template>
    </ClientOnly>

    <ClientOnly>
      <WelcomeModal />
    </ClientOnly>
  </UDashboardGroup>
</template>
