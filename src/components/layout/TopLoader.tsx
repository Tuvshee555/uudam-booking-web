"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import NProgress from "nprogress";

NProgress.configure({ showSpinner: false, trickleSpeed: 120, minimum: 0.2 });

/**
 * Thin gold progress bar on route changes. Styled inline so it can't drift
 * from the brand tokens the way a separate nprogress stylesheet would.
 */
export default function TopLoader() {
  const pathname = usePathname();

  useEffect(() => {
    NProgress.done();
    return () => {
      NProgress.start();
    };
  }, [pathname]);

  return (
    <style jsx global>{`
      #nprogress {
        pointer-events: none;
      }
      #nprogress .bar {
        position: fixed;
        top: 0;
        left: 0;
        z-index: 60;
        height: 3px;
        width: 100%;
        background: hsl(var(--uudam-gold));
      }
      #nprogress .peg {
        display: block;
        position: absolute;
        right: 0;
        width: 100px;
        height: 100%;
        box-shadow:
          0 0 10px hsl(var(--uudam-gold)),
          0 0 5px hsl(var(--uudam-gold));
        opacity: 1;
        transform: rotate(3deg) translate(0px, -4px);
      }
    `}</style>
  );
}
