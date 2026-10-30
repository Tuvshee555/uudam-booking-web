"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Copy, Info, KeyRound, Loader2, Plus, UserRound, Users } from "lucide-react";

import { api, apiErrorMessage } from "@/lib/api";
import { useAuth } from "@/app/[locale]/provider/AuthProvider";
import { useI18n } from "@/components/i18n/ClientI18nProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, ErrorState, FormField, LoadingRows, Notice, PageHeader, Panel, StatusBadge, selectClassName } from "@/components/admin/ui";
import { formatDate } from "@/lib/adminFormat";

type StaffUser = {
  id: string;
  email: string;
  role: "ADMIN" | "STAFF";
  firstName: string | null;
  lastName: string | null;
  phonenumber: string | null;
  createdAt: string;
};

type StaffForm = { email: string; password: string; firstName: string; lastName: string; phonenumber: string; role: "ADMIN" | "STAFF" };
type FormErrors = Partial<Record<"email" | "password", string>>;

const EMPTY_FORM: StaffForm = { email: "", password: "", firstName: "", lastName: "", phonenumber: "", role: "STAFF" };
const ROLE_LABEL = { ADMIN: "Админ", STAFF: "Ажилтан" } as const;

/** Ten characters with nothing that reads two ways (0/O, 1/l) when said over the phone. */
function generatePassword() {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const values = new Uint32Array(10);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join("");
}

