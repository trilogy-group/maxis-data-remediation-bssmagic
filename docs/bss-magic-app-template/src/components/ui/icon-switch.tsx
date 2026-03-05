import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"
import { cn } from "@/lib/utils"

export interface IconSwitchProps extends React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> {
  uncheckedIcon?: React.ReactNode;
  checkedIcon?: React.ReactNode;
  usePrimaryAccent?: boolean;
}

const IconSwitch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  IconSwitchProps
>(({ className, uncheckedIcon, checkedIcon, usePrimaryAccent = false, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
      usePrimaryAccent 
        ? "data-[state=checked]:bg-accent data-[state=unchecked]:bg-primary" 
        : "data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0 flex items-center justify-center"
      )}
    >
      {/* Icon container that switches based on state */}
      <div className="w-3 h-3 flex items-center justify-center text-foreground">
        {props.checked ? checkedIcon : uncheckedIcon}
      </div>
    </SwitchPrimitives.Thumb>
  </SwitchPrimitives.Root>
))
IconSwitch.displayName = "IconSwitch"

export { IconSwitch }