/**
 * A WebSocket that reconnects on its own.
 *
 * The server restarts constantly during development; a dead socket that stays
 * dead makes the app feel broken when it isn't.
 */
export interface ReconnectingSocket<Out> {
  send(message: Out): void;
  sendBinary(data: ArrayBufferLike): void;
  close(): void;
  readonly connected: () => boolean;
}

export function connect<In, Out>(
  path: string,
  handlers: {
    onMessage: (message: In) => void;
    onOpen?: () => void;
    onClose?: () => void;
  },
): ReconnectingSocket<Out> {
  const url = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}${path}`;
  let socket: WebSocket | null = null;
  let closedByUs = false;
  let attempt = 0;
  let retryTimer: number | undefined;

  const open = () => {
    socket = new WebSocket(url);
    socket.binaryType = "arraybuffer";

    socket.onopen = () => {
      attempt = 0;
      handlers.onOpen?.();
    };

    socket.onmessage = (event) => {
      if (typeof event.data !== "string") return;
      try {
        handlers.onMessage(JSON.parse(event.data) as In);
      } catch {
        /* a frame we don't understand is not worth tearing the socket down for */
      }
    };

    socket.onclose = () => {
      socket = null;
      handlers.onClose?.();
      if (closedByUs) return;
      // Back off, but stay responsive: the common case is a dev-server restart.
      const delay = Math.min(400 * 2 ** attempt++, 5000);
      retryTimer = window.setTimeout(open, delay);
    };

    socket.onerror = () => socket?.close();
  };

  open();

  return {
    send(message) {
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
    },
    sendBinary(data) {
      if (socket?.readyState === WebSocket.OPEN) socket.send(data);
    },
    close() {
      closedByUs = true;
      window.clearTimeout(retryTimer);
      socket?.close();
    },
    connected: () => socket?.readyState === WebSocket.OPEN,
  };
}
