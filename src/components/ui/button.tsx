import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        // Storefront. The gold is the logo's sun: the one call to act on a page.
        gold:
          "rounded-full bg-gold font-semibold text-navy-night shadow-sm hover:bg-[hsl(41_88%_55%)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        ink:
          "rounded-full bg-primary font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        light:
          "rounded-full bg-white font-semibold text-navy-night hover:bg-white/90 focus-visible:ring-2 focus-visible:ring-gold",
        outlineLight:
          "rounded-full border border-white/45 bg-white/5 font-semibold text-white backdrop-blur-sm hover:bg-white hover:text-navy-night focus-visible:ring-2 focus-visible:ring-gold",
        quiet:
          "rounded-full border border-border bg-card font-semibold text-foreground hover:border-foreground/35 hover:bg-card focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
        // Storefront sizes leave the corner radius to the variant.
        site: "h-11 px-6 text-sm",
        siteSm: "h-9 px-4 text-[13px]",
        siteLg: "h-12 px-7 text-[15px]",
        siteIcon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
