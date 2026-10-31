import { useEffect, useState } from 'react'

export type PersistStatus = 'unknown' | 'granted' | 'denied' | 'unsupported'

export function usePersistentStorage(): PersistStatus {
  const [status, setStatus] = useState<PersistStatus>('unknown')

  useEffect(() => {
    const nav = navigator as Navigator & {
      storage?: { persist?: () => Promise<boolean>; persisted?: () => Promise<boolean> }
    }
    if (!nav.storage || typeof nav.storage.persist !== 'function') {
      setStatus('unsupported')
      return
    }
    nav.storage
      .persist()
      .then((granted) => setStatus(granted ? 'granted' : 'denied'))
      .catch(() => setStatus('unsupported'))
  }, [])

  return status
}
