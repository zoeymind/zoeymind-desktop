import { i18next } from "@zoeymind/i18n"

import { useTabs } from "@/shared/tabs/store"
import { readBundle } from "./zmind-file"
import { findByPath, registerProject } from "./projects-repo"
import { bumpProjects } from "./projects-events"
import { createUUID } from "@/shared/app-shared"

export interface OpenZmindResult {
  id: string
  title: string
}

export function zmindTitleFromPath(path: string): string {
  return (
    path
      .split(/[\\/]/)
      .pop()
      ?.replace(/\.zmind$/i, "") || i18next.t("mindmap.editor.newProjectTitle", "Untitled")
  )
}

export async function openZmindProject(path: string): Promise<OpenZmindResult> {
  const existing = await findByPath(path)
  const bundle = await readBundle(path)
  const title = zmindTitleFromPath(path)
  const id = existing?.id ?? createUUID()

  if (!existing) {
    await registerProject({
      id,
      path,
      name: title,
      nodeCount: bundle.meta.nodeCount,
    })
    bumpProjects()
  }

  useTabs.getState().openTab({ id, kind: "file", title, projectId: id })
  return { id, title }
}
