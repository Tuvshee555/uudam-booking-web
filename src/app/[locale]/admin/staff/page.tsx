"use client";

import { useQuery } from "@tanstack/react-query";
import { Info, UserRound, Users } from "lucide-react";

import { api } from "@/lib/api";
import { useAuth } from "@/app/[locale]/provider/AuthProvider";
import { EmptyState, ErrorState, LoadingRows, Notice, PageHeader, Panel, StatusBadge } from "@/components/admin/ui";
import { formatDate } from "@/lib/adminFormat";

type StaffUser = {
  id: string;
  email: string;
  role: "ADMIN" | "STAFF";
  firstName: string | null;
  lastName: string | null;
  phonenumber: string | null;
  createdAt: string;
  canSignIn: boolean;
};

type Row = { email: string; user: StaffUser | null; canSignIn: boolean };

/**
 * Who can sign in. Google-only: the list lives in ADMIN_GOOGLE_EMAILS (Vercel env), not in this
 * screen, so nobody inside the panel can grant access — not even with a stolen session.
 */
export default function AdminStaffPage() {
  const { email: myEmail } = useAuth();
  const staff = useQuery<{ allowedEmails: string[]; users: StaffUser[] }>({
    queryKey: ["admin", "staff"],
    queryFn: async () => (await api.get("/users")).data,
  });

  const allowed = staff.data?.allowedEmails ?? [];
  const users = staff.data?.users ?? [];
  const byEmail = new Map(users.map((user) => [user.email.toLowerCase(), user]));
  const rows: Row[] = [
    ...allowed.map((email) => ({ email, user: byEmail.get(email) ?? null, canSignIn: true })),
    ...users.filter((user) => !user.canSignIn).map((user) => ({ email: user.email, user, canSignIn: false })),
  ];

  return (
    <>
      <PageHeader
        title="Ажилтнууд"
        description="Удирдлагын хэсэгт зөвхөн доорх Gmail хаягаар «Google-ээр нэвтрэх» боломжтой. Нууц үг байхгүй."
      />

      <Notice tone="info" icon={Info} className="mb-4">
        Шинэ ажилтан нэмэх эсвэл хасах бол хөгжүүлэгчид Gmail хаягийг нь хэлнэ үү. Аюулгүй байдлын үүднээс энэ жагсаалтыг
        удирдлагын хэсгээс өөрчлөх боломжгүй — хаягийг хасмагц тэр хүн шууд гарна.
      </Notice>

      <Panel bodyClassName="p-0 sm:p-0">
        {staff.isPending ? (
          <LoadingRows rows={3} className="p-4" />
        ) : staff.isError ? (
          <ErrorState error={staff.error} onRetry={() => staff.refetch()} />
        ) : !rows.length ? (
          <EmptyState icon={Users} title="Жагсаалт хоосон" description="ADMIN_GOOGLE_EMAILS тохируулаагүй байна." />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map(({ email, user, canSignIn }) => {
              const name = user ? [user.firstName, user.lastName].filter(Boolean).join(" ") : "";
              const isMe = Boolean(myEmail) && myEmail?.toLowerCase() === email.toLowerCase();
              return (
                <li key={email} className="flex items-center gap-3 px-4 py-3.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold uppercase text-primary">
                    {(name || email).charAt(0) || <UserRound className="h-5 w-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold">{name || email}</span>
                      {canSignIn ? (
                        <StatusBadge tone="brand">Google нэвтрэх эрхтэй</StatusBadge>
                      ) : (
                        <StatusBadge tone="neutral">Эрхгүй (хуучин бүртгэл)</StatusBadge>
                      )}
                      {isMe && <StatusBadge tone="success">Та</StatusBadge>}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {[
                        name ? email : null,
                        user?.phonenumber,
                        user ? `Анх нэвтэрсэн/нэмсэн: ${formatDate(user.createdAt)}` : canSignIn ? "Одоогоор нэвтэрч байгаагүй" : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </>
  );
}
