export function shouldMountEditorPane(visible: boolean): boolean {
  return visible
}

export function getPanePresentationClass(visible: boolean, layoutClass = ""): string {
  return [
    "absolute inset-0",
    layoutClass,
    visible ? "opacity-100" : "opacity-0 pointer-events-none",
  ]
    .filter(Boolean)
    .join(" ")
}
