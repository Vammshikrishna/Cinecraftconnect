import { cn } from "@/lib/utils"
import { ReactNode } from "react"

interface ResponsiveGridProps {
  children: ReactNode
  cols?: {
    sm?: number
    md?: number
    lg?: number
    xl?: number
  }
  gap?: number
  className?: string
}

export function ResponsiveGrid({
  children,
  cols = { sm: 1, md: 2, lg: 3, xl: 4 },
  gap = 6,
  className
}: ResponsiveGridProps) {
  const gridCols = [
    `grid-cols-${cols.sm || 1}`,
    cols.md && `md:grid-cols-${cols.md}`,
    cols.lg && `lg:grid-cols-${cols.lg}`,
    cols.xl && `xl:grid-cols-${cols.xl}`
  ].filter(Boolean).join(" ")

  return (
    <div className={cn(
      "grid",
      gridCols,
      `gap-${gap}`,
      className
    )}>
      {children}
    </div>
  )
}

interface MobileStackProps {
  children: ReactNode
  className?: string
  stackBelow?: "sm" | "md" | "lg"
}

export function MobileStack({
  children,
  className,
  stackBelow = "md"
}: MobileStackProps) {
  const stackClass = stackBelow === "sm" ? "sm:flex-col" :
                    stackBelow === "md" ? "md:flex-col" :
                    "lg:flex-col"

  return (
    <div className={cn(
      "flex flex-col",
      `${stackBelow}:flex-row`,
      className
    )}>
      {children}
    </div>
  )
}