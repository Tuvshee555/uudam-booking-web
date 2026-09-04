"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { api, apiErrorMessage } from "@/lib/api";
import AdminShell from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ tripNotice: string | null }>({
    queryKey: ["settings"],
    queryFn: async () => (await api.get("/settings")).data,
  });

  // Undefined means "not yet touched" — the textarea shows the loaded value
  // in that state. Editing switches to the typed value, so a save shows
  // exactly what's on screen instead of racing a useEffect against the query.
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const tripNotice = draft ?? data?.tripNotice ?? "";

  const save = useMutation({
    mutationFn: async () => api.put("/settings", { tripNotice: tripNotice.trim() || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Хадгаллаа");
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Хадгалахад алдаа гарлаа")),
  });

  return (
    <AdminShell>
      <h1 className="text-xl font-bold">Тохиргоо</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Энд бичсэн зүйл бүх аяллын хуудсан дээр харагдана. Тухайн нэг аялалд л
        зориулсан тэмдэглэл байвал тухайн аяллыг засах хуудсан дахь
        &ldquo;Чухал тэмдэглэл&rdquo; хэсэгт бичнэ — энэ хоёр хамт харагдана.
      </p>

      <div className="mt-6 max-w-2xl rounded-2xl border border-border bg-card p-5">
        <Label htmlFor="trip-notice">Бүх аялал дээр харагдах тэмдэглэл</Label>

        {isLoading ? (
          <div className="mt-1.5 h-32 animate-pulse rounded-md bg-secondary" />
        ) : (
          <textarea
            id="trip-notice"
            value={tripNotice}
            onChange={(event) => setDraft(event.target.value)}
            rows={6}
            placeholder="Жишээ нь: Бид гуравдагч этгээдийн үйлчилгээний чанарт хариуцлага хүлээхгүй болно…"
            className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        )}

        <p className="mt-2 text-xs text-muted-foreground">
          Хоосон орхивол ямар ч аялал дээр харагдахгүй.
        </p>

        <Button onClick={() => save.mutate()} disabled={save.isPending || isLoading} className="mt-4">
          {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Хадгалах
        </Button>
      </div>
    </AdminShell>
  );
}
