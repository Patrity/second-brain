<script setup lang="ts">
import type { ChatMessage, ChatContentBlock, ChatImageBlock, ChatDocumentBlock, MessageSource, CodeLanguage } from '~~/shared/types'

defineProps<{
  message: ChatMessage
}>()

function getTextContent(blocks: ChatContentBlock[]): string {
  return blocks
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('\n')
}

function getImageBlocks(blocks: ChatContentBlock[]): ChatImageBlock[] {
  return blocks.filter((b): b is ChatImageBlock => b.type === 'image')
}

function getDocumentBlocks(blocks: ChatContentBlock[]): ChatDocumentBlock[] {
  return blocks.filter((b): b is ChatDocumentBlock => b.type === 'document')
}

function getToolPairs(blocks: ChatContentBlock[]) {
  const tools: { name: string, id: string, result?: string, isError?: boolean }[] = []
  for (const block of blocks) {
    if (block.type === 'tool_use')
      tools.push({ name: block.name, id: block.id })
    else if (block.type === 'tool_result') {
      const tool = tools.find(t => t.id === block.tool_use_id)
      if (tool) {
        tool.result = block.content
        tool.isError = block.is_error
      }
    }
  }
  return tools
}

function getDocIcon(doc: ChatDocumentBlock): string {
  if (doc.source.media_type === 'application/pdf') return 'i-lucide-file-text'
  return 'i-lucide-file-code'
}

// Copy markdown
const { copy } = useCopyToClipboard()
const copied = ref(false)

async function copyMarkdown(blocks: ChatContentBlock[]) {
  const text = getTextContent(blocks)
  if (!text) return
  const ok = await copy(text)
  if (ok) {
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  }
}

// Image preview
const previewImage = ref<ChatImageBlock | null>(null)
const previewOpen = computed({
  get: () => previewImage.value !== null,
  set: (v) => { if (!v) previewImage.value = null }
})

// Code/document preview
const previewDoc = ref<ChatDocumentBlock | null>(null)
const codePreviewOpen = computed({
  get: () => previewDoc.value !== null,
  set: (v) => { if (!v) previewDoc.value = null }
})

const codePreviewContent = computed(() => previewDoc.value?.source.data || '')

const extToLang: Record<string, CodeLanguage> = {
  md: 'markdown',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  mts: 'typescript',
  json: 'json',
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'css',
  sass: 'css',
  less: 'css',
  vue: 'vue',
  svelte: 'html',
  py: 'python',
  sql: 'sql',
  yaml: 'yaml',
  yml: 'yaml',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  fish: 'bash',
  go: 'go',
  rs: 'rust',
  dockerfile: 'dockerfile',
  java: 'java',
  kt: 'java',
  c: 'cpp',
  cpp: 'cpp',
  h: 'cpp',
  hpp: 'cpp',
  cs: 'cpp',
  xml: 'xml',
  graphql: 'plaintext',
  gql: 'plaintext',
  toml: 'plaintext',
  ini: 'plaintext',
  csv: 'plaintext',
  txt: 'plaintext',
  log: 'plaintext',
  env: 'plaintext',
  prisma: 'plaintext',
  proto: 'plaintext'
}

const codePreviewLang = computed<CodeLanguage>(() => {
  if (!previewDoc.value?.title) return 'plaintext'
  const ext = previewDoc.value.title.split('.').pop()?.toLowerCase() || ''
  return extToLang[ext] || 'plaintext'
})

