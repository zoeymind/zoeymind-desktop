import { useCallback } from "react"
import { useToolUI } from "../../context/ToolUIRegistry"
import { DocumentEditApprovalToolUI } from "./DocumentEditApprovalToolUI"

interface ApprovalArgs {
  confirmationToken: string
  changeSummary: {
    removedNodes: number
    affectedNodes: Array<{ path: string[]; type: string; count: number }>
  }
  returnView?: { view?: "outline" | "subtree"; maxLines?: number }
}

interface ApprovalOutput {
  success: boolean
  phase: "committed" | "cancelled"
  message?: string
  [key: string]: unknown
}

export function useDocumentEditApprovalToolUI(): void {
  const render = useCallback(
    ({
      args,
      respond,
    }: {
      args: ApprovalArgs
      respond: (output: ApprovalOutput) => Promise<void>
    }) => <DocumentEditApprovalToolUI args={args} respond={respond} />,
    []
  )

  useToolUI<ApprovalArgs, ApprovalOutput>({
    name: "edit_current_mindmap",
    shouldRender: input =>
      typeof input === "object" && input !== null && "confirmationToken" in input,
    parseArgs: input => input as ApprovalArgs,
    render,
  })
}
