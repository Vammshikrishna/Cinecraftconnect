import { cn } from "@/lib/utils"
import { CheckCircle2, Circle } from "lucide-react"

interface Step {
  id: string
  title: string
  description?: string
  completed: boolean
  current?: boolean
}

interface ProgressIndicatorProps {
  steps: Step[]
  orientation?: "horizontal" | "vertical"
  className?: string
}

export function ProgressIndicator({
  steps,
  orientation = "horizontal",
  className
}: ProgressIndicatorProps) {
  const completedSteps = steps.filter(step => step.completed).length
  const totalSteps = steps.length
  const progressPercentage = (completedSteps / totalSteps) * 100

  if (orientation === "horizontal") {
    return (
      <div className={cn("w-full space-y-4", className)}>
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-foreground">
            Progress
          </span>
          <span className="text-sm text-muted-foreground">
            {completedSteps} of {totalSteps} completed
          </span>
        </div>
        
        <div className="relative">
          <div className="flex justify-between">
            {steps.map((step, index) => (
              <div key={step.id} className="flex flex-col items-center flex-1">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300",
                  step.completed
                    ? "bg-primary border-primary text-primary-foreground"
                    : step.current
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-muted-foreground/30 bg-background text-muted-foreground"
                )}>
                  {step.completed ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <Circle className="w-4 h-4" />
                  )}
                </div>
                <div className="mt-2 text-center">
                  <p className={cn(
                    "text-xs font-medium",
                    step.completed || step.current
                      ? "text-foreground"
                      : "text-muted-foreground"
                  )}>
                    {step.title}
                  </p>
                  {step.description && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {step.description}
                    </p>
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div className={cn(
                    "absolute top-4 h-0.5 transition-colors duration-300",
                    "left-1/2 transform translate-x-4",
                    step.completed ? "bg-primary" : "bg-muted-foreground/30"
                  )} style={{ width: `calc(100% / ${steps.length} - 2rem)` }} />
                )}
              </div>
            ))}
          </div>
        </div>
        
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-start space-x-3">
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300",
            step.completed
              ? "bg-primary border-primary text-primary-foreground"
              : step.current
              ? "border-primary bg-primary/10 text-primary"
              : "border-muted-foreground/30 bg-background text-muted-foreground"
          )}>
            {step.completed ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <Circle className="w-4 h-4" />
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <p className={cn(
              "text-sm font-medium",
              step.completed || step.current
                ? "text-foreground"
                : "text-muted-foreground"
            )}>
              {step.title}
            </p>
            {step.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {step.description}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}