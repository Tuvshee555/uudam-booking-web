import type { Metadata } from "next";
import { Compass, Globe2, HeartHandshake, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Бидний тухай",
  description: "Uudam Travel Agency — аяллын мэргэжлийн баг.",
};

const VALUES = [
  {
    icon: Globe2,
    title: "Гадаад, дотоод аялал",
    text: "Ази, Европ болон Монголын өнцөг булан бүрт багц аялал зохион байгуулна.",
  },
  {
    icon: Compass,
    title: "Мэргэжлийн хөтөч",
    text: "Чиглэл бүрийг сайн мэддэг, туршлагатай хөтөч аяллын турш дагалдана.",
  },
  {
    icon: ShieldCheck,
    title: "Ил тод үнэ",
    text: "Багцад юу багтсан, юу ороогүйг урьдчилан бүрэн харуулна. Нуугдмал төлбөр байхгүй.",
  },
  {
    icon: HeartHandshake,
    title: "Хувийн хандлага",
    text: "Гэр бүл, найз нөхөд, байгууллагын багт тохируулсан хөтөлбөр гаргана.",
  },
];

export default function AboutPage() {
  return (
    <div>
      <section className="border-b border-border bg-secondary/30">
        <div className="uudam-container py-16 md:py-20">
          <span className="uudam-eyebrow">Uudam Travel Agency</span>
          <h1 className="mt-3 max-w-2xl text-3xl font-bold leading-tight tracking-tight text-foreground md:text-4xl">
            Аялал бол зөвхөн газар биш — тэнд өнгөрүүлэх цаг
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Бид аяллын багцыг зохион байгуулж, тийз, буудал, хөтөлбөр, хөтчийг нэг дор
            шийдэж өгдөг. Та зөвхөн аяллаа мэдэрхэд л анхаарна.
          </p>
        </div>
      </section>

      <section className="uudam-container py-14">
        <div className="grid gap-6 sm:grid-cols-2">
          {VALUES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-border p-6">
              <span className="inline-flex rounded-xl bg-primary/10 p-3 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <h2 className="mt-4 text-lg font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
