'use client'

import { Card } from '@/components/ui/card'
import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  hint?: string
  accent?: 'primary' | 'accent' | 'muted'
}

export function StatCard({ label, value, icon: Icon, hint, accent = 'primary' }: StatCardProps) {
  const styles: Record<string, string> = {
    primary: 'bg-primary/10 text-primary',
    accent: 'bg-[#AEF544]/20 text-[#132999]',
    muted: 'bg-muted text-muted-foreground',
  }
  return (
    <Card className="card-shadow p-5 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">
            {label}
          </div>
          <div className="mt-2 text-3xl font-bold text-foreground tabular-nums">
            {value}
          </div>
          {hint && (
            <div className="mt-1 text-xs text-muted-foreground truncate">{hint}</div>
          )}
        </div>
        <div className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${styles[accent]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </Card>
  )
}
