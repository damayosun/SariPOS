import { useEffect, useState } from 'react'
import {
  ShoppingCart,
  Package,
  Boxes,
  History,
  BarChart3,
  Settings as SettingsIcon,
  Store,
  Sun,
  Moon,
} from 'lucide-react'
import './App.css'
import { Checkout } from './views/Checkout'
import { Products } from './views/Products'
import { Inventory } from './views/Inventory'
import { SalesHistory } from './views/SalesHistory'
import { Reports } from './views/Reports'
import { SettingsView } from './views/Settings'
import { useOnlineStatus } from './hooks/useOnlineStatus'
import { getSettings } from './lib/settingsService'

export type Tab = 'checkout' | 'products' | 'inventory' | 'history' | 'reports' | 'settings'

function App() {
  const [tab, setTab] = useState<Tab>('checkout')
  const [storeName, setStoreName] = useState('')
  const onlineStatus = useOnlineStatus()
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('saripos_theme')
    if (saved === 'dark' || saved === 'light') return saved
    return typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('saripos_theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))
  }

  useEffect(() => {
    getSettings().then((s) => setStoreName(s.storeName)).catch(() => {})
  }, [tab])

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <Store size={24} />
          <span>POS</span>
        </div>
        <nav className="nav" aria-label="Main navigation">
          <button className={`nav-btn ${tab === 'checkout' ? 'active' : ''}`} onClick={() => setTab('checkout')}>
            <ShoppingCart />
            <span>Checkout</span>
          </button>
          <button className={`nav-btn ${tab === 'products' ? 'active' : ''}`} onClick={() => setTab('products')}>
            <Package />
            <span>Products</span>
          </button>
          <button className={`nav-btn ${tab === 'inventory' ? 'active' : ''}`} onClick={() => setTab('inventory')}>
            <Boxes />
            <span>Inventory</span>
          </button>
          <button className={`nav-btn ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>
            <History />
            <span>Sales</span>
          </button>
          <button className={`nav-btn ${tab === 'reports' ? 'active' : ''}`} onClick={() => setTab('reports')}>
            <BarChart3 />
            <span>Reports</span>
          </button>
          <button
            className={`nav-btn icon-only ${tab === 'settings' ? 'active' : ''}`}
            onClick={() => setTab('settings')}
            title="Settings"
            aria-label="Settings"
          >
            <SettingsIcon size={18} />
          </button>
        </nav>
        <div className="header-right">
          <button
            className="theme-btn"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          {storeName ? <span className="store-name" title={storeName}>{storeName}</span> : null}
          <span className={`status-badge ${onlineStatus}`} title={onlineStatus === 'online' ? 'Online' : 'Offline — checkout still works'}>
            <span className="status-dot" />
            {onlineStatus === 'online' ? 'Online' : 'Offline'}
          </span>
        </div>
      </header>
      <main className="app-main">
        {tab === 'checkout' && <Checkout onNavigate={setTab} />}
        {tab === 'products' && <Products />}
        {tab === 'inventory' && <Inventory />}
        {tab === 'history' && <SalesHistory />}
        {tab === 'reports' && <Reports />}
        {tab === 'settings' && <SettingsView onStoreNameChange={setStoreName} />}
      </main>
    </div>
  )
}

export default App
