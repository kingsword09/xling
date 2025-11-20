import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/ui/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 neo-btn",
  {
    variants: {
      variant: {
        default: "bg-neo-purple text-black hover:bg-neo-purple/90",
        destructive: "bg-neo-red text-white hover:bg-neo-red/90",
        outline: "bg-neo-white hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-neo-green text-black hover:bg-neo-green/80",
        ghost:
          "shadow-none border-transparent hover:bg-accent hover:text-accent-foreground hover:shadow-none active:translate-x-0 active:translate-y-0",
        link: "text-primary underline-offset-4 hover:underline shadow-none border-none active:translate-x-0 active:translate-y-0",
        neo: "bg-neo-yellow text-black hover:bg-neo-yellow/90",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
