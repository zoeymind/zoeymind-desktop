import { describe, expect, it } from "vitest"
import { clear, isPending, recoveryStorageId, stash, stashRecovered } from "./pending-projects"

const tree = { data: { text: "Root" }, children: [] }

describe("recoveryStorageId", () => {
  it("keeps restored edits on the original recovery record", () => {
    const tabId = stashRecovered({
      title: "Recovered",
      tree,
      recoveryId: "original-recovery",
      originPath: null,
      originRevision: null,
    })

    expect(recoveryStorageId(tabId)).toBe("original-recovery")
    clear(tabId)
  })

  it("uses the project id for ordinary drafts", () => {
    const tabId = stash({ title: "Draft", tree })

    expect(recoveryStorageId(tabId)).toBe(tabId)
    clear(tabId)
  })
})

describe("isPending", () => {
  it("is false once the entry is cleared from the memory stash", () => {
    // 之前 isPending 是 id.startsWith('unsaved-') 前缀判断. tab 保存后就地
    // 晋升为 file 但 id 仍是 unsaved-xxx, 前缀仍匹配 -> saveAllSessions 二次
    // 检查 "was not saved" 必失败, 关窗全部保存永远走不通.
    const id = stash({ title: "Draft", tree })
    expect(isPending(id)).toBe(true)
    clear(id)
    expect(isPending(id)).toBe(false)
  })

  it("does not treat an unknown unsaved-shaped id as pending", () => {
    expect(isPending("unsaved-not-stashed")).toBe(false)
  })
})
