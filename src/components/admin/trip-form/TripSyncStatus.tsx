"use client";
import { AlertTriangle, RefreshCw, Scale } from "lucide-react";
import { Notice } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { formatRelative } from "@/lib/adminFormat";
import { IGNORED_REASON_TEXT, syncFieldText, tripSyncStatus } from "@/lib/tripSyncStatus";
import { cn } from "@/lib/utils";

/**
 * Why a website edit has not reached the chatbot yet, when it is retried next,
 * which edited fields the chatbot did not take, and how many disagreements
 * wait for a decision. Renders nothing while everything is in step.
 */
export default function TripSyncStatus({ sourceMetadata, retrying, onRetry, onOpenComparison }: {
  sourceMetadata: unknown;
  retrying: boolean;
  onRetry: () => void;
  onOpenComparison: () => void;
}) {
  const status = tripSyncStatus(sourceMetadata);
  const waiting = status.state === "retrying" || status.state === "failed";
  if (!waiting && !status.ignored.length && !status.conflicts) return null;

  const title = status.state === "failed"
    ? "Chatbot руу илгээх автомат оролдлого зогссон"
    : status.state === "retrying"
      ? "Сүүлийн засвар chatbot руу хараахан очоогүй"
      : status.ignored.length
        ? "Сүүлийн засварын зарим талбарыг chatbot аваагүй"
        : `Вебсайт ба chatbot-ын хооронд ${status.conflicts} зөрүү шийдэгдээгүй`;

  return (
    <Notice
      tone={status.state === "failed" ? "danger" : "warning"}
      icon={AlertTriangle}
      title={title}
      action={
        <span className="flex flex-wrap gap-2">
          {waiting && (
            <Button type="button" size="sm" variant="outline" disabled={retrying} onClick={onRetry} className="gap-2">
              <RefreshCw className={cn("h-4 w-4", retrying && "animate-spin")} />
              Одоо дахин илгээх
            </Button>
          )}
          {status.conflicts > 0 && (
            <Button type="button" size="sm" variant="outline" onClick={onOpenComparison} className="gap-2">
              <Scale className="h-4 w-4" />
              Зөрүүг шийдэх
            </Button>
          )}
        </span>
      }
    >
      <ul className="space-y-1">
        {waiting && (
          <li>
            Вебсайт дээр хадгалагдсан, гэхдээ chatbot руу {status.attempts} удаа илгээж чадсангүй
            {status.error ? `: ${status.error}` : ""}.{" "}
            {status.state === "failed"
              ? "Шалтгааныг засаад «Одоо дахин илгээх»-ийг дарна уу."
              : status.nextAttemptAt
                ? `Дараагийн автомат оролдлого ${formatRelative(status.nextAttemptAt)}.`
                : ""}
          </li>
        )}
        {status.ignored.map((entry) => (
          <li key={entry.field}>
            «{syncFieldText(entry.field)}» — {IGNORED_REASON_TEXT[entry.reason] ?? entry.reason}. Chatbot хуучин утгаараа хариулсаар байна.
          </li>
        ))}
        {status.conflicts > 0 && (status.ignored.length > 0 || waiting) && (
          <li>{status.conflicts} зөрүү шийдэгдээгүй — аль утга зөвийг сонгоно уу.</li>
        )}
      </ul>
    </Notice>
  );
}
