import { invoke } from "@tauri-apps/api/core"

/** Durable same-directory temporary write followed by an atomic replacement. */
export async function writeBytesAtomically(path: string, bytes: Uint8Array): Promise<void> {
  await invoke("write_file_atomically", { path, bytes: Array.from(bytes) })
}
