"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, UserRound } from "lucide-react";

import { api, apiErrorMessage } from "@/lib/api";
import AdminShell from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type StaffUser = {
  id: string;
  email: string;
  role: "ADMIN" | "STAFF";
  firstName: string | null;
  lastName: string | null;
  phonenumber: string | null;
  createdAt: string;
};

type StaffForm = { email: string; password: string; firstName: string; lastName: string; role: "ADMIN" | "STAFF" };

const EMPTY_FORM: StaffForm = { email: "", password: "", firstName: "", lastName: "", role: "STAFF" };

export default function AdminStaffPage() {
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery<{ users: StaffUser[] }>({
    queryKey: ["admin", "staff"],
    queryFn: async () => {
      const { data } = await api.get("/users");
      return data;
    },
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const createMutation = useMutation({
    mutationFn: async () => api.post("/users", form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "staff"] });
      toast.success("Ажилтан нэмлээ");
      setOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Нэмэхэд алдаа гарлаа")),
  });

  function submit() {
    if (!form.email.trim()) return toast.error("И-мэйл оруулна уу");
    if (form.password.length < 8) return toast.error("Нууц үг дор хаяж 8 тэмдэгт байна");
    createMutation.mutate();
  }

  return (
    <AdminShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Ажилтнууд</h1>
        <Button onClick={() => setOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Ажилтан нэмэх
        </Button>
      </div>

      <div className="mt-5 space-y-3">
        {isPending ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-secondary" />
          ))
        ) : !data?.users.length ? (
          <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
            Ажилтан алга байна.
          </div>
        ) : (
          data.users.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UserRound className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">
                    {[user.firstName, user.lastName].filter(Boolean).join(" ") || user.email}
                  </span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                    {user.role === "ADMIN" ? "Админ" : "Ажилтан"}
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">{user.email}</div>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Шинэ ажилтан</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="firstName">Нэр</Label>
                <Input
                  id="firstName"
                  value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="lastName">Овог</Label>
                <Input
                  id="lastName"
                  value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="staff-email">И-мэйл</Label>
              <Input
                id="staff-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="staff-password">Түр нууц үг</Label>
              <Input
                id="staff-password"
                type="text"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Дор хаяж 8 тэмдэгт"
              />
            </div>

            <div>
              <Label htmlFor="staff-role">Эрх</Label>
              <select
                id="staff-role"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as "ADMIN" | "STAFF" }))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="STAFF">Ажилтан</option>
                <option value="ADMIN">Админ</option>
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={createMutation.isPending}>
              Цуцлах
            </Button>
            <Button onClick={submit} disabled={createMutation.isPending}>
              Нэмэх
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
