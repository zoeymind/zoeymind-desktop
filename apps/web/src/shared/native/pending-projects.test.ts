import { describe, expect, it } from "vitest"
import { clear, recoveryStorageId, stash, stashRecovered } from "./pending-projects"

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
