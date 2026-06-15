import { useState, useEffect, useRef, useSyncExternalStore } from "react";

// Shared optimistic offset so every instance (hero badge + form) bumps together.
let optimisticBump = 0;
const bumpListeners = new Set<() => void>();

function subscribeBump(listener: () => void) {
  bumpListeners.add(listener);
  return () => bumpListeners.delete(listener);
}

function getBumpSnapshot() {
  return optimisticBump;
}

export function bumpWaitlistCount() {
  optimisticBump += 1;
  bumpListeners.forEach((l) => l());
}

export function useWaitlistCount() {
  const [count, setCount] = useState<number | null>(null);
  const bump = useSyncExternalStore(subscribeBump, getBumpSnapshot, getBumpSnapshot);
  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);

  useEffect(() => {
    let unmounted = false;

    function connect() {
      if (unmounted) return;
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = import.meta.env.VITE_WS_HOST || "vocalist-production.up.railway.app";
      const ws = new WebSocket(`${protocol}//${host}/ws/waitlist`);
      wsRef.current = ws;

      ws.onopen = () => {
        retriesRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "waitlist_count" && typeof data.count === "number") {
            setCount((prev) => {
              // Server caught up to (or past) our optimistic guess: drop the local bump.
              if (prev !== null && data.count > prev && optimisticBump > 0) {
                optimisticBump = Math.max(0, optimisticBump - (data.count - prev));
                bumpListeners.forEach((l) => l());
              }
              return data.count;
            });
          }
        } catch {}
      };

      ws.onclose = () => {
        if (unmounted) return;
        const delay = Math.min(1000 * 2 ** retriesRef.current, 30000);
        retriesRef.current++;
        setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      unmounted = true;
      wsRef.current?.close();
    };
  }, []);

  const combined = count === null ? (bump > 0 ? bump : null) : count + bump;
  return { count: combined };
}
