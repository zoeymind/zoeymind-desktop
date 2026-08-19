export function isPhysicalTitlebarTarget(currentTarget: Node, target: Node): boolean {
  return currentTarget.contains(target)
}
