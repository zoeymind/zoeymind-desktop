import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { __test__ } from "./node.js"

const validDescriptor = { version: 1 as const, pid: 1, port: 3210, token: "a".repeat(64) }

describe("Document Portal descriptor validation", () => {
  it("accepts the exact descriptor shape", () => {
    assert.equal(__test__.isValidDocumentPortalDescriptor(validDescriptor), true)
  })

  for (const descriptor of [
    { ...validDescriptor, token: "A".repeat(64) },
    { ...validDescriptor, token: "a".repeat(63) },
    { ...validDescriptor, token: "g".repeat(64) },
    { ...validDescriptor, pid: 0 },
    { ...validDescriptor, port: 0 },
  ]) {
    assert.equal(__test__.isValidDocumentPortalDescriptor(descriptor), false)
  }
})
