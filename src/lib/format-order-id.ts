export function formatOrderId(id: string) {
  return `#ORD-${id.slice(-6).toUpperCase()}`;
}