import { openUrl } from "@tauri-apps/plugin-opener"
function isTauriRuntime(): boolean {
  return "__TAURI_INTERNALS__" in window
}

export function resolveExternalHttpUrl(
  href: string,
  baseUrl = window.location.href
): string | null {
  try {
    const url = new URL(href, baseUrl)
    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    return url.origin === new URL(baseUrl).origin ? null : url.href
  } catch {
    return null
  }
}

export function installExternalLinkBoundary(root: Document = document): () => void {
  const handleClick = (event: MouseEvent) => {
    if (!isTauriRuntime() || event.defaultPrevented || event.button !== 0) return
    if (!(event.target instanceof Element)) return

    const anchor = event.target.closest("a[href]")
    if (!(anchor instanceof HTMLAnchorElement)) return

    const externalUrl = resolveExternalHttpUrl(anchor.href)
    if (!externalUrl) return

    event.preventDefault()
    void openUrl(externalUrl)
  }

  root.addEventListener("click", handleClick)
  return () => root.removeEventListener("click", handleClick)
}
