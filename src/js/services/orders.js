import { localDateKey } from "../domain/orders.js";
import { apiRequest } from "./api.js";

function mapOrder(row) {
  const createdAt = row.createdAt;
  return { ...row, dateKey: localDateKey(new Date(createdAt)) };
}

export async function fetchOrders() {
  const rows = await apiRequest("/api/orders");
  if (!Array.isArray(rows)) throw new Error("A lista de pedidos recebida do servidor não é válida.");
  return rows.map(mapOrder);
}

export async function insertOrder(order, linkedCustomerId = null) {
  const savedOrder = await apiRequest("/api/orders", {
    method: "POST",
    body: {
      customer: order.customer,
      customerId: linkedCustomerId,
      productId: order.product.id,
      quantity: order.quantity,
      customizations: order.customizations,
      addonIds: order.extras.map(({ id }) => id),
      notes: order.notes,
      fulfillment: order.fulfillment,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
    },
  });
  return mapOrder(savedOrder);
}

export async function updateOrder(id, changes) {
  const savedOrder = await apiRequest(`/api/orders/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: changes,
  });
  return mapOrder(savedOrder);
}