function handleDocClick(doc: ChatDocumentBlock) {
  if (doc.source.media_type === 'application/pdf') {
    // Open PDF in new tab
    const byteChars = atob(doc.source.data)
    const bytes = new Uint8Array(byteChars.length)
    for (let i = 0; i < byteChars.length; i++)
      bytes[i] = byteChars.charCodeAt(i)
    const blob = new Blob([bytes], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  } else {
    // Open text file in code viewer modal
    previewDoc.value = doc
  }
}

const sourceIconMap: Record<string, string> = {
  telegram: 'i-simple-icons-telegram',
  discord: 'i-simple-icons-discord',
  imessage: 'i-lucide-message-circle',
  email: 'i-lucide-mail',
  google: 'i-simple-icons-google'
}

function getSourceIcon(source?: MessageSource): string | null {
  if (!source || source === 'web') return null
  return sourceIconMap[source] || null
}

function formatTime(date: Date | string | undefined): string {
  if (!date) return ''
  const d = date instanceof Date ? date : new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMs / 3600000)

  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`

  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
</script>

<template>
  <div
    class="flex"
    :class="message.role === 'user' ? 'justify-end' : 'justify-start'"
  >
    <!-- Platform icon for bridge user messages (left of bubble) -->
    <UIcon
      v-if="message.role === 'user' && getSourceIcon(message.source)"
      :name="getSourceIcon(message.source)!"
      class="size-4 text-dimmed self-end mb-1 mr-1.5 shrink-0"
    />

    <div
      class="max-w-[85%] rounded-xl px-4 py-3"
      :class="message.role === 'user'
        ? 'bg-primary/5 text-highlighted'
        : 'bg-muted'"
    >
      <!-- User message -->
      <div v-if="message.role === 'user'">
        <!-- Image attachments -->
        <div
          v-if="getImageBlocks(message.content).length"
          class="flex flex-wrap gap-2 mb-2"
        >
          <img
            v-for="(img, i) in getImageBlocks(message.content)"
            :key="i"
            :src="`data:${img.source.media_type};base64,${img.source.data}`"
            class="max-w-48 max-h-48 rounded-lg object-contain cursor-pointer hover:opacity-80 transition-opacity"
            @click="previewImage = img"
          >
        </div>

        <!-- Document attachments -->
        <div
          v-if="getDocumentBlocks(message.content).length"
          class="flex flex-wrap gap-2 mb-2"
        >
          <button
            v-for="(doc, i) in getDocumentBlocks(message.content)"
            :key="i"
            class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-elevated/50 border border-default text-xs hover:bg-elevated transition-colors cursor-pointer"
            @click="handleDocClick(doc)"
          >
            <UIcon
              :name="getDocIcon(doc)"
              class="size-3.5 text-dimmed shrink-0"
            />
            <span class="truncate max-w-32">{{ doc.title || 'Document' }}</span>
            <UIcon
              v-if="doc.source.media_type === 'application/pdf'"
              name="i-lucide-external-link"
              class="size-3 text-dimmed shrink-0"
            />
          </button>
        </div>

        <!-- Text content -->
        <div
          v-if="getTextContent(message.content)"
          class="text-sm whitespace-pre-wrap"
        >
          {{ getTextContent(message.content) }}
        </div>
      </div>

      <!-- Assistant message -->
      <template v-else>
        <!-- Text content rendered as markdown -->
        <div
          v-if="getTextContent(message.content)"
          class="chat-prose prose prose-sm dark:prose-invert max-w-none"
        >
          <MDC :value="getTextContent(message.content)" />
        </div>

        <!-- Tool calls -->
        <ChatToolCallBlock
          v-for="tool in getToolPairs(message.content)"
          :key="tool.id"
          :tool-name="tool.name"
          :result="tool.result"
          :is-error="tool.isError"
        />

        <!-- Cost/duration metadata + copy button -->
        <div
          v-if="message.costUsd || message.durationMs || getTextContent(message.content)"
          class="flex items-center gap-3 mt-2 text-xs text-dimmed"
        >
          <span v-if="message.costUsd">${{ message.costUsd.toFixed(4) }}</span>
          <span v-if="message.durationMs">{{ (message.durationMs / 1000).toFixed(1) }}s</span>
          <button
            v-if="getTextContent(message.content)"
            class="ml-auto flex items-center gap-1 hover:text-highlighted transition-colors"
            @click="copyMarkdown(message.content)"
          >
            <UIcon
              :name="copied ? 'i-lucide-check' : 'i-lucide-copy'"
              class="size-3"
            />
          </button>
        </div>
      </template>

      <!-- Timestamp -->
      <div
        v-if="message.createdAt"
        class="mt-1 text-xs text-dimmed"
        :class="message.role === 'user' ? 'text-right' : ''"
      >
        {{ formatTime(message.createdAt) }}
      </div>
    </div>

    <!-- Image preview modal -->
    <UModal
      v-model:open="previewOpen"
    >
      <template #content>
        <div class="flex items-center justify-center">
          <img
            v-if="previewImage"
            :src="`data:${previewImage.source.media_type};base64,${previewImage.source.data}`"
            class="max-w-full max-h-[80vh] object-contain rounded-lg"
          >
        </div>
      </template>
    </UModal>

    <!-- Code preview modal -->
    <UModal
      v-model:open="codePreviewOpen"
    >
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon
            name="i-lucide-file-code"
            class="size-4 text-dimmed"
          />
          <span class="text-sm font-medium truncate">{{ previewDoc?.title || 'File' }}</span>
        </div>
      </template>
      <template #body>
        <div class="h-[60vh] overflow-hidden rounded-lg border border-default">
          <EditorCodeEditor
            v-if="previewDoc"
            :model-value="codePreviewContent"
            :language="codePreviewLang"
            read-only
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
