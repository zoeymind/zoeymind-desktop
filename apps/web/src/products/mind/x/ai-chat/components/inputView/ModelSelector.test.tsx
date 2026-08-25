// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import type { AIModel } from "../../../ai-chat/hooks/useModelSelector"
import { ModelSelector } from "./ModelSelector"

vi.mock("@zoeymind/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

const models: AIModel[] = [
  {
    id: "model-1",
    name: "Primary GPT 4.1",
    description: "gpt-4.1",
    provider: "openai",
  },
  {
    id: "model-2",
    name: "Backup GPT 4.1",
    description: "gpt-4.1",
    provider: "openai",
  },
]

function ControlledModelSelector({ onChange }: { onChange: (modelId: string) => void }) {
  const [selectedModel, setSelectedModel] = useState("model-1")
  return (
    <ModelSelector
      models={models}
      selectedModel={selectedModel}
      setSelectedModel={modelId => {
        setSelectedModel(modelId)
        onChange(modelId)
      }}
    />
  )
}

describe("ModelSelector", () => {
  it("switches the AI Chat model when a menu item is clicked", async () => {
    const onChange = vi.fn()
    render(<ControlledModelSelector onChange={onChange} />)

    fireEvent.click(screen.getByRole("button", { name: "Primary GPT 4.1" }))
    fireEvent.click(await screen.findByText("Backup GPT 4.1"))

    expect(onChange).toHaveBeenCalledWith("model-2")
    await waitFor(() => expect(screen.getByRole("button", { name: "Backup GPT 4.1" })).toBeTruthy())
  })
})
