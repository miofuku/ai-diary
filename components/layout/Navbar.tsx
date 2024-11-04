'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Lock } from 'lucide-react'

export function Navbar() {
  const pathname = usePathname()
  
  const navItems = [
    { href: '/calendar', label: '黄历' },
    { href: '/bazi', label: '八字' },
    { href: '/planner', label: '智能规划', isPremium: true },
    { href: '/about', label: '关于我们' },
  ]

  return (
    <header className="border-b">
      <div className="container mx-auto px-4">
        <nav className="flex items-center justify-between h-16">
          <Link 
            href="/" 
            className="text-2xl font-bold text-blue-600"
          >
            慧历
          </Link>
          
          <div className="flex gap-6">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors
                  ${pathname === item.href ? 'text-blue-600' : 'text-gray-600 hover:text-blue-600'}
                  ${item.isPremium ? 'opacity-80' : ''}`}
              >
                {item.label}
                {item.isPremium && (
                  <Lock className="h-4 w-4" />
                )}
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </header>
  )
} 