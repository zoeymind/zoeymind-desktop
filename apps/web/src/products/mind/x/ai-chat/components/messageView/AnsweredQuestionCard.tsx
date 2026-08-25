import { useState } from "react"
import { Check } from "lucide-react"
import {
  Card,
  CardContent,
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@zoeymind/ui"
import { useTranslation } from "@zoeymind/i18n"
import { readQuestionResult } from "../../tools/ui-handlers/questionResult"
import { MotionDisclosureChevron, MotionDisclosureContent } from "./MotionDisclosure"

interface AnsweredQuestionCardProps {
  result: ReturnType<typeof readQuestionResult>
}

export function AnsweredQuestionCard({ result }: AnsweredQuestionCardProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <Card className="my-1 gap-0 py-0 shadow-none">
      <button
        type="button"
        aria-expanded={result.skipped ? undefined : open}
        disabled={result.skipped}
        onClick={() => setOpen(value => !value)}
        className="group flex h-7 w-full items-center gap-1.5 px-2.5 text-left hover:bg-muted/35 disabled:hover:bg-transparent"
      >
        <ItemMedia className="text-success">
          <Check className="size-3.5" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle className="text-[11px] font-medium leading-none">
            {result.skipped
              ? t("mindmap.aiChat.message.questionSkipped")
              : t("mindmap.aiChat.message.questionAnsweredCount", { count: result.items.length })}
          </ItemTitle>
        </ItemContent>
        {!result.skipped ? <MotionDisclosureChevron open={open} /> : null}
      </button>
      {!result.skipped ? (
        <MotionDisclosureContent open={open}>
          <CardContent className="flex flex-col gap-0 border-t border-border/60 px-2.5 py-0.5">
            {result.items.map((item, index) => (
              <Item key={`${index}:${item.question}`} className="items-start gap-1.5 py-1">
                <ItemMedia className="flex size-4 items-center justify-center rounded-full bg-muted text-[9px] tabular-nums text-muted-foreground">
                  {index + 1}
                </ItemMedia>
                <ItemContent>
                  <ItemTitle className="text-[11px] font-medium leading-snug">
                    {item.question}
                  </ItemTitle>
                  <ItemDescription className="mt-0.5 text-[11px] leading-snug text-foreground/75">
                    {item.answers.length > 0
                      ? item.answers.join("、")
                      : t("mindmap.aiChat.message.questionNoAnswer")}
                  </ItemDescription>
                </ItemContent>
              </Item>
            ))}
          </CardContent>
        </MotionDisclosureContent>
      ) : null}
    </Card>
  )
}
