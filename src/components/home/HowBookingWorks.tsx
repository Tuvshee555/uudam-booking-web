import SectionHeading from "@/components/site/SectionHeading";

/**
 * The booking process exactly as the site and the office run it: an online
 * request holds seats for an hour, nothing is charged online, and a person
 * confirms the details and payment by phone.
 */
const STEPS = [
  { title: "Аяллаа сонгоно", text: "Өдөр тутмын хөтөлбөр, багцад багтсан ба ороогүй зүйлс, огноо бүрийн үнийг аяллын хуудаснаас харна." },
  { title: "Огноо, хүнээ сонгоно", text: "Том хүн, хүүхэд, нярайн тоог оруулахад тухайн огнооны үнээр нийт дүн шууд бодогдоно." },
  { title: "Захиалгаа илгээнэ", text: "Нэр, утсаа үлдээхэд суудал 60 минут таны нэр дээр түр хадгалагдана. Сайт дээр мөнгө төлөхгүй." },
  { title: "Ажилтан баталгаажуулна", text: "Манай ажилтан тантай холбогдож нөхцөл, төлбөрийн мэдээллийг тохирсны дараа захиалга баталгаажина." },
];

export default function HowBookingWorks() {
  return (
    <section aria-labelledby="how-title" className="site-container pt-20 lg:pt-28">
      <SectionHeading
        id="how-title"
        eyebrow="Захиалга"
        title="Захиалга хэрхэн явагддаг вэ"
        description="Онлайнаар сонгож, хүсэлтээ үлдээнэ — эцсийн нөхцөлийг хүн тань руу залгаж баталгаажуулна."
      />
      <ol className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, index) => (
          <li key={step.title} className="bg-card p-7 lg:p-8">
            <span className="numeral text-[2.8rem] leading-none text-gold-text">{String(index + 1).padStart(2, "0")}</span>
            <h3 className="mt-6 text-[17px] font-semibold text-foreground">{step.title}</h3>
            <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
