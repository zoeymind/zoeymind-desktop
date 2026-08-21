import { useState } from "react"
import { Button } from "@zoeymind/ui"
import { approveCurrentDocumentEdit } from "@/products/mind/document-portal/current-document-adapter"
import { useTranslation } from "@zoeymind/i18n"

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

export function DocumentEditApprovalToolUI({
  args,
  respond,
}: {
  args: ApprovalArgs
  respond: (output: ApprovalOutput) => Promise<void>
}) {
  const { t } = useTranslation()
  const [submitting, setSubmitting] = useState(false)
  const affected = args.changeSummary.affectedNodes.slice(0, 5)

  const approve = async () => {
    setSubmitting(true)
    try {
      const result = await approveCurrentDocumentEdit(args.confirmationToken, args.returnView)
      if (result.phase !== "committed") throw new Error(t("mindmap.aiChat.input.editReviewFailed"))
      await respond({ success: true, ...result, phase: "committed" })
    } catch (error) {
      await respond({
        success: false,
        phase: "cancelled",
        message: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-xl bg-muted/60 p-3 shadow-sm">
      <div className="text-sm font-medium">{t("mindmap.aiChat.input.editReviewTitle")}</div>
      <div className="mt-1 text-xs text-muted-foreground">
        {t("mindmap.aiChat.input.editReviewDescription", {
          count: args.changeSummary.removedNodes,
        })}
      </div>
      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
        {affected.map(node => (
          <div key={`${node.type}:${node.path.join("/")}`}>{node.path.join(" / ")}</div>
        ))}
        {args.changeSummary.affectedNodes.length > affected.length && (
          <div>
            {t("mindmap.aiChat.input.editReviewMoreAreas", {
              count: args.changeSummary.affectedNodes.length - affected.length,
            })}
          </div>
        )}
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={submitting}
          onClick={() =>
            respond({
              success: false,
              phase: "cancelled",
              message: t("mindmap.aiChat.input.editReviewCancelled"),
            })
          }
        >
          {t("mindmap.aiChat.input.editReviewCancel")}
        </Button>
        <Button type="button" variant="destructive" disabled={submitting} onClick={approve}>
          {t(
            submitting
              ? "mindmap.aiChat.input.editReviewApplying"
              : "mindmap.aiChat.input.editReviewApply"
          )}
        </Button>
      </div>
    </div>
  )
}
