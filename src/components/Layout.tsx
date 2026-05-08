import { useLocation } from 'react-router-dom'
import { Building2, Package, Upload, Settings as SettingsIcon } from 'lucide-react'
import { Link } from 'react-router-dom'

interface LayoutProps {
  children: React.ReactNode
}

const navItems = [
  { path: '/', icon: Building2, label: 'Accounts' },
  { path: '/products', icon: Package, label: 'Products' },
  { path: '/import', icon: Upload, label: 'Import' },
  { path: '/settings', icon: SettingsIcon, label: 'Settings' },
]

export function Layout({ children }: LayoutProps) {
  const location = useLocation()

  return (
    <div className="flex flex-col h-screen bg-gray-50 md:flex-row">
      {/* Mobile Header */}
      <header className="bg-[#1a1a2e] text-white px-4 py-3 sticky top-0 z-10 md:hidden">
        <h1 className="text-xl font-bold">Gratsi</h1>
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-[#1a1a2e] text-white p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Gratsi</h1>
        </div>
        <nav className="flex-1 space-y-2">
          {navItems.map(({ path, icon: Icon, label }) => (
            <Link
              key={path}
              to={path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                location.pathname === path
                  ? 'bg-[#e94560] text-white'
                  : 'text-gray-300 hover:bg-gray-700'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0 safe-area-wrapper">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex md:hidden">
        {navItems.map(({ path, icon: Icon, label }) => (
          <Link
            key={path}
            to={path}
            className={`flex-1 flex flex-col items-center justify-center py-3 transition-colors ${
              location.pathname === path
                ? 'text-[#e94560] border-t-2 border-[#e94560]'
                : 'text-gray-500'
            }`}
          >
            <Icon className="w-6 h-6" />
            <span className="text-xs mt-1">{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  )
}
