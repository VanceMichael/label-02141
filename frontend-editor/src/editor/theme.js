import { EditorView } from '@codemirror/view'

export const editorBaseTheme = EditorView.baseTheme({
  '&': { height: '100%', backgroundColor: '#ffffff' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'inherit' },
  '.cm-content': { caretColor: '#2563eb' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#2563eb', borderLeftWidth: '1.8px' }
})
