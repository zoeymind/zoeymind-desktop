export function isPhysicalTitlebarTarget(currentTarget: Node, target: Node): boolean {
  return currentTarget.contains(target)
}

export type TitlebarMouseAction = "start-dragging" | "toggle-maximize"

export function getTitlebarMouseAction(
  buttons: number,
  detail: number
): TitlebarMouseAction | null {
  if (buttons !== 1) return null
  return detail === 2 ? "toggle-maximize" : "start-dragging"
}
