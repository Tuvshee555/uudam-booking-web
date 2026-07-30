import { cn } from "@/lib/utils";

export type EnquiryStatus =
  | "NEW"
  | "CONTACTED"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED";

/** Staff-facing wording — this badge never reaches a customer. */
export const ENQUIRY_STATUS: Record<EnquiryStatus, { label: string; className: string }> = {
  NEW: {
    label: "Шинэ",
    className: "bg-gold/20 text-amber-900 dark:text-amber-300",
  },
  CONTACTED: {
    label: "Холбогдсон",
    className: "bg-sky-100 text-sky-900 dark:bg-sky-500/15 dark:text-sky-300",
  },
  CONFIRMED: {
    label: "Баталгаажсан",
    className: "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  COMPLETED: {
    label: "Аялсан",
    className: "bg-primary/10 text-primary",
  },
  CANCELLED: {
    label: "Цуцалсан",
    className: "bg-destructive/10 text-destructive",
  },
};

export default function EnquiryStatusBadge({ status }: { status: EnquiryStatus }) {
  const entry = ENQUIRY_STATUS[status] ?? ENQUIRY_STATUS.NEW;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
        entry.className,
      )}
    >
      {entry.label}
    </span>
  );
}
