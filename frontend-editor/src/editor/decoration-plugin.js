import {
  ViewPlugin,
  Decoration,
  WidgetType
} from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import { parseMarkdownRegions } from './markdown-parser'

/**
 * HR Widget — renders a horizontal rule
 */
class HrWidget extends WidgetType {
  toDOM() {
    const hr = document.createElement('hr')
    hr.className = 'md-hr'
    return hr
  }
  ignoreEvent() { return false }
}

/**
 * Image Widget — renders an image preview
 */
class ImageWidget extends WidgetType {
  constructor(alt, url) {
    super()
    this.alt = alt
    this.url = url
  }

  /**
   * 检测是否为本地文件系统路径
   */
  isLocalPath(path) {
    if (!path) return false
    // Windows: C:\, D:\, \\network\path
    if (/^[a-zA-Z]:\\/.test(path) || path.startsWith('\\\\')) return true
    // Unix/Mac: /absolute/path or ~/home/path or file://
    if (path.startsWith('file://') || (path.startsWith('/') && !path.startsWith('//'))) return true
    // Relative paths: ./path or ../path
    if (path.startsWith('./') || path.startsWith('../')) return true
    return false
  }

  /**
   * 检测是否为网络路径
   */
  isNetworkPath(path) {
    if (!path) return false
    return /^https?:\/\//i.test(path) || path.startsWith('//')
  }

