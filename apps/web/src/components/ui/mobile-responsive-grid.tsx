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

const colMap: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
  6: "grid-cols-6",
}

const smColMap: Record<number, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
}

const mdColMap: Record<number, string> = {
  1: "md:grid-cols-1",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
}

const lgColMap: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
}

const xlColMap: Record<number, string> = {
  1: "xl:grid-cols-1",
  2: "xl:grid-cols-2",
  3: "xl:grid-cols-3",
  4: "xl:grid-cols-4",
}

export function ResponsiveGrid({
  children,
  cols = { sm: 1, md: 2, lg: 3, xl: 4 },
  gap = 6,
  className
}: ResponsiveGridProps) {
  const gridCols = [
    colMap[1], // Default mobile
    cols.sm && smColMap[cols.sm],
    cols.md && mdColMap[cols.md],
    cols.lg && lgColMap[cols.lg],
    cols.xl && xlColMap[cols.xl]
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