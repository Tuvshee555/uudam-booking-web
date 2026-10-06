"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Check, RefreshCw } from "lucide-react";
import { api, apiErrorMessage } from "@/lib/api";
import type { Trip } from "@/types/trip";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import StringListField from "./StringListField";
import { comparablePriceGroups } from "@/lib/tripComparison";

type Row = Record<string, unknown>;
const object = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const labels: Record<string, string> = { aliases: "Өөр нэршил", discounts: "Хямдрал", extra_fees: "Нэмэлт төлбөр", room_prices: "Өрөөний үнэ", booking_terms: "Захиалгын нөхцөл", deposit: "Урьдчилгаа", payment: "Төлбөр", documents: "Бичиг баримт", visa: "Виз", cancellation: "Цуцлалт", label: "Нэр", amount: "Дүн", price: "Үнэ", currency: "Валют", note: "Тэмдэглэл", dates: "Огноо", hotel: "Буудал", condition: "Нөхцөл", age_range: "Нас", applies_to: "Хамаарах зорчигч", room_type: "Өрөө", transport_type: "Тээврийн төрөл", destinations: "Очих газрууд", answer_hints: "Хариултын заавар", needs_human_review: "Шалгалт шаардлагатай", review_reasons: "Шалгах шалтгаан" };
function Value({ value }: { value: unknown }) {
  if (value == null || value === "" || (Array.isArray(value) && !value.length)) return <span className="text-muted-foreground">—</span>;
  if (Array.isArray(value)) return <ul className="space-y-2">{value.map((item, i) => <li key={i}><Value value={item} /></li>)}</ul>;
  if (typeof value === "object") return <dl className="space-y-1">{Object.entries(object(value)).filter(([, item]) => item != null && item !== "").map(([key, item]) => <div key={key}><dt className="text-xs text-muted-foreground">{labels[key] || key}</dt><dd><Value value={item} /></dd></div>)}</dl>;
  return <span className="whitespace-pre-wrap break-words">{typeof value === "boolean" ? value ? "Тийм" : "Үгүй" : String(value)}</span>;
}
function PriceGroups({ value }: { value: unknown }) {
  const groups = comparablePriceGroups(value);
  const fare = (value: number | null, currency: string) => value === null ? "—" : `${value.toLocaleString("mn-MN")} ${currency === "MNT" ? "₮" : currency}`;
  return <div className="divide-y divide-border">{groups.map((group, index) => <div key={index} className="space-y-1 py-2 text-xs">
    <p className="font-medium">{group.dates.join(", ") || "Үндсэн үнэ"}{group.package && ` · ${group.package}`}</p>
    {group.label && <p>{group.label}</p>}
    {group.note && group.note !== group.package && <p>{group.note}</p>}
    {group.hotel && <p>{group.hotel}</p>}
    <p>Том хүн: {fare(group.adult, group.currency)}</p>
    {group.passengers.map((row, index) => <p key={index}>{row.label}{row.age && ` (${row.age})`}: {fare(row.price, row.currency)}{row.note && ` · ${row.note}`}</p>)}
    {group.child !== null && (!group.passengers.length || !group.passengers.some((row) => row.price === group.child && row.age === group.childAge)) && <p>Хүүхэд{group.childAge && ` (${group.childAge})`}: {fare(group.child, group.currency)}</p>}
    {group.infant !== null && (!group.passengers.length || !group.passengers.some((row) => row.price === group.infant && row.age === group.infantAge)) && <p>Нярай{group.infantAge && ` (${group.infantAge})`}: {fare(group.infant, group.currency)}</p>}
  </div>)}</div>;
}
export default function TripComparison({ trip, patch, onExtraChange }: { trip: Trip; patch: unknown; onExtraChange: (base: Row, values: Row) => void }) {
  const [differencesOnly, setDifferencesOnly] = useState(false);
  const query = useQuery({ queryKey: ["trip-parity", trip.id], queryFn: async () => (await api.get("/admin/trip-parity", { params: { id: trip.id } })).data as { website: Trip; chatbot: Row | null } });
  if (query.isPending) return <p className="text-sm text-muted-foreground" role="status">Харьцуулалт ачаалж байна…</p>;
  if (query.isError) return <div role="alert" className="text-sm text-destructive">{apiErrorMessage(query.error, "Харьцуулалт ачаалсангүй")} <Button type="button" variant="outline" size="sm" onClick={() => query.refetch()}>Дахин ачаалах</Button></div>;
  const { website, chatbot } = query.data;
  if (!chatbot) return <p className="text-sm text-destructive">Chatbot аялал холбогдоогүй.</p>;
  const extra = object(chatbot.extra);
  const edits = object(object(patch).values);
  const editableTerms = object(edits.booking_terms ?? extra.booking_terms);
  const rows = [
    { label: "Аяллын нэр", website: website.title, chatbot: chatbot.route_name },
    { label: "Тайлбар", website: website.description, chatbot: chatbot.notes },
    { label: "Товч тайлбар", website: website.summary, chatbot: extra.website_summary },
    { label: "Буудал", website: website.hotel, chatbot: chatbot.hotel },
    { label: "Багтсан зүйлс", website: website.included, chatbot: extra.included_items },
    { label: "Багтаагүй зүйлс", website: website.excluded, chatbot: extra.excluded_items },
    { label: "Чухал тэмдэглэл", website: website.importantNotes, chatbot: extra.important_notes },
    { label: "Том хүний үндсэн үнэ", website: website.price, chatbot: chatbot.adult_price },
    { label: "Хүүхдийн үндсэн үнэ", website: website.childPrice, chatbot: chatbot.child_price },
    { label: "Нярайн үндсэн үнэ", website: website.infantPrice, chatbot: chatbot.infant_price },
    { label: "Валют", website: website.currency, chatbot: chatbot.currency },
    { label: "Үнийн хувилбарууд", website: website.sourceMetadata?.price_groups, chatbot: extra.price_groups },
  ];
  const equal = (row: typeof rows[number]) => row.label === "Үнийн хувилбарууд"
    ? JSON.stringify(comparablePriceGroups(row.website)) === JSON.stringify(comparablePriceGroups(row.chatbot))
    : JSON.stringify(row.website ?? "") === JSON.stringify(row.chatbot ?? "");
  const differences = rows.filter((row) => !equal(row));
  return <div className="space-y-5 min-w-0">
    <div className="flex items-center justify-between gap-3 text-sm"><span className="inline-flex items-center gap-2">{differences.length ? <AlertCircle className="h-4 w-4 text-amber-600" /> : <Check className="h-4 w-4 text-emerald-600" />}{differences.length ? `${differences.length} ялгаатай талбар` : "Үндсэн мэдээлэл ижил"}</span><Button type="button" size="icon" variant="ghost" title="Харьцуулалт шинэчлэх" aria-label="Харьцуулалт шинэчлэх" onClick={() => query.refetch()}><RefreshCw className="h-4 w-4" /></Button></div>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={differencesOnly} onChange={(event) => setDifferencesOnly(event.target.checked)} className="h-4 w-4 accent-primary" />Зөвхөн ялгаатай мэдээлэл</label>
    {(differencesOnly ? differences : rows).map((row) => <details key={row.label} open={!equal(row)} className="border-t border-border"><summary className="cursor-pointer py-3 text-sm font-medium">{row.label}<span className={`ml-3 text-xs ${equal(row) ? "text-muted-foreground" : "text-amber-700"}`}>{equal(row) ? "Ижил" : "Ялгаатай"}</span></summary><div className="grid min-w-0 gap-4 pb-4 text-sm sm:grid-cols-2"><div className="min-w-0"><p className="mb-1 text-xs font-medium text-muted-foreground">Вебсайт</p>{row.label === "Үнийн хувилбарууд" ? <PriceGroups value={row.website} /> : <Value value={row.website} />}</div><div className="min-w-0"><p className="mb-1 text-xs font-medium text-muted-foreground">Chatbot</p>{row.label === "Үнийн хувилбарууд" ? <PriceGroups value={row.chatbot} /> : <Value value={row.chatbot} />}</div></div></details>)}
    {differencesOnly && !differences.length && <p className="text-sm text-muted-foreground">Ялгаатай мэдээлэл байхгүй.</p>}
    {[...(Array.isArray(extra.shared_conflicts) ? extra.shared_conflicts : []), ...(Array.isArray(website.sourceMetadata?.contentConflicts) ? website.sourceMetadata.contentConflicts : [])].map((entry, index) => {
      const conflict = object(entry);
      return <section key={`conflict-${index}`} className="border-t border-border pt-3 text-sm"><h3 className="mb-2 font-medium text-amber-700">{String(conflict.field || "Шалгах зөрүү")}</h3><div className="grid min-w-0 gap-4 sm:grid-cols-2"><div className="min-w-0"><p className="mb-1 text-xs text-muted-foreground">Вебсайт</p><Value value={conflict.website} /></div><div className="min-w-0"><p className="mb-1 text-xs text-muted-foreground">Chatbot</p><Value value={conflict.chatbot} /></div></div></section>;
    })}
    <h3 className="border-t border-border pt-5 text-sm font-semibold">Chatbot нэмэлт мэдээлэл</h3>
    <StringListField label="Өөр нэршил" values={Array.isArray(edits.aliases ?? extra.aliases) ? (edits.aliases ?? extra.aliases) as string[] : []} onChange={(aliases) => onExtraChange(extra, { ...edits, aliases })} />
    <section className="border-t border-border pt-4"><h4 className="mb-3 text-sm font-semibold">Захиалгын нөхцөл</h4><div className="grid gap-3 sm:grid-cols-2">{["deposit", "payment", "documents", "visa", "cancellation"].map((key) => <label key={key} className="text-sm"><span className="mb-1 block font-medium">{labels[key]}</span><Textarea value={typeof editableTerms[key] === "string" ? editableTerms[key] as string : ""} rows={2} onChange={(event) => onExtraChange(extra, { ...edits, booking_terms: { ...editableTerms, [key]: event.target.value } })} /></label>)}</div></section>
    {Object.entries(labels).filter(([key]) => key in extra && !["aliases", "booking_terms"].includes(key)).map(([key, label]) => <section key={key} className="border-t border-border pt-3 text-sm"><h4 className="mb-2 font-medium">{label}</h4><Value value={extra[key]} /></section>)}
  </div>;
}
