import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { CheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer relative flex size-11 shrink-0 items-center justify-center rounded-md border-0 bg-transparent text-primary-foreground shadow-none outline-none before:absolute before:size-4 before:rounded-[4px] before:border before:border-input before:bg-background before:shadow-xs data-[state=checked]:before:border-primary data-[state=checked]:before:bg-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 aria-invalid:before:border-destructive disabled:cursor-not-allowed disabled:opacity-50 md:size-4 md:rounded-[4px] dark:before:bg-input/30 dark:data-[state=checked]:before:bg-primary dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="relative z-10 flex size-4 items-center justify-center text-current transition-none"
      >
        <CheckIcon className="size-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
