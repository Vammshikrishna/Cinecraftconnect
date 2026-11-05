import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import * as React from "react"
import { useToast } from "@/hooks/use-toast"

export function Toaster() {
  const { toasts } = useToast()
  // on phones toasts enter from the top, so they are swiped away upward; from sm up they sit bottom-right
  const [swipeDirection, setSwipeDirection] = React.useState<"up" | "right">(() =>
    typeof window !== "undefined" && window.matchMedia?.("(min-width: 640px)").matches ? "right" : "up"
  )
  React.useEffect(() => {
    if (!window.matchMedia) return
    const mq = window.matchMedia("(min-width: 640px)")
    const on = () => setSwipeDirection(mq.matches ? "right" : "up")
    mq.addEventListener("change", on)
    return () => mq.removeEventListener("change", on)
  }, [])

  return (
    <ToastProvider swipeDirection={swipeDirection}>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
