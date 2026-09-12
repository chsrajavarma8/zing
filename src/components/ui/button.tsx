import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

// Shared animated button system - one light theme, burgundy/cream/ivory/rose.
// Hover/press: 200ms (within the 150-220ms band). Variants map onto the
// existing call-site names (`default`, `outline`, `secondary`, `ghost`,
// `destructive`, `link`) used across ~150 existing usages, restyled to the
// spec's Primary/Secondary/Text-action/Icon/Destructive intents rather than
// renamed, so no call site needs to change.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all duration-200 ease-out outline-none select-none active:not-aria-[haspopup]:translate-y-px active:not-aria-[haspopup]:scale-[0.98] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='size-'])]:transition-transform [&_svg:not([class*='size-'])]:duration-200",
  {
    variants: {
      variant: {
        // PRIMARY - burgundy fill, ivory text, elevation on hover.
        default: "bg-primary text-primary-foreground shadow-sm hover:bg-[#6b001a] hover:shadow-md hover:-translate-y-0.5",
        // SECONDARY - cream surface, burgundy border, restrained fill shift.
        secondary: "border-primary/35 bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--burgundy)_8%)]",
        // Bordered-transparent alternative to secondary (same family, starts
        // on the page background rather than cream).
        outline: "border-primary/40 bg-background text-foreground hover:bg-secondary aria-expanded:bg-secondary",
        // ICON BUTTON base - clear hover surface, no border by default.
        ghost: "hover:bg-accent hover:text-accent-foreground aria-expanded:bg-accent aria-expanded:text-accent-foreground",
        // DESTRUCTIVE - solid, unmistakable, never blends in as a soft tint.
        destructive: "bg-destructive text-ivory shadow-sm hover:bg-[#8f1c2a] hover:shadow-md",
        // TEXT ACTION - animated underline that grows in from the left.
        link: "px-0 text-primary underline-offset-4 bg-[linear-gradient(currentColor,currentColor)] bg-no-repeat bg-left-bottom bg-[length:0%_1.5px] hover:bg-[length:100%_1.5px] transition-[background-size,transform] duration-200 active:!translate-y-0 active:!scale-100 [&_svg]:group-hover/button:translate-x-0.5",
      },
      size: {
        default:
          "h-9 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-2 px-5 text-[0.95rem] has-data-[icon=inline-end]:pr-3.5 has-data-[icon=inline-start]:pl-3.5",
        icon: "size-9",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-8 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
