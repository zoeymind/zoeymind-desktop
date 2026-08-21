import type MindMap from "simple-mind-map"
import { describe, expect, it, vi } from "vitest"
import { addModuleTool } from "./add_module"
import { addCasesTool } from "./add-cases"
import { SessionIdMapper } from "../session-id-mapper"
import { bindPreAssignedIds } from "../types"
import { resolveToolInput } from "../../hooks/internal/resolveToolInput"

function createMindMap(parentUid = "root") {
  const inserted: Array<{ data?: { uid?: string; text?: string } }> = []
  const parentNode = { data: { uid: parentUid }, children: [] }
  const mindMap = {
    getData: () => parentNode,
    on: vi.fn(),
    renderer: {
      root: { id: "root-render-node" },
      activeNodeList: [{ getData: () => ({ uid: "stale-uuid", text: "stale" }) }],
    },
    execCommand: vi.fn((command: string, _targets: unknown, payload: unknown) => {
      if (command === "GO_TARGET_NODE" && typeof payload === "function") {
        payload({ id: "target-render-node" })
      }
      if (command === "INSERT_MULTI_CHILD_NODE" && Array.isArray(payload)) {
        inserted.push(...payload)
      }
    }),
  }
  return { mindMap: mindMap as unknown as MindMap, inserted }
}

describe("deterministic create tool IDs", () => {
  it("binds preassigned module IDs to this invocation, not stale active nodes", async () => {
    const mapper = new SessionIdMapper()
    const { resolved, preAssignedIds } = resolveToolInput(
      "add_module",
      { modules: [{ id: "crud_add_submit", name: "新增提交按钮" }] },
      mapper
    )
    const { mindMap, inserted } = createMindMap()

    const result = await addModuleTool.handler(resolved, { mindMap, idMapper: mapper })
    bindPreAssignedIds("add_module", result, preAssignedIds, mapper)

    const createdId = inserted[0]?.data?.uid
    expect(createdId).toBeTruthy()
    expect(createdId).not.toBe("stale-uuid")
    expect(mapper.resolve("crud_add_submit")).toBe(createdId)
    expect(result.data).toEqual([{ moduleId: createdId, moduleName: "新增提交按钮" }])
  })

  it("returns each created case exactly once", async () => {
    const mapper = new SessionIdMapper()
    mapper.bind("crud_add_input", "module-uuid")
    const { mindMap, inserted } = createMindMap("module-uuid")
    const result = await addCasesTool.handler(
      {
        moduleId: "module-uuid",
        cases: [
          { case: "[P1]合法名称", steps: ["输入名称 & 接受输入"] },
          { case: "[P2]空白名称", steps: ["输入空白 & 显示校验"] },
          { case: "[P3]超长名称", steps: ["输入超长文本 & 显示校验"] },
        ],
      },
      { mindMap, idMapper: mapper }
    )

    const data = result.data as {
      requestedCount: number
      createdCount: number
      failedCount: number
      caseIds: string[]
    }
    expect(inserted).toHaveLength(3)
    expect(data).toMatchObject({ requestedCount: 3, createdCount: 3, failedCount: 0 })
    expect(data.caseIds).toHaveLength(3)
    expect(new Set(data.caseIds).size).toBe(3)
    expect(result.ztdl?.split("\n")).toHaveLength(3)
  })

  it("returns structured context when the resolved module is missing", async () => {
    const mapper = new SessionIdMapper()
    const { mindMap } = createMindMap("existing-module")
    const result = await addCasesTool.handler(
      {
        moduleId: "missing-uuid",
        cases: [{ case: "[P1]用例", steps: ["执行 & 成功"] }],
      },
      { mindMap, idMapper: mapper }
    )

    expect(result).toMatchObject({
      success: false,
      errorCode: "MODULE_NOT_FOUND",
      details: {
        resolvedModuleId: "missing-uuid",
        availableModuleIds: [],
      },
    })
  })
})
