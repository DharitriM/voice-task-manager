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

export const statusColors = {
  todo: "#bfdbfe",
  inprogress: "#fef08a",
  done: "#bbf7d0",
  blocked: "#fecaca",
}