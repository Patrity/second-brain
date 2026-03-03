<script setup lang="ts">
import type { ChatSessionStatus, ChatConnectionStatus, ChatImageBlock, ChatDocumentBlock, SkillListItem } from '~~/shared/types'

const props = defineProps<{
  sessionStatus: ChatSessionStatus
  connectionStatus: ChatConnectionStatus
}>()

const emit = defineEmits<{
  send: [message: string, attachments?: ChatImageBlock[], documents?: ChatDocumentBlock[]]
  interrupt: []
}>()

const { attachments, addFiles, removeAttachment, clearAttachments, toImageBlocks, toDocumentBlocks } = useAttachments()

const inputText = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)

const isStreaming = computed(() => props.sessionStatus === 'streaming')
const isConnected = computed(() => props.connectionStatus === 'connected')
const canSend = computed(() =>
  isConnected.value
  && !isStreaming.value
  && (inputText.value.trim().length > 0 || attachments.value.length > 0)
)

// Slash command menu — refreshes each time the menu opens so newly created skills appear
const { data: skillsData, refresh: refreshSkills } = await useAsyncData('chat-skills', () => $fetch('/api/skills'))
const activeSkills = computed<SkillListItem[]>(() =>
  (skillsData.value?.data ?? []).filter((s: SkillListItem) => s.active)
)

const slashQuery = computed(() => {
  const m = inputText.value.match(/^\/(\S*)$/)
  return m ? m[1] : null
})

// Refresh skill list each time the menu opens (user types '/')
watch(slashQuery, (val, prev) => {
  if (val != null && prev == null) refreshSkills()
})

const filteredSkills = computed(() => {
  if (slashQuery.value == null) return []
  const q = slashQuery.value.toLowerCase()
  return q === ''
    ? activeSkills.value
    : activeSkills.value.filter(s => s.name.toLowerCase().includes(q))
})

const highlightedIndex = ref(0)
watch(filteredSkills, () => {
  highlightedIndex.value = 0
})

function selectSkill(skill: SkillListItem) {
  inputText.value = '/' + skill.name + ' '
  nextTick(() => textareaRef.value?.focus())
}

function handleKeydown(e: KeyboardEvent) {
  if (filteredSkills.value.length > 0) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      highlightedIndex.value = (highlightedIndex.value + 1) % filteredSkills.value.length
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      highlightedIndex.value = (highlightedIndex.value - 1 + filteredSkills.value.length) % filteredSkills.value.length
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      inputText.value = ''
      return
    }
    if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Tab') {
      e.preventDefault()
      selectSkill(filteredSkills.value[highlightedIndex.value]!)
      return
    }
  }
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

function handleSend() {
  if (!canSend.value) return
  const images = toImageBlocks()
  const docs = toDocumentBlocks()
  emit(
    'send',
    inputText.value.trim(),
    images.length > 0 ? images : undefined,
    docs.length > 0 ? docs : undefined
  )
  inputText.value = ''
  clearAttachments()
  nextTick(() => {
    if (textareaRef.value) textareaRef.value.style.height = 'auto'
  })
}

function autoResize(e: Event) {
  const target = e.target as HTMLTextAreaElement
  target.style.height = 'auto'
  target.style.height = Math.min(target.scrollHeight, 200) + 'px'
}

function handlePaste(e: ClipboardEvent) {
  const files = Array.from(e.clipboardData?.files || [])
  if (files.length > 0) {
    e.preventDefault()
    addFiles(files)
  }
}

function handleDragOver(e: DragEvent) {
  e.preventDefault()
  isDragging.value = true
}

function handleDragLeave() {
  isDragging.value = false
}

function handleDrop(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false
  const files = Array.from(e.dataTransfer?.files || [])
  if (files.length > 0) addFiles(files)
}

function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.length) addFiles(input.files)
  input.value = ''
}

