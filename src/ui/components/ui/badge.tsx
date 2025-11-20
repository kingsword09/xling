import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/ui/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center border-2 border-neo-black px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 shadow-neo-sm",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-neo-black text-white hover:bg-neo-black/80",
        secondary:
          "border-transparent bg-neo-green text-black hover:bg-neo-green/80",
        destructive:
          "border-transparent bg-neo-red text-white hover:bg-neo-red/80",
        outline: "text-foreground",
        neo: "bg-neo-yellow text-black hover:bg-neo-yellow/80",
        active: "bg-neo-green text-black hover:bg-neo-green/80",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
