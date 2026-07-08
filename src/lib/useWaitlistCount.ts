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
      const wsUrl = `${protocol}//${host}/ws/waitlist`;
      console.log(`[Frontend WS] Connecting to waitlist count: ${wsUrl}`);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log(`[Frontend WS] Connection opened successfully to ${wsUrl}`);
        retriesRef.current = 0;
      };

      ws.onmessage = (event) => {
        console.log(`[Frontend WS] Message received:`, event.data);
        try {
          const data = JSON.parse(event.data);
          if (data.type === "waitlist_count" && typeof data.count === "number") {
            setCount(data.count);
          }
        } catch (err) {
          console.error(`[Frontend WS] Error parsing message:`, err);
        }
      };

      ws.onclose = (event) => {
        if (unmounted) return;
        const delay = Math.min(1000 * 2 ** retriesRef.current, 30000);
        console.log(`[Frontend WS] Connection closed (code: ${event.code}). Reconnecting in ${delay}ms...`);
        retriesRef.current++;
        setTimeout(connect, delay);
      };

      ws.onerror = (err) => {
        console.error(`[Frontend WS] Connection error:`, err);
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
