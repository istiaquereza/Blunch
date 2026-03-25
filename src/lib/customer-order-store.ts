/**
 * In-memory store for customer (QR) order metadata.
 * Avoids the need for DB migrations to add source/confirmed_at/prep_time_minutes columns.
 *
 * Lives in the Next.js server process. Survives across requests within the same
 * process lifetime. Data is re-populated as orders are created / confirmed.
 */

interface CustomerOrderEntry {
  confirmed_at?: string;
  prep_time_minutes?: number;
}

// Global map keyed by order UUID
const store = new Map<string, CustomerOrderEntry>();

/** Register an order as a customer (QR) order at creation time. */
export function registerCustomerOrder(orderId: string): void {
  if (!store.has(orderId)) {
    store.set(orderId, {});
  }
}

/** Returns true if this order was placed via the customer QR flow. */
export function isCustomerOrder(orderId: string): boolean {
  return store.has(orderId);
}

/** Persist confirmation data (called when admin confirms the order). */
export function confirmCustomerOrder(
  orderId: string,
  confirmed_at: string,
  prep_time_minutes: number
): void {
  const existing = store.get(orderId) ?? {};
  store.set(orderId, { ...existing, confirmed_at, prep_time_minutes });
}

/** Retrieve confirmation data for an order. Returns undefined if not a customer order. */
export function getCustomerOrderMeta(
  orderId: string
): CustomerOrderEntry | undefined {
  return store.get(orderId);
}
