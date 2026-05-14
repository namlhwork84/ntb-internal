import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, differenceInDays, parseISO } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'dd/MM/yyyy')
}

export function daysUntilDue(dueDate: string | null | undefined): number | null {
  if (!dueDate) return null
  return differenceInDays(parseISO(dueDate), new Date())
}

export function isDeadlineSoon(dueDate: string | null | undefined): boolean {
  const days = daysUntilDue(dueDate)
  return days !== null && days >= 0 && days <= 3
}

export function isOverdue(dueDate: string | null | undefined): boolean {
  const days = daysUntilDue(dueDate)
  return days !== null && days < 0
}
