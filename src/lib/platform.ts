let platform: "macos" | "windows" | "linux" | null = null

export async function getPlatform(): Promise<"macos" | "windows" | "linux"> {
  if (platform) {
    return platform
  }

  const userAgent = navigator.userAgent.toLowerCase()

  if (userAgent.includes("mac")) {
    platform = "macos"
  } else if (userAgent.includes("win")) {
    platform = "windows"
  } else {
    platform = "linux"
  }

  return platform
}
