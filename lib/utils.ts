import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const toISTDatetimeLocal = (dateString: string) => {
  const date = new Date(dateString)
  const istOffset = 5.5 * 60 * 60 * 1000
  const istDate = new Date(date.getTime() + istOffset)
  return istDate.toISOString().slice(0, 16)
}

export const statusColorsClassname = {
    todo: "border-blue-200 bg-blue-50",
    inprogress: "border-yellow-200 bg-yellow-50",
    done: "border-green-200 bg-green-50",
    blocked: "border-red-200 bg-red-50",
  }

export const statusColors = {
    todo: "#bfdbfe",
    inprogress: "#fef08a",
    done: "#bbf7d0",
    blocked: "#fecaca",
  }