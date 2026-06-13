import { useState, useEffect, useRef } from "react";

export function useWaitlistCount() {
  const [count, setCount] = useState<number | null>(null);
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
            setCount(data.count);
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

  return { count };
}
