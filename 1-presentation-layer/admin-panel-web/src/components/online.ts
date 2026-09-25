import { useEffect, useState } from 'react';

/**
 * Browser connection state. After reconnecting, `justReconnected` stays true
 * for a few seconds so the banner can confirm it.
 */
export function useConnection(confirmMs = 4000) {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [justReconnected, setJustReconnected] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const goOnline = () => {
      setOnline(true);
      setJustReconnected(true);
      clearTimeout(timer);
      timer = setTimeout(() => setJustReconnected(false), confirmMs);
    };
    const goOffline = () => {
      clearTimeout(timer);
      setOnline(false);
      setJustReconnected(false);
    };
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [confirmMs]);
  return { online, justReconnected };
}
