import { EditorState } from '@codemirror/state'
import { EditorView, keymap, drawSelection, highlightActiveLine, dropCursor } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language'
import { editorBaseTheme } from './theme'
import { markdownDecorationPlugin } from './decoration-plugin'

const defaultContent = `# Welcome to MD Live Editor

This is a **live rendering** markdown editor. Try clicking on any formatted text to see the raw syntax.

## Features

- **Bold text** and *italic text* render inline
- ~~Strikethrough~~ is supported too
- \`inline code\` looks great
- Links like [Google](https://www.google.com) are clickable

### Code Blocks

\`\`\`javascript
function greet(name) {
  console.log(\`Hello, \${name}!\`)
}
greet('World')
\`\`\`

### Blockquotes

> This is a blockquote. It has a nice left border and subtle background.
> You can write multiple lines here.

### Task Lists

- [x] Build the markdown parser
- [x] Implement decoration plugin
- [ ] Add more syntax support
- [ ] Polish the UI

### Images

![Placeholder](https://via.placeholder.com/600x200/e8f0fe/1a73e8?text=MD+Live+Editor)

---

### Tables

Click anywhere on the table below to edit the raw markdown syntax. Click outside to see it render as a beautiful table. Hover over column borders to drag and resize!

| Feature | Status | Priority | Assignee | Due Date |
|---------|:------:|:---------|:---------|:---------|
| Table rendering | ✅ Done | High | Team A | 2024-03-31 |
| Column resize | ✅ Done | High | Team A | 2024-04-15 |
| Syntax highlighting | 🚧 In Progress | Medium | Team B | 2024-04-30 |
| Export to PDF | 📋 Planned | Low | Team C | 2024-05-15 |
| Dark mode | 📋 Planned | Medium | Team B | 2024-06-01 |

> **Tip:** Move your cursor **inside** the table area to see the Markdown syntax. Move it **outside** to see the clean, rendered table with resizable columns!

---

The editor focuses on **live rendering** — what you see is what you get, but you can always click to edit the raw markdown.

Happy writing! ✨
`

/**
 * Create and mount a CodeMirror 6 editor instance.
 * @param {HTMLElement} parent - The DOM element to mount the editor into
 * @param {Object} [options]
 * @param {string} [options.doc] - Initial document content
 * @param {function} [options.onUpdate] - Callback for editor updates
 * @returns {EditorView}
 */
export function createEditor(parent, options = {}) {
  const { doc, onUpdate } = options

  const extensions = [
    // Core
    history(),
    drawSelection(),
    dropCursor(),
    highlightActiveLine(),
    bracketMatching(),
    EditorView.lineWrapping,

    // Keymaps
    keymap.of([
      ...defaultKeymap,
      ...historyKeymap,
      indentWithTab
    ]),

    // Markdown language support (for syntax tree)
    markdown({
      base: markdownLanguage,
      codeLanguages: languages
    }),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),

    // Our custom theme
    editorBaseTheme,

    // The live rendering plugin
    markdownDecorationPlugin,

    // Placeholder
    EditorView.contentAttributes.of({ spellcheck: 'true' })
  ]

  // Add update listener if provided
  if (onUpdate) {
    extensions.push(EditorView.updateListener.of(onUpdate))
  }

  const state = EditorState.create({
    doc: doc || defaultContent,
    extensions
  })

  return new EditorView({ state, parent })
}