const FILE_ACCEPT = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  '.txt', '.md', '.js', '.ts', '.jsx', '.tsx', '.py', '.rb', '.rs', '.go',
  '.java', '.c', '.cpp', '.h', '.cs', '.swift', '.kt',
  '.json', '.yaml', '.yml', '.toml', '.ini',
  '.xml', '.html', '.css', '.scss',
  '.sh', '.sql', '.graphql', '.csv', '.log',
  '.vue', '.svelte', '.prisma', '.lua', '.dart'
].join(',')
</script>

<template>
  <div
    class="border-t border-default p-4 relative"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <!-- Drag overlay -->
    <div
      v-if="isDragging"
      class="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center z-10"
    >
      <span class="text-sm text-primary font-medium">Drop files here</span>
    </div>

    <!-- Connection status -->
    <div
      v-if="!isConnected"
      class="flex items-center gap-2 mb-2 text-xs text-dimmed"
    >
      <span class="size-2 rounded-full bg-warning" />
      <span>{{ connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected' }}</span>
    </div>

    <!-- Attachment preview strip -->
    <div
      v-if="attachments.length"
      class="flex gap-2 mb-2 flex-wrap"
    >
      <div
        v-for="att in attachments"
        :key="att.id"
        class="relative group rounded-lg overflow-hidden border border-default"
        :class="att.kind === 'image' ? 'size-16' : 'h-10 px-3 flex items-center gap-1.5 bg-elevated/50'"
      >
        <!-- Image thumbnail -->
        <img
          v-if="att.kind === 'image'"
          :src="att.previewUrl"
          :alt="att.name"
          class="size-full object-cover"
        >
        <!-- Document chip -->
        <template v-else>
          <UIcon
            :name="att.name.endsWith('.pdf') ? 'i-lucide-file-text' : 'i-lucide-file-code'"
            class="size-4 text-dimmed shrink-0"
          />
          <span class="text-xs truncate max-w-24">{{ att.name }}</span>
        </template>

        <button
          class="absolute top-0 right-0 p-0.5 bg-error/80 rounded-bl-lg opacity-0 group-hover:opacity-100 transition-opacity"
          @click="removeAttachment(att.id)"
        >
          <UIcon
            name="i-lucide-x"
            class="size-3 text-white"
          />
        </button>
      </div>
    </div>

    <!-- Input row (relative so slash menu anchors to it) -->
    <div class="flex items-start gap-2 relative">
      <!-- Slash command menu -->
      <div
        v-if="filteredSkills.length"
        class="absolute bottom-full left-0 right-12 mb-1 bg-accented border border-default rounded-lg shadow-lg overflow-hidden max-h-64 overflow-y-auto z-50"
      >
        <button
          v-for="(skill, i) in filteredSkills"
          :key="skill.name"
          class="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-primary/40 transition-colors duration-100"
          :class="i === highlightedIndex ? 'bg-primary/40' : ''"
          @mousedown.prevent="selectSkill(skill)"
        >
          <span class="text-sm font-mono font-medium text-highlighted shrink-0">/{{ skill.name }}</span>
          <span class="text-xs text-accented truncate">{{ skill.description }}</span>
        </button>
      </div>

      <textarea
        ref="textareaRef"
        v-model="inputText"
        :disabled="!isConnected || isStreaming"
        placeholder="Send a message... (type / for skills)"
        rows="1"
        class="flex-1 resize-none bg-elevated/50 border border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
        @keydown="handleKeydown"
        @input="autoResize"
        @paste="handlePaste"
      />

      <input
        ref="fileInputRef"
        type="file"
        :accept="FILE_ACCEPT"
        multiple
        class="hidden"
        @change="handleFileSelect"
      >

      <UButton
        icon="i-lucide-paperclip"
        variant="ghost"
        color="neutral"
        size="md"
        :disabled="!isConnected || isStreaming"
        @click="fileInputRef?.click()"
      />

      <UButton
        v-if="isStreaming"
        icon="i-lucide-square"
        color="error"
        variant="soft"
        size="md"
        @click="emit('interrupt')"
      />
      <UButton
        v-else
        icon="i-lucide-send"
        color="primary"
        :disabled="!canSend"
        size="md"
        @click="handleSend"
      />
    </div>
  </div>
</template>
