import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { ChannelLink } from "@/components/site/channels";
import { channel } from "@/lib/channels";
import { canonicalPath } from "@/lib/locales";

/**
 * The route for a visitor whose dates fit nothing on offer: a request for a
 * trip arranged around them. Photographed with a real trip's photo.
 */
export default function CustomTripBand({ title, body, image }: { title: string; body: string; image: string | null }) {
  const phone = channel("phone");
  return (
    <section aria-labelledby="custom-title" className="site-container pt-20 lg:pt-28">
      <div className="grid overflow-hidden rounded-xl border border-border bg-card lg:grid-cols-2">
        <div className="relative min-h-[260px] lg:min-h-[460px]">
          {image ? (
            <Image src={image} alt="" fill sizes="(max-width: 1024px) 100vw, 50vw" quality={70} className="object-cover" />
          ) : (
            <div className="absolute inset-0 bg-sand" />
          )}
        </div>
        <div className="flex flex-col justify-center p-8 sm:p-12 lg:p-16">
          <p className="eyebrow">Захиалгат аялал</p>
          <h2 id="custom-title" className="display-2 mt-4 text-balance text-foreground">{title}</h2>
          <p className="lede mt-5">{body}</p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href={canonicalPath("/custom-trip")}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-7 text-[15px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-ring"
            >
              Захиалгат аялал хүсэх
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            {phone && (
              <ChannelLink channelKey="phone" from="home-custom" className="link-draw rounded-sm text-[15px] font-semibold text-foreground focus-ring">
                эсвэл залгах: {phone.value}
              </ChannelLink>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
