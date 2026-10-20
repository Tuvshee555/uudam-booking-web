import { handler, httpError, json, rateLimit } from "@/server/http";
import { sendEmail } from "@/server/mail";
import { buildTripHealthReport } from "@/server/tripHealthReport";

export const dynamic = "force-dynamic";

function escape(value: string) {
  return value.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);
}

/**
 * Daily (vercel.json cron, 08:00 Ulaanbaatar): emails the office when a
 * published trip shows a customer-facing error, so problems are found before
 * customers find them. Vercel sends CRON_SECRET as a bearer token when it is
 * set; without it only Vercel's cron agent is accepted, at most hourly.
 */
export const GET = handler(async (req: Request) => {
  const secret = process.env.CRON_SECRET;
  if (secret ? req.headers.get("authorization") !== `Bearer ${secret}` : !/^vercel-cron\//.test(req.headers.get("user-agent") || "")) {
    throw httpError(401, "Unauthorized");
  }
  rateLimit("cron:trip-health", { windowMs: 3_600_000, max: 1 });

  const report = await buildTripHealthReport();
  const to = process.env.ENQUIRY_NOTIFY_EMAIL || process.env.SMTP_USER;
  let emailed = false;
  if (report.errors > 0 && to) {
    const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://uudamtravel.mn").replace(/\/$/, "");
    const rows = report.issues.filter((issue) => issue.severity === "error").map((issue) =>
      `<li><b>${escape(issue.title)}</b> — ${escape(issue.message)} <a href="${site}/mn/admin/trips/${issue.tripId}/edit">засах</a></li>`).join("");
    await sendEmail({
      to,
      subject: `Сайтын шалгалт: ${report.errors} алдаа илэрлээ`,
      html: `<p>Өнөөдрийн автомат шалгалтаар нийтэд харагдаж буй аяллуудад ${report.errors} алдаа, ${report.warnings} анхааруулга илэрлээ.</p><ul>${rows}</ul><p><a href="${site}/mn/admin/health">Бүгдийг харах</a></p>`,
    }).then(() => { emailed = true; }).catch((error) => console.error("Trip health email failed", error));
  }
  return json({ errors: report.errors, warnings: report.warnings, fingerprint: report.fingerprint, emailed });
});
