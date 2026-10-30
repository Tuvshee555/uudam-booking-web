import { ENQUIRY_STATUS_INFO, type EnquiryStatus } from "./statuses";
import { StatusBadge } from "./ui";

export type { EnquiryStatus };

/** Staff-facing wording — this badge never reaches a customer. */
export const ENQUIRY_STATUS = ENQUIRY_STATUS_INFO;

export default function EnquiryStatusBadge({ status }: { status: EnquiryStatus }) {
  const entry = ENQUIRY_STATUS_INFO[status] ?? ENQUIRY_STATUS_INFO.NEW;
  return (
    <StatusBadge tone={entry.tone} title={entry.description}>
      {entry.label}
    </StatusBadge>
  );
}
