export const ZTDL_MENTION_REGEX = /([+\-~>=!]?)([MC]):([^\s:「」<>]+)\s*(?:「([^」]*)」)?/g

export const INLINE_CODE_ZTDL_REGEX = /`([+\-~>=!]*[MC]:[^\s:`]+)`/g

export const LEGACY_MENTION_SPAN_REGEX =
  /<span\s+class="mention-tag"\s+data-node-id="([^"]+)"\s*>\s*([^<]+)\s*<\/span>/g

export const CLASS_MENTION_SPAN_REGEX =
  /<span\s+class="([^"]*\bmention-tag\b[^"]*)"\s*>\s*([^<]+)\s*<\/span>/g

export const ESCAPED_ZTDL_REGEX = /\\([+\-~>=!]?)([MC]):([^\s:「」<>]+)\s*(?:「([^」]*)」)?/g
