"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Loader2, QrCode } from "lucide-react";
import { toast } from "sonner";

import { api, apiErrorMessage } from "@/lib/api";
import { track } from "@/lib/analytics";
import { Button } from "@/components/ui/button";

type Invoice = {
  invoiceId: string;
  qrText: string;
  qrImage: string;
  deepLinks: { name: string; link: string }[];
  reused: boolean;
};

/**
 * QR payment for a booking's outstanding balance.
 *
 * Deliberately never trusts anything from this component's own state to
 * declare a payment successful — it only shows "paid" once the server-side
 * poll (GET /bookings/:reference/qpay, which re-verifies against QPay
 * directly) confirms it. A closed tab or a failed poll just means the
 * customer hasn't seen confirmation yet, not that they haven't paid; the
 * webhook and the next poll both still work independently of this component
 * ever being open again.
 */
export default function QpayPayButton({
  reference,
  onPaid,
}: {
  reference: string;
  onPaid: () => void;
}) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);

  const start = useMutation({
    mutationFn: async () => (await api.post<Invoice>(`/bookings/${reference}/qpay`)).data,
    onSuccess: (data) => {
      setInvoice(data);
      track("booking_start", { properties: { channel: "qpay" } });
    },
    onError: (err) => toast.error(apiErrorMessage(err, "QPay нэхэмжлэл үүсгэхэд алдаа гарлаа")),
  });

  useQuery({
    queryKey: ["qpay-poll", reference],
    enabled: Boolean(invoice),
    refetchInterval: 3000,
    queryFn: async () => {
      const { data } = await api.get<{ paid: boolean }>(`/bookings/${reference}/qpay`);
      if (data.paid) onPaid();
      return data;
    },
  });

  if (!invoice) {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={() => start.mutate()}
        disabled={start.isPending}
        className="w-full"
      >
        {start.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <QrCode className="mr-2 h-4 w-4" />
        )}
        QPay-аар төлөх
      </Button>
    );
  }

  return (
    <div className="rounded-xl border border-border p-4 text-center">
      <img
        src={`data:image/png;base64,${invoice.qrImage}`}
        alt="QPay QR код"
        className="mx-auto h-44 w-44 rounded-lg border border-border"
      />
      <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Банкны апп-аараа уншуулж төлнө үү…
      </p>

      {invoice.deepLinks.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-1.5">
          {invoice.deepLinks.slice(0, 6).map((bank) => (
            <a
              key={bank.name}
              href={bank.link}
              className="rounded-lg border border-border px-2 py-1.5 text-[11px] font-medium hover:border-primary hover:text-primary"
            >
              {bank.name}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export function QpayPaidBadge() {
  return (
    <div className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
      <Check className="h-4 w-4" />
      QPay-аар төлбөр баталгаажлаа
    </div>
  );
}
