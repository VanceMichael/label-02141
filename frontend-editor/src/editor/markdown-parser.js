/**
 * Markdown parser utilities.
 * Parses raw markdown text and identifies syntax regions for decoration.
 *
 * Each region has: { type, from, to, contentFrom, contentTo, meta }
 * - from/to: full range including syntax markers
 * - contentFrom/contentTo: range of the actual content (excluding markers)
 * - meta: additional info (heading level, language, url, etc.)
 */

/**
 * @typedef {Object} MarkdownRegion
 * @property {string} type
 * @property {number} from
 * @property {number} to
 * @property {number} contentFrom
 * @property {number} contentTo
 * @property {Object} [meta]
 */

/**
 * Parse a document string and return all markdown regions.
 * @param {string} doc - The full document text
 * @returns {MarkdownRegion[]}
 */
export function parseMarkdownRegions(doc) {
  const regions = []
  const lines = doc.split('\n')
  let pos = 0
  let inCodeBlock = false
  let codeBlockStart = -1
  let codeBlockLang = ''
  let codeBlockMarkerLen = 0
  let inTable = false
  let tableStart = -1
  let tableHeader = null
  let tableAlignments = []
  let tableRows = []
  let lastTableRowEnd = -1

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineStart = pos
    const lineEnd = pos + line.length

    // === Table Detection ===
    // Check if line looks like a table row (contains pipes)
    const isTableRow = line.includes('|') && line.trim().length > 0
    const isSeparatorRow = /^\s*\|?\s*(:?-+:?\s*\|)+\s*$/.test(line.trim())

    // Start table detection: when we find a pipe-containing line followed by a separator
    if (!inTable && !inCodeBlock && isTableRow && i + 1 < lines.length) {
      const nextLine = lines[i + 1]
      if (/^\s*\|?\s*(:?-+:?\s*\|)+\s*$/.test(nextLine.trim())) {
        inTable = true
        tableStart = lineStart
        tableHeader = parseTableRow(line)
        tableAlignments = parseTableAlignments(nextLine)
        tableRows = []
        lastTableRowEnd = lineStart + line.length + 1 + nextLine.length // Include separator row
        i += 1 // Skip separator line
        pos = pos + line.length + 1 + nextLine.length + 1
        continue
      }
    }

    // Continue collecting table rows
    if (inTable && !inCodeBlock) {
      if (isTableRow && line.trim().length > 0) {
        tableRows.push(parseTableRow(line))
        lastTableRowEnd = lineEnd
        pos = lineEnd + 1
        continue
      } else {
        // End of table
        regions.push({
          type: 'table',
          from: tableStart,
          to: lastTableRowEnd,
          contentFrom: tableStart,
          contentTo: lastTableRowEnd,
          meta: {
            header: tableHeader,
            alignments: tableAlignments,
            rows: tableRows
          }
        })
        inTable = false
        tableStart = -1
        tableHeader = null
        tableAlignments = []
        tableRows = []
      }
    }

    // Code block fences
    const fenceMatch = line.match(/^(`{3,}|~{3,})(.*)$/)
    if (fenceMatch) {
      if (!inCodeBlock) {
        inCodeBlock = true
        codeBlockStart = lineStart
        codeBlockLang = fenceMatch[2].trim()
        codeBlockMarkerLen = fenceMatch[1].length
        pos = lineEnd + 1
        continue
      } else if (fenceMatch[1].length >= codeBlockMarkerLen && fenceMatch[1][0] === (lines[findCodeBlockStartLine(lines, codeBlockStart, pos)]?.match(/^(`{3,}|~{3,})/)?.[1]?.[0] || '`')) {
        regions.push({
          type: 'code-block',
          from: codeBlockStart,
          to: lineEnd,
          contentFrom: codeBlockStart,
          contentTo: lineEnd,
          meta: { language: codeBlockLang }
        })
        inCodeBlock = false
        codeBlockStart = -1
        codeBlockLang = ''
        pos = lineEnd + 1
        continue
      }
    }

    if (inCodeBlock) {
      pos = lineEnd + 1
      continue
    }

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const markEnd = lineStart + level
      regions.push({
        type: 'heading',
        from: lineStart,
        to: lineEnd,
        contentFrom: markEnd + 1,
        contentTo: lineEnd,
        meta: { level, markFrom: lineStart, markTo: markEnd + 1 }
      })
      pos = lineEnd + 1
      continue
    }

    // Horizontal rule
    if (/^(\*{3,}|-{3,}|_{3,})\s*$/.test(line)) {
      regions.push({
        type: 'hr',
        from: lineStart,
        to: lineEnd,
        contentFrom: lineStart,
        contentTo: lineEnd,
        meta: {}
      })
      pos = lineEnd + 1
      continue
    }

    // Blockquote
    const bqMatch = line.match(/^(>\s?)(.*)$/)
    if (bqMatch) {
      regions.push({
        type: 'blockquote',
        from: lineStart,
        to: lineEnd,
        contentFrom: lineStart + bqMatch[1].length,
        contentTo: lineEnd,
        meta: { markFrom: lineStart, markTo: lineStart + bqMatch[1].length }
      })
    }

    // Unordered list
    const ulMatch = line.match(/^(\s*)([-*+])\s(.+)$/)
    if (ulMatch) {
      const indent = ulMatch[1].length
      const markerStart = lineStart + indent
      regions.push({
        type: 'list-bullet',
        from: lineStart,
        to: lineEnd,
        contentFrom: markerStart + 2,
        contentTo: lineEnd,
        meta: { marker: ulMatch[2], markerFrom: markerStart, markerTo: markerStart + 1, indent }
      })
    }

    // Ordered list
    const olMatch = line.match(/^(\s*)(\d+)\.\s(.+)$/)
    if (olMatch) {
      const indent = olMatch[1].length
      const markerStart = lineStart + indent
      const markerEnd = markerStart + olMatch[2].length + 1
      regions.push({
        type: 'list-ordered',
        from: lineStart,
        to: lineEnd,
        contentFrom: markerEnd + 1,
        contentTo: lineEnd,
        meta: { number: olMatch[2], markerFrom: markerStart, markerTo: markerEnd, indent }
      })
    }

    // Task list
    const taskMatch = line.match(/^(\s*[-*+]\s)\[([xX ])\]\s(.+)$/)
    if (taskMatch) {
      const checkStart = lineStart + taskMatch[1].length
      regions.push({
        type: 'task-list',
        from: lineStart,
        to: lineEnd,
        contentFrom: checkStart + 4,
        contentTo: lineEnd,
        meta: {
          checked: taskMatch[2].toLowerCase() === 'x',
          checkFrom: checkStart,
          checkTo: checkStart + 3
        }
      })
    }

    // Inline patterns on this line
    parseInlineRegions(line, lineStart, regions)

    pos = lineEnd + 1
  }

  // Handle table at end of document
  if (inTable) {
    regions.push({
      type: 'table',
      from: tableStart,
      to: lastTableRowEnd,
      contentFrom: tableStart,
      contentTo: lastTableRowEnd,
      meta: {
        header: tableHeader,
        alignments: tableAlignments,
        rows: tableRows
      }
    })
  }

  return regions
}

