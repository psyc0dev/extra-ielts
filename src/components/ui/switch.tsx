import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"
import { motion } from "motion/react"
import { cn } from "@/lib/utils"

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  const [isChecked, setIsChecked] = React.useState(
    props.defaultChecked ?? (props.checked ?? false)
  )

  React.useEffect(() => {
    if (props.checked !== undefined) setIsChecked(props.checked)
  }, [props.checked])

  return (
    <SwitchPrimitive.Root
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
        className
      )}
      onCheckedChange={(val) => {
        setIsChecked(val)
        props.onCheckedChange?.(val)
      }}
      {...props}
    >
      <motion.span
        className="pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg"
        animate={{ x: isChecked ? 20 : 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
