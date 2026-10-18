import { API_URL } from './config';

// Same server as the rest of the app (lib/config.ts): the deployed API unless
// EXPO_PUBLIC_API_URL points somewhere else, e.g. http://10.0.2.2:3000 for a server
// running on this laptop (Android emulator) or http://localhost:3000 (iOS simulator).
const API_BASE = API_URL;

export type OrderStatus = 'placed' | 'accepted' | 'ready' | 'cancelled';

export type ConfirmResponse = {
  order_id: string;
  square_order_id: string;
  status: OrderStatus;
};

export type OrderResponse = { status: OrderStatus; simulated?: boolean };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      signal: controller.signal,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.message ?? `Request failed (${res.status})`);
    return body as T;
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('The request timed out. Check your connection and try again.');
    }
    // fetch throws a bare TypeError when the server can't be reached.
    if (e instanceof TypeError) {
      throw new Error("Couldn't reach the server. Check your connection and try again.");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export function confirmSwap(input: { shop_id: string; menu_item_id: string; request_id: string }) {
  return request<ConfirmResponse>('/swap/confirm', { method: 'POST', body: JSON.stringify(input) });
}

export function getOrder(orderId: string) {
  return request<OrderResponse>(`/order/${encodeURIComponent(orderId)}`);
}
