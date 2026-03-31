<template>
  <div class="editor-pane" ref="editorContainer"></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { createEditor } from '@/editor'
import { useEditorStore } from '@/stores/editor'

const editorContainer = ref(null)
const store = useEditorStore()
let editorView = null
const emit = defineEmits(['ready'])

onMounted(() => {
  if (!editorContainer.value) return
  editorView = createEditor(editorContainer.value, {
    onUpdate(update) {
      if (update.docChanged) store.updateContent(update.state.doc.toString())
      if (update.selectionSet || update.docChanged) {
        const pos = update.state.selection.main.head
        const line = update.state.doc.lineAt(pos)
        store.updateCursor(line.number, pos - line.from + 1)
      }
    }
  })
  store.updateContent(editorView.state.doc.toString())
  emit('ready', editorView)
})

onBeforeUnmount(() => { editorView?.destroy(); editorView = null })

defineExpose({ getView: () => editorView })
</script>

<style lang="scss" scoped>
.editor-pane {
  flex: 1;
  overflow: hidden;
  background: $bg-editor;
}
</style>
