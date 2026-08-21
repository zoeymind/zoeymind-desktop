import type MindMap from "simple-mind-map"
import type { OpenTab } from "@/shared/tabs/store"
import {
  PROJECT_SESSION_LIFECYCLE,
  createProjectSessionRegistry,
  createProjectSessionStore,
} from "@/products/mind/editor-session"
import { createMindMapDocumentPortal } from "../mindmap-document-portal"

export const BENCHMARK_DOCUMENT_ID = "portal-reliability"
export const BENCHMARK_CASE_COUNT = 3_000
export const BENCHMARK_MODULE_COUNT = 30
export const BENCHMARK_STEPS_PER_CASE = 2

export interface BenchmarkNode {
  data: { uid: string; text: string; icon?: string[] }
  children: BenchmarkNode[]
}

type LiveNode = { getData: (key: string) => unknown }
type EditableMindMap = MindMap & {
  renderer: { findNodeByUid: (uid: string) => LiveNode | null }
  execCommand: (command: string, ...args: unknown[]) => void
  command: { pause: () => void; recovery: () => void; addHistory: () => void }
}

function caseNumber(moduleIndex: number, caseIndex: number): number {
  return moduleIndex * (BENCHMARK_CASE_COUNT / BENCHMARK_MODULE_COUNT) + caseIndex + 1
}

function caseText(number: number): string {
  return `Case ${String(number).padStart(4, "0")} cross-module-${String(number).padStart(4, "0")} & Ready`
}

function createTree(): BenchmarkNode {
  const casesPerModule = BENCHMARK_CASE_COUNT / BENCHMARK_MODULE_COUNT
  return {
    data: { uid: "benchmark-root", text: "Portal reliability benchmark" },
    children: Array.from({ length: BENCHMARK_MODULE_COUNT * 8 }, (_, moduleIndex) => ({
      data: {
        uid: `module-${moduleIndex}`,
        text: `Module ${String(moduleIndex + 1).padStart(2, "0")}`,
        icon: ["sign_2"],
      },
      children:
        moduleIndex < BENCHMARK_MODULE_COUNT
          ? Array.from({ length: casesPerModule }, (_, index) => {
              const number = caseNumber(moduleIndex, index)
              const key = String(number).padStart(4, "0")
              return {
                data: { uid: `case-${key}`, text: caseText(number), icon: ["priority_1"] },
                children: [
                  {
                    data: { uid: `step-${key}-1`, text: `Open fixture ${key} & Fixture opens` },
                    children: [],
                  },
                  {
                    data: {
                      uid: `step-${key}-2`,
                      text: `Submit fixture ${key} & Submission succeeds`,
                    },
                    children: [],
                  },
                ],
              }
            })
          : [],
    })),
  }
}

function findNode(node: BenchmarkNode, uid: string): BenchmarkNode | null {
  if (node.data.uid === uid) return node
  for (const child of node.children) {
    const found = findNode(child, uid)
    if (found) return found
  }
  return null
}

function parentOf(node: BenchmarkNode, uid: string): BenchmarkNode | null {
  if (node.children.some(child => child.data.uid === uid)) return node
  for (const child of node.children) {
    const found = parentOf(child, uid)
    if (found) return found
  }
  return null
}

function createMindMap(root: BenchmarkNode, failCommandAt?: number): EditableMindMap {
  let nextUid = 0
  let commandCount = 0
  const live = (node: BenchmarkNode): LiveNode => ({
    getData: key => node.data[key as keyof BenchmarkNode["data"]],
  })
  const mindMap = {
    getData: () => root,
    on: () => undefined,
    renderer: {
      findNodeByUid: (uid: string) => {
        const node = findNode(root, uid)
        return node ? live(node) : null
      },
    },
    command: { pause: () => undefined, recovery: () => undefined, addHistory: () => undefined },
    execCommand: (command: string, ...args: unknown[]) => {
      commandCount += 1
      if (failCommandAt === commandCount) throw new Error("benchmark live engine failure")
      if (command === "SET_NODE_TEXT") {
        const node = findNode(root, String((args[0] as LiveNode).getData("uid")))
        if (node) node.data.text = String(args[1])
        return
      }
      if (command === "REMOVE_NODE") {
        for (const item of args[0] as LiveNode[]) {
          const parent = parentOf(root, String(item.getData("uid")))
          if (parent)
            parent.children = parent.children.filter(node => node.data.uid !== item.getData("uid"))
        }
        return
      }
      if (command === "MOVE_NODE_TO") {
        const node = findNode(root, String((args[0] as LiveNode[])[0]?.getData("uid")))
        const parent = node ? parentOf(root, node.data.uid) : null
        const destination = findNode(root, String((args[1] as LiveNode).getData("uid")))
        if (node && parent && destination) {
          parent.children = parent.children.filter(child => child !== node)
          destination.children.push(node)
        }
        return
      }
      if (command === "INSERT_MULTI_CHILD_NODE" || command === "INSERT_MULTI_NODE") {
        const target = (args[0] as LiveNode[])[0]
        const targetNode = findNode(root, String(target.getData("uid")))
        if (!targetNode) return
        const nodes = args[1] as Array<{
          data: { text: string; icon?: string[] }
          children: unknown[]
        }>
        const materialize = (node: {
          data: { text: string; icon?: string[] }
          children: unknown[]
        }): BenchmarkNode => ({
          data: {
            uid: `inserted-${nextUid++}`,
            text: node.data.text,
            ...(node.data.icon ? { icon: node.data.icon } : {}),
          },
          children: (
            node.children as Array<{ data: { text: string; icon?: string[] }; children: unknown[] }>
          ).map(materialize),
        })
        const inserted = nodes.map(materialize)
        if (command === "INSERT_MULTI_CHILD_NODE") targetNode.children.push(...inserted)
        else {
          const parent = parentOf(root, targetNode.data.uid)
          if (parent) parent.children.splice(parent.children.indexOf(targetNode), 0, ...inserted)
        }
      }
    },
  } as unknown as EditableMindMap
  return mindMap
}

export function createBenchmarkPortalFixture(options: { failCommandAt?: number } = {}) {
  const root = createTree()
  const registry = createProjectSessionRegistry()
  const tabs: OpenTab[] = [
    {
      id: BENCHMARK_DOCUMENT_ID,
      kind: "file",
      title: "Portal reliability benchmark",
      projectId: BENCHMARK_DOCUMENT_ID,
    },
  ]
  const session = createProjectSessionStore(BENCHMARK_DOCUMENT_ID)
  session.getState().setLifecycle(PROJECT_SESSION_LIFECYCLE.READY)
  session.getState().setMindMap(createMindMap(root, options.failCommandAt))
  registry.register(session)
  return {
    portal: createMindMapDocumentPortal({
      registry,
      getTabs: () => ({ tabs, activeId: BENCHMARK_DOCUMENT_ID }),
    }),
    root,
    session,
  }
}

export function benchmarkCaseText(number: number): string {
  return caseText(number)
}