function findCodeBlockStartLine(lines, codeBlockStart, currentPos) {
  let p = 0
  for (let i = 0; i < lines.length; i++) {
    if (p === codeBlockStart) return i
    p += lines[i].length + 1
  }
  return 0
}

/**
 * Parse inline markdown patterns within a single line.
 */
function parseInlineRegions(line, lineStart, regions) {
  // Image: ![alt](url)
  const imgRe = /!\[([^\]]*)\]\(([^)]+)\)/g
  let m
  while ((m = imgRe.exec(line)) !== null) {
    regions.push({
      type: 'image',
      from: lineStart + m.index,
      to: lineStart + m.index + m[0].length,
      contentFrom: lineStart + m.index + 2,
      contentTo: lineStart + m.index + 2 + m[1].length,
      meta: { alt: m[1], url: m[2] }
    })
  }

  // Link: [text](url) — but not images
  const linkRe = /(?<!!)\[([^\]]+)\]\(([^)]+)\)/g
  while ((m = linkRe.exec(line)) !== null) {
    regions.push({
      type: 'link',
      from: lineStart + m.index,
      to: lineStart + m.index + m[0].length,
      contentFrom: lineStart + m.index + 1,
      contentTo: lineStart + m.index + 1 + m[1].length,
      meta: { text: m[1], url: m[2] }
    })
  }

  // Bold: **text** or __text__
  const boldRe = /(\*\*|__)(?!\s)(.+?)(?<!\s)\1/g
  while ((m = boldRe.exec(line)) !== null) {
    regions.push({
      type: 'bold',
      from: lineStart + m.index,
      to: lineStart + m.index + m[0].length,
      contentFrom: lineStart + m.index + 2,
      contentTo: lineStart + m.index + 2 + m[2].length,
      meta: { marker: m[1] }
    })
  }

  // Italic: *text* or _text_ (not bold)
  const italicRe = /(?<!\*|\w)(\*|_)(?!\s|\1)(.+?)(?<!\s)\1(?!\*|\w)/g
  while ((m = italicRe.exec(line)) !== null) {
    // Skip if this is part of a bold marker
    const fullFrom = lineStart + m.index
    const isBold = regions.some(r => r.type === 'bold' && r.from <= fullFrom && r.to >= fullFrom + m[0].length)
    if (isBold) continue
    regions.push({
      type: 'italic',
      from: fullFrom,
      to: fullFrom + m[0].length,
      contentFrom: fullFrom + 1,
      contentTo: fullFrom + 1 + m[2].length,
      meta: { marker: m[1] }
    })
  }

  // Strikethrough: ~~text~~
  const strikeRe = /~~(?!\s)(.+?)(?<!\s)~~/g
  while ((m = strikeRe.exec(line)) !== null) {
    regions.push({
      type: 'strikethrough',
      from: lineStart + m.index,
      to: lineStart + m.index + m[0].length,
      contentFrom: lineStart + m.index + 2,
      contentTo: lineStart + m.index + 2 + m[1].length,
      meta: {}
    })
  }

  // Inline code: `code`
  const codeRe = /(?<!`)(`+)(?!`)(.+?)(?<!`)\1(?!`)/g
  while ((m = codeRe.exec(line)) !== null) {
    const markerLen = m[1].length
    regions.push({
      type: 'inline-code',
      from: lineStart + m.index,
      to: lineStart + m.index + m[0].length,
      contentFrom: lineStart + m.index + markerLen,
      contentTo: lineStart + m.index + markerLen + m[2].length,
      meta: { markerLen }
    })
  }
}

/**
 * Parse a markdown table row into cell array.
 * Handles both | a | b | c | and a | b | c formats.
 * @param {string} line 
 * @returns {string[]}
 */
function parseTableRow(line) {
  let trimmed = line.trim()
  if (trimmed.startsWith('|')) trimmed = trimmed.slice(1)
  if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1)
  return trimmed.split('|').map(cell => cell.trim())
}

/**
 * Parse table separator row to determine column alignments.
 * :--- = left, ---: = right, :---: = center
 * @param {string} line 
 * @returns {string[]}
 */
function parseTableAlignments(line) {
  let trimmed = line.trim()
  if (trimmed.startsWith('|')) trimmed = trimmed.slice(1)
  if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1)
  return trimmed.split('|').map(sep => {
    const s = sep.trim()
    if (s.startsWith(':') && s.endsWith(':')) return 'center'
    if (s.endsWith(':')) return 'right'
    return 'left'
  })
}

/**
 * Check if a position falls within any region.
 * @param {MarkdownRegion[]} regions
 * @param {number} pos
 * @returns {MarkdownRegion|null}
 */
export function regionAtPos(regions, pos) {
  return regions.find(r => pos >= r.from && pos <= r.to) || null
}

/**
 * Check if a cursor line overlaps with a region.
 * @param {MarkdownRegion} region
 * @param {number} lineFrom
 * @param {number} lineTo
 * @returns {boolean}
 */
export function cursorOnRegion(region, lineFrom, lineTo) {
  return region.from <= lineTo && region.to >= lineFrom
}
