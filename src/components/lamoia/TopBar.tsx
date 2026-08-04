'use client'

import { Menu } from 'lucide-react'
import Image from 'next/image'

export function TopBar({ title, onOpenSidebar }: { title: string; onOpenSidebar: () => void }) {
  return (
    <header className="sticky top-0 z-20 h-16 bg-background/95 backdrop-blur border-b border-border flex items-center px-4 lg:px-6 gap-3">
      <button
        onClick={onOpenSidebar}
        className="lg:hidden p-2 -ml-1 rounded-md hover:bg-muted"
        aria-label="Abrir menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="lg:hidden relative w-8 h-8">
        <Image
          src="/logo-lamoia.png"
          alt="Lamoia"
          fill
          className="object-contain"
        />
      </div>

      <h1 className="text-lg lg:text-xl font-semibold text-foreground truncate">
        {title}
      </h1>
    </header>
  )
}