export default function AdminStaffPage() {
  const queryClient = useQueryClient();
  const { email: myEmail } = useAuth();
  const { locale } = useI18n();
  const staff = useQuery<{ users: StaffUser[] }>({
    queryKey: ["admin", "staff"],
    queryFn: async () => (await api.get("/users")).data,
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [created, setCreated] = useState<{ email: string; password: string; loginUrl: string } | null>(null);

  const createMutation = useMutation({
    mutationFn: async (body: StaffForm) =>
      api.post("/users", {
        email: body.email.trim().toLowerCase(),
        password: body.password,
        firstName: body.firstName.trim() || undefined,
        lastName: body.lastName.trim() || undefined,
        phonenumber: body.phonenumber.trim() || undefined,
        role: body.role,
      }),
    onSuccess: (_, body) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "staff"] });
      setCreated({
        email: body.email.trim().toLowerCase(),
        password: body.password,
        loginUrl: `${window.location.origin}/${locale}/admin/log-in`,
      });
      toast.success("Ажилтан нэмэгдлээ");
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Ажилтан нэмэхэд алдаа гарлаа")),
  });

  function openDialog() {
    setForm({ ...EMPTY_FORM, password: generatePassword() });
    setErrors({});
    setCreated(null);
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setCreated(null);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const next: FormErrors = {};
    if (!form.email.trim()) next.email = "И-мэйл хаягаа оруулна уу";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = "И-мэйл хаяг буруу байна (жишээ нь: bat@uudam.mn)";
    if (form.password.length < 8) next.password = "Нууц үг дор хаяж 8 тэмдэгт байна";
    setErrors(next);
    if (Object.keys(next).length) return;
    createMutation.mutate(form);
  }

  function copy(text: string, label: string) {
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success(`${label} хууллаа`))
      .catch(() => toast.error("Хуулж чадсангүй"));
  }

  const users = staff.data?.users ?? [];

  return (
    <>
      <PageHeader
        title="Ажилтнууд"
        description="Энэ удирдлагын хэсэгт нэвтрэх эрхтэй хүмүүс. Шинэ ажилтан нэмэхдээ түр нууц үг өгнө. Тэр хүн дараа нь нэвтрэх хуудасны «Мартсан уу?» холбоосоор өөрийн нууц үгийг тохируулж болно."
        actions={
          <Button onClick={openDialog}>
            <Plus />
            Ажилтан нэмэх
          </Button>
        }
      />

      <Notice tone="info" icon={Info} className="mb-4">
        «Админ», «Ажилтан» хоёр одоогоор ижил эрхтэй — хоёулаа бүх хэсгийг харж, засах боломжтой. Ялгаа нь зөвхөн хэн нь хэн болохыг тэмдэглэх.
      </Notice>

      <Panel bodyClassName="p-0 sm:p-0">
        {staff.isPending ? (
          <LoadingRows rows={3} className="p-4" />
        ) : staff.isError ? (
          <ErrorState error={staff.error} onRetry={() => staff.refetch()} />
        ) : !users.length ? (
          <EmptyState icon={Users} title="Ажилтан алга" description="Ажилтан нэмбэл энд харагдана." />
        ) : (
          <ul className="divide-y divide-border">
            {users.map((user) => {
              const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
              const isMe = Boolean(myEmail) && myEmail?.toLowerCase() === user.email.toLowerCase();
              return (
                <li key={user.id} className="flex items-center gap-3 px-4 py-3.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold uppercase text-primary">
                    {(name || user.email).charAt(0) || <UserRound className="h-5 w-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold">{name || user.email}</span>
                      <StatusBadge tone={user.role === "ADMIN" ? "brand" : "neutral"}>{ROLE_LABEL[user.role]}</StatusBadge>
                      {isMe && <StatusBadge tone="success">Та</StatusBadge>}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {[name ? user.email : null, user.phonenumber, `Нэмсэн: ${formatDate(user.createdAt)}`].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Dialog open={open} onOpenChange={(next) => !next && close()}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          {created ? (
            <div className="grid gap-4">
              <DialogHeader className="text-left">
                <DialogTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  Ажилтан нэмэгдлээ
                </DialogTitle>
                <DialogDescription>Доорх нэвтрэх мэдээллийг тухайн ажилтанд дамжуулна уу. Энэ цонхыг хаасны дараа нууц үг дахин харагдахгүй.</DialogDescription>
              </DialogHeader>
              <dl className="grid gap-3 rounded-lg bg-muted/60 p-4 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Нэвтрэх хуудас</dt>
                  <dd className="break-all font-medium">{created.loginUrl}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">И-мэйл</dt>
                  <dd className="font-medium">{created.email}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Түр нууц үг</dt>
                  <dd className="font-mono text-base font-semibold tracking-wide">{created.password}</dd>
                </div>
              </dl>
              <DialogFooter className="gap-2 sm:space-x-0">
                <Button
                  variant="outline"
                  onClick={() =>
                    copy(
                      `Uudam админ хэсэг\nНэвтрэх: ${created.loginUrl}\nИ-мэйл: ${created.email}\nНууц үг: ${created.password}`,
                      "Нэвтрэх мэдээлэл",
                    )
                  }
                >
                  <Copy />
                  Бүгдийг хуулах
                </Button>
                <Button onClick={close}>Болсон</Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="grid gap-4">
              <DialogHeader className="text-left">
                <DialogTitle>Шинэ ажилтан</DialogTitle>
                <DialogDescription>Ажилтан энэ и-мэйл, түр нууц үгээр нэвтэрнэ.</DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField label="Нэр">
                  <Input value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} autoFocus />
                </FormField>
                <FormField label="Овог">
                  <Input value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} />
                </FormField>
              </div>

              <FormField label="И-мэйл" required error={errors.email} hint="Нэвтрэхдээ энэ хаягийг ашиглана.">
                <Input
                  type="email"
                  autoComplete="off"
                  value={form.email}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, email: e.target.value }));
                    setErrors((current) => ({ ...current, email: undefined }));
                  }}
                  placeholder="bat@uudam.mn"
                />
              </FormField>

              <FormField label="Утас" hint="Заавал биш.">
                <Input type="tel" value={form.phonenumber} onChange={(e) => setForm((f) => ({ ...f, phonenumber: e.target.value }))} placeholder="9911 2233" />
              </FormField>

              <FormField
                label="Түр нууц үг"
                required
                controlId="staff-password"
                error={errors.password}
                hint="Автоматаар үүсгэсэн. Хүсвэл өөрөө бичиж болно (дор хаяж 8 тэмдэгт)."
              >
                <div className="flex gap-2">
                  <Input
                    id="staff-password"
                    className="font-mono"
                    autoComplete="off"
                    aria-invalid={errors.password ? true : undefined}
                    aria-describedby={errors.password ? "staff-password-error" : "staff-password-hint"}
                    value={form.password}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, password: e.target.value }));
                      setErrors((current) => ({ ...current, password: undefined }));
                    }}
                  />
                  <Button type="button" variant="outline" onClick={() => setForm((f) => ({ ...f, password: generatePassword() }))} title="Шинэ нууц үг үүсгэх">
                    <KeyRound />
                    Шинэ
                  </Button>
                </div>
              </FormField>

              <FormField label="Эрх">
                <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as StaffForm["role"] }))} className={selectClassName}>
                  <option value="STAFF">Ажилтан</option>
                  <option value="ADMIN">Админ</option>
                </select>
              </FormField>

              <DialogFooter className="gap-2 sm:space-x-0">
                <Button type="button" variant="outline" onClick={close} disabled={createMutation.isPending}>
                  Болих
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="animate-spin" />}
                  Ажилтан нэмэх
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