  toDOM() {
    const wrapper = document.createElement('span')
    wrapper.className = 'md-image-placeholder'

    // 检查是否为网络路径
    if (this.isNetworkPath(this.url)) {
      const img = document.createElement('img')
      img.src = this.url
      img.alt = this.alt || ''
      img.className = 'md-image-widget'
      img.style.maxWidth = '100%'
      img.onerror = () => {
        wrapper.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            <span>图片加载失败: ${this.alt || this.url}</span>
          </div>
        `
        wrapper.className = 'md-image-placeholder'
      }
      wrapper.textContent = ''
      wrapper.className = ''
      wrapper.appendChild(img)
    } 
    // 检查是否为本地文件系统路径
    else if (this.isLocalPath(this.url)) {
      wrapper.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 8px; align-items: center;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span>浏览器无法访问本地路径: ${this.url}</span>
          </div>
          <span style="font-size: 11px; opacity: 0.7;">提示：请使用 http:// 或 https:// 开头的网络图片地址</span>
        </div>
      `
    } 
    // 其他情况（可能是相对路径或无效路径）
    else {
      wrapper.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          <span>${this.alt || '图片'}: ${this.url || '未指定路径'}</span>
        </div>
      `
    }
    return wrapper
  }
  ignoreEvent() { return false }
  eq(other) { return other.url === this.url && other.alt === this.alt }
}

/**
 * Checkbox Widget for task lists
 */
class CheckboxWidget extends WidgetType {
  constructor(checked) {
    super()
    this.checked = checked
  }
  toDOM() {
    const span = document.createElement('span')
    span.className = `md-task-checkbox${this.checked ? ' md-task-checkbox--checked' : ''}`
    if (!this.checked) {
      span.innerHTML = '&nbsp;'
    }
    return span
  }
  ignoreEvent() { return false }
  eq(other) { return other.checked === this.checked }
}

/**
 * Table Widget — renders a markdown table with resizable columns
 */
class TableWidget extends WidgetType {
  constructor(rows, separatorLine) {
    super()
    this.rows = rows
    this.separatorLine = separatorLine
    this.columnWidths = []
  }

  toDOM() {
    const container = document.createElement('div')
    container.className = 'md-table-container'

    const table = document.createElement('table')
    table.className = 'md-table-widget'

    const validRows = this.rows.filter((_, i) => i !== this.separatorLine)

    validRows.forEach((row, rowIndex) => {
      const tr = document.createElement('tr')
      const isHeader = rowIndex === 0

      row.forEach((cell, cellIndex) => {
        const td = document.createElement(isHeader ? 'th' : 'td')
        td.textContent = cell
        if (this.columnWidths[cellIndex]) {
          td.style.width = this.columnWidths[cellIndex] + 'px'
        }
        tr.appendChild(td)

        if (cellIndex < row.length - 1) {
          const resizer = document.createElement('div')
          resizer.className = 'md-table-resizer'
          resizer.dataset.col = cellIndex
          td.appendChild(resizer)
        }
      })

      table.appendChild(tr)
    })

    container.appendChild(table)

    let isResizing = false
    let currentResizer = null
    let startX = 0
    let startWidth = 0
    let currentCol = 0

    const onMouseDown = (e) => {
      const resizer = e.target.closest('.md-table-resizer')
      if (!resizer) return

      isResizing = true
      currentResizer = resizer
      currentCol = parseInt(resizer.dataset.col, 10)
      startX = e.pageX

      const th = table.querySelectorAll('th')[currentCol] || table.querySelectorAll('td')[currentCol]
      if (th) {
        startWidth = th.offsetWidth
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
      e.preventDefault()
    }

    const onMouseMove = (e) => {
      if (!isResizing) return
      const dx = e.pageX - startX
      const newWidth = Math.max(50, startWidth + dx)

      const cells = table.querySelectorAll(`th:nth-child(${currentCol + 1}), td:nth-child(${currentCol + 1})`)
      cells.forEach(cell => {
        cell.style.width = newWidth + 'px'
      })

      this.columnWidths[currentCol] = newWidth
    }

    const onMouseUp = () => {
      isResizing = false
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    container.addEventListener('mousedown', onMouseDown)

    return container
  }

  ignoreEvent() { return false }

  eq(other) {
    if (other.rows.length !== this.rows.length) return false
    for (let i = 0; i < this.rows.length; i++) {
      if (JSON.stringify(this.rows[i]) !== JSON.stringify(other.rows[i])) return false
    }
    return other.separatorLine === this.separatorLine
  }
}

// Decoration marks
const headingDeco = (level) => Decoration.mark({ class: `md-heading md-heading--${level}` })
const boldDeco = Decoration.mark({ class: 'md-bold' })
const italicDeco = Decoration.mark({ class: 'md-italic' })
const strikeDeco = Decoration.mark({ class: 'md-strikethrough' })
const inlineCodeDeco = Decoration.mark({ class: 'md-inline-code' })
const linkDeco = Decoration.mark({ class: 'md-link' })
const blockquoteDeco = Decoration.mark({ class: 'md-blockquote' })
const syntaxHiddenDeco = Decoration.mark({ class: 'md-syntax-hidden' })
const syntaxVisibleDeco = Decoration.mark({ class: 'md-syntax-visible' })
const codeBlockDeco = Decoration.line({ class: 'md-code-block' })
const listMarkerDeco = Decoration.mark({ class: 'md-list-marker' })
const headingMarkDeco = Decoration.mark({ class: 'md-heading-mark' })

/**
 * Get the line range that the cursor is on.
 * Returns { from, to } of the current line(s) covered by all selections.
 */
function getCursorLineRanges(state) {
  const ranges = []
  for (const sel of state.selection.ranges) {
    const lineFrom = state.doc.lineAt(sel.from)
    const lineTo = state.doc.lineAt(sel.to)
    ranges.push({ from: lineFrom.from, to: lineTo.to })
  }
  return ranges
}

/**
 * Check if a region overlaps with any cursor line range.
 */
function isCursorOnRegion(region, cursorRanges) {
  return cursorRanges.some(cr => region.from <= cr.to && region.to >= cr.from)
}

/**
 * Build decorations for the entire document.
 * Core logic: if cursor is on a region, show syntax marks; otherwise, hide them and show rendered result.
 */
function buildDecorations(view) {
  const { state } = view
  const doc = state.doc.toString()
  const regions = parseMarkdownRegions(doc)
  const cursorRanges = getCursorLineRanges(state)
  const builder = new RangeSetBuilder()

  // We need to collect all decorations and sort them by from position
  const decos = []

  for (const region of regions) {
    const cursorOn = isCursorOnRegion(region, cursorRanges)

    switch (region.type) {
      case 'heading': {
        const { level, markFrom, markTo } = region.meta
        // Always apply heading style to content
        decos.push({ from: region.contentFrom, to: region.to, deco: headingDeco(level) })
        if (cursorOn) {
          // Show the hash marks with special styling
          decos.push({ from: markFrom, to: markTo, deco: headingMarkDeco })
        } else {
          // Hide the hash marks
          decos.push({ from: markFrom, to: markTo, deco: syntaxHiddenDeco })
        }
        break
      }

      case 'bold': {
        // Apply bold to content
        decos.push({ from: region.contentFrom, to: region.contentTo, deco: boldDeco })
        if (!cursorOn) {
          // Hide markers
          decos.push({ from: region.from, to: region.contentFrom, deco: syntaxHiddenDeco })
          decos.push({ from: region.contentTo, to: region.to, deco: syntaxHiddenDeco })
        } else {
          decos.push({ from: region.from, to: region.contentFrom, deco: syntaxVisibleDeco })
          decos.push({ from: region.contentTo, to: region.to, deco: syntaxVisibleDeco })
        }
        break
      }

      case 'italic': {
        decos.push({ from: region.contentFrom, to: region.contentTo, deco: italicDeco })
        if (!cursorOn) {
          decos.push({ from: region.from, to: region.contentFrom, deco: syntaxHiddenDeco })
          decos.push({ from: region.contentTo, to: region.to, deco: syntaxHiddenDeco })
        } else {
          decos.push({ from: region.from, to: region.contentFrom, deco: syntaxVisibleDeco })
          decos.push({ from: region.contentTo, to: region.to, deco: syntaxVisibleDeco })
        }
        break
      }

      case 'strikethrough': {
        decos.push({ from: region.contentFrom, to: region.contentTo, deco: strikeDeco })
        if (!cursorOn) {
          decos.push({ from: region.from, to: region.contentFrom, deco: syntaxHiddenDeco })
          decos.push({ from: region.contentTo, to: region.to, deco: syntaxHiddenDeco })
        } else {
          decos.push({ from: region.from, to: region.contentFrom, deco: syntaxVisibleDeco })
          decos.push({ from: region.contentTo, to: region.to, deco: syntaxVisibleDeco })
        }
        break
      }

      case 'inline-code': {
        decos.push({ from: region.contentFrom, to: region.contentTo, deco: inlineCodeDeco })
        if (!cursorOn) {
          const markerLen = region.meta.markerLen
          decos.push({ from: region.from, to: region.from + markerLen, deco: syntaxHiddenDeco })
          decos.push({ from: region.to - markerLen, to: region.to, deco: syntaxHiddenDeco })
        } else {
          const markerLen = region.meta.markerLen
          decos.push({ from: region.from, to: region.from + markerLen, deco: syntaxVisibleDeco })
          decos.push({ from: region.to - markerLen, to: region.to, deco: syntaxVisibleDeco })
        }
        break
      }

      case 'link': {
        if (!cursorOn) {
          // Show only the link text with link styling
          decos.push({ from: region.contentFrom, to: region.contentTo, deco: linkDeco })
          // Hide [
          decos.push({ from: region.from, to: region.contentFrom, deco: syntaxHiddenDeco })
          // Hide ](url)
          decos.push({ from: region.contentTo, to: region.to, deco: syntaxHiddenDeco })
        } else {
          decos.push({ from: region.contentFrom, to: region.contentTo, deco: linkDeco })
          decos.push({ from: region.from, to: region.contentFrom, deco: syntaxVisibleDeco })
          decos.push({ from: region.contentTo, to: region.to, deco: syntaxVisibleDeco })
        }
        break
      }

      case 'image': {
        if (!cursorOn) {
          // Replace the entire image syntax with a widget
          decos.push({
            from: region.from,
            to: region.to,
            deco: Decoration.replace({
              widget: new ImageWidget(region.meta.alt, region.meta.url)
            })
          })
        }
        // When cursor is on it, show raw syntax (no decoration needed)
        break
      }

      case 'hr': {
        if (!cursorOn) {
          decos.push({
            from: region.from,
            to: region.to,
            deco: Decoration.replace({
              widget: new HrWidget()
            })
          })
        }
        break
      }

      case 'blockquote': {
        const { markFrom, markTo } = region.meta
        decos.push({ from: region.from, to: region.to, deco: blockquoteDeco })
        if (!cursorOn) {
          decos.push({ from: markFrom, to: markTo, deco: syntaxHiddenDeco })
        } else {
          decos.push({ from: markFrom, to: markTo, deco: syntaxVisibleDeco })
        }
        break
      }

      case 'list-bullet': {
        const { markerFrom, markerTo } = region.meta
        decos.push({ from: markerFrom, to: markerTo, deco: listMarkerDeco })
        break
      }

      case 'list-ordered': {
        const { markerFrom, markerTo } = region.meta
        decos.push({ from: markerFrom, to: markerTo, deco: listMarkerDeco })
        break
      }

      case 'task-list': {
        if (!cursorOn) {
          const { checkFrom, checkTo, checked } = region.meta
          decos.push({
            from: checkFrom,
            to: checkTo + 1,
            deco: Decoration.replace({
              widget: new CheckboxWidget(checked)
            })
          })
        }
        break
      }

      case 'code-block': {
        // Apply line decoration to each line in the code block
        const startLine = state.doc.lineAt(region.from)
        const endLine = state.doc.lineAt(region.to)
        for (let lineNum = startLine.number; lineNum <= endLine.number; lineNum++) {
          const line = state.doc.line(lineNum)
          decos.push({ from: line.from, to: line.from, deco: codeBlockDeco, isLine: true })
        }
        // Hide fence markers when cursor is not on the block
        if (!cursorOn) {
          const firstLine = state.doc.lineAt(region.from)
          const lastLine = state.doc.lineAt(region.to)
          // Hide opening fence
          decos.push({ from: firstLine.from, to: firstLine.to, deco: syntaxHiddenDeco })
          // Hide closing fence
          decos.push({ from: lastLine.from, to: lastLine.to, deco: syntaxHiddenDeco })
        }
        break
      }

      case 'table': {
        if (!cursorOn) {
          decos.push({
            from: region.from,
            to: region.to,
            deco: Decoration.replace({
              widget: new TableWidget(region.meta.rows, region.meta.separatorLine)
            })
          })
        }
        break
      }
    }
  }

  // Sort decorations by from position, then by whether they are line decorations
  decos.sort((a, b) => {
    if (a.from !== b.from) return a.from - b.from
    // Line decorations should come before mark decorations at the same position
    if (a.isLine && !b.isLine) return -1
    if (!a.isLine && b.isLine) return 1
    return 0
  })

  // Filter out invalid ranges (from >= to for non-line decorations)
  for (const d of decos) {
    if (d.isLine) {
      builder.add(d.from, d.from, d.deco)
    } else if (d.from < d.to) {
      builder.add(d.from, d.to, d.deco)
    }
  }

  return builder.finish()
}

/**
 * The main ViewPlugin that drives live markdown rendering.
 */
export const markdownDecorationPlugin = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.decorations = buildDecorations(view)
    }

    update(update) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildDecorations(update.view)
      }
    }
  },
  {
    decorations: (v) => v.decorations
  }
)
