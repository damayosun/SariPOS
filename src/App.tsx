import { useEffect, useState } from 'react'
import { ShoppingCart, Package, History, BarChart3, Settings as SettingsIcon, Store } from 'lucide-react'
import './App.css'
import { Checkout } from './views/Checkout'
import { Products } from './views/Products'
import { SalesHistory } from './views/SalesHistory'
import { Reports } from './views/Reports'
import { SettingsView } from './views/Settings'
import { useOnlineStatus } from './hooks/useOnlineStatus'
import { getSettings } from './lib/settingsService'
import type { Settings } from './lib/types'

export type Tab = 'checkout' | 'products' | 'history' | 'reports' | 'settings'

function App() {
  const [tab, setTab] = useState<Tab>('checkout')
  const [storeName, setStoreName] = useState('')
  const onlineStatus = useOnlineStatus()

  useEffect(() => {
    getSettings().then((s) => setStoreName(s.storeName)).catch(() => {})
  }, [tab])

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <Store size={24} />
          <span>SariPOS</span>
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
          <button className={`nav-btn ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>
            <History />
            <span>Sales</span>
          </button>
          <button className={`nav-btn ${tab === 'reports' ? 'active' : ''}`} onClick={() => setTab('reports')}>
            <BarChart3 />
            <span>Reports</span>
          </button>
          <button className={`nav-btn ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')}>
            <SettingsIcon />
            <span>Settings</span>
          </button>
        </nav>
        <div className="header-right">
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
        {tab === 'history' && <SalesHistory />}
        {tab === 'reports' && <Reports />}
        {tab === 'settings' && <SettingsView onStoreNameChange={setStoreName} />}
      </main>
    </div>
  )
}

export default App
