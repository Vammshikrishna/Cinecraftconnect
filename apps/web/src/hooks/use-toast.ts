import * as React from "react"

import { ToastAction } from "@/components/ui/toast"
import type { ToastActionElement, ToastProps } from "@/components/ui/toast"

// three at once is plenty; a closed toast is cleared a moment after its exit animation
const TOAST_LIMIT = 3
const TOAST_REMOVE_DELAY = 1000

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const

let count = 0

function genId() {
  count = (count + 1) % Number.MAX_VALUE
  return count.toString()
}

type ActionType = typeof actionTypes

type Action = 
  | { type: ActionType["ADD_TOAST"]; toast: ToasterToast }
  | { type: ActionType["UPDATE_TOAST"]; toast: Partial<ToasterToast> }
  | { type: ActionType["DISMISS_TOAST"]; toastId?: ToasterToast["id"] }
  | { type: ActionType["REMOVE_TOAST"]; toastId?: ToasterToast["id"] }

interface State {
  toasts: ToasterToast[]
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({ type: "REMOVE_TOAST", toastId })
  }, TOAST_REMOVE_DELAY)

  toastTimeouts.set(toastId, timeout)
}

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) => 
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      }

    case "DISMISS_TOAST": {
      const { toastId } = action

      if (toastId) {
        addToRemoveQueue(toastId)
      } else {
        state.toasts.forEach(toast => {
          addToRemoveQueue(toast.id)
        })
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      }
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        }
      }
      return {
        ...state,
        toasts: state.toasts.filter(t => t.id !== action.toastId),
      }
  }
}

const listeners: Array<(state: State) => void> = []

let memoryState: State = { toasts: [] }

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach(listener => {
    listener(memoryState)
  })
}

type Toast = Omit<ToasterToast, "id">

const text = (n: React.ReactNode) => (typeof n === "string" ? n : "")

/** "Error" and "Success" on their own say nothing: say what the message is about instead. */
function normalize(props: Toast): Toast {
  let { title, description } = props
  const t = text(title).trim().toLowerCase().replace(/[!.]+$/, "")
  if (t === "success" && text(description)) {
    title = description as any
    description = undefined
  } else if (t === "error" || t === "operation failed") {
    title = "Something went wrong"
  }
  return { ...props, title, description }
}

/** Long messages stay longer, errors stay longer still, and a message with a button (Undo) stays longest. */
function autoDuration(props: Toast): number {
  const length = text(props.title).length + text(props.description).length
  let ms = Math.min(10000, Math.max(4000, 3000 + length * 45))
  if (props.variant === "destructive") ms = Math.max(ms, 7000)
  if (props.action) ms = Math.max(ms, 8000)
  return ms
}

function baseToast(input: Toast) {
  const props = normalize(input)
  const id = genId()

  // the same message is already on screen: do not stack a copy of it
  const same = memoryState.toasts.find(
    (t) => t.open !== false && text(t.title) === text(props.title) && text(t.description) === text(props.description) && t.variant === props.variant
  )
  if (same) {
    return {
      id: same.id,
      dismiss: () => dispatch({ type: "DISMISS_TOAST", toastId: same.id }),
      update: (p: ToasterToast) => dispatch({ type: "UPDATE_TOAST", toast: { ...p, id: same.id } }),
    }
  }

  const update = (props: ToasterToast) => dispatch({ type: "UPDATE_TOAST", toast: { ...props, id } })
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id })

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      duration: props.duration ?? autoDuration(props),
      id,
      open: true,
      onOpenChange: (open: boolean) => {
        if (!open) dismiss()
      },
    },
  })

  return {
    id: id,
    dismiss,
    update,
  }
}

type Extra = Partial<Pick<Toast, "duration" | "action">>

/**
 * toast({ title, description, variant })        the general form
 * toast.success("Saved")  toast.error("Could not save", reason)  toast.warning(...)  toast.info(...)
 * toast.undo("Muted @sam", () => unmute())       a message with an Undo button
 */
const toast = Object.assign(baseToast, {
  success: (title: string, description?: React.ReactNode, extra?: Extra) => baseToast({ title, description, variant: "success", ...extra }),
  error: (title: string, description?: React.ReactNode, extra?: Extra) => baseToast({ title, description, variant: "destructive", ...extra }),
  warning: (title: string, description?: React.ReactNode, extra?: Extra) => baseToast({ title, description, variant: "warning", ...extra }),
  info: (title: string, description?: React.ReactNode, extra?: Extra) => baseToast({ title, description, variant: "info", ...extra }),
  /** A message that stays until it is dismissed (for work in progress). Returns its id. */
  loading: (title: string) => baseToast({ title, duration: 600000 }).id,
  dismiss: (id?: string) => dispatch({ type: "DISMISS_TOAST", toastId: id }),
  undo: (title: string, onUndo: () => void, description?: React.ReactNode) =>
    baseToast({
      title,
      description,
      action: React.createElement(ToastAction, { altText: "Undo", onClick: onUndo }, "Undo") as unknown as ToastActionElement,
    }),
})

function useToast() {
  const [state, setState] = React.useState<State>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [state])

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  }
}

export { useToast, toast }