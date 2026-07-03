import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { io, type Socket } from "socket.io-client";
import { getAccessToken } from "../lib/api";

interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextValue | undefined>(undefined);

// Mounted only inside the authenticated subtree (see App.tsx) so it never
// attempts to connect while anon, and is torn down on logout via unmount.
export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const instance = io(import.meta.env.VITE_API_URL, {
      // auth as a callback so reconnect attempts (e.g. after a silent token
      // refresh) re-authenticate with the current in-memory token, not a
      // stale one captured at connect time.
      auth: (cb) => cb({ token: getAccessToken() }),
    });

    instance.on("connect", () => setIsConnected(true));
    instance.on("disconnect", () => setIsConnected(false));

    setSocket(instance);

    return () => {
      instance.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used within SocketProvider");
  return ctx;
}
