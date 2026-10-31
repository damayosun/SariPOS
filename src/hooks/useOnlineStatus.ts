import { useEffect, useState } from 'react'

export type OnlineStatus = 'online' | 'offline'

export function useOnlineStatus(): OnlineStatus {
  const [status, setStatus] = useState<OnlineStatus>(
    typeof navigator !== 'undefined' && navigator.onLine ? 'online' : 'offline',
  )

  useEffect(() => {
    const goOnline = () => setStatus('online')
    const goOffline = () => setStatus('offline')
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return status
}
