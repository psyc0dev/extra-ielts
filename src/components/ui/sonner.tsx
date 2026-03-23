import React from "react"
import { CheckCircle, Info, AlertTriangle, XOctagon, Loader } from "lucide-react"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      position="top-center"
      closeButton
      icons={{
        success: <CheckCircle className="h-4 w-4" />,
        info: <Info className="h-4 w-4" />,
        warning: <AlertTriangle className="h-4 w-4" />,
        error: <XOctagon className="h-4 w-4" />,
        loading: <Loader className="h-4 w-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast: "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:rounded-xl !transition-all !duration-300 !ease-[cubic-bezier(0.34,1.56,0.64,1)]",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      style={{
        "--toast-enter-animation": "toast-enter 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards",
        "--toast-exit-animation": "toast-exit 0.25s ease-in forwards",
      } as React.CSSProperties}
      {...props}
    />
  )
}

export { Toaster }
