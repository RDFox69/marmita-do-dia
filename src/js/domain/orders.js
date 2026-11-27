export const ORDER_STATUSES = [
  { id: "waiting", label: "Aguardando preparo", action: "Começar preparo", icon: "hourglass" },
  { id: "preparing", label: "Em preparação", action: "Marcar como pronto", icon: "cooking-pot" },
  { id: "ready", label: "Pronto", action: "Saiu para entrega", icon: "package-check" },
  { id: "delivering", label: "Em entrega", action: "Concluir pedido", icon: "bike" },
  { id: "completed", label: "Concluído", action: null, icon: "circle-check" },
];

const VALID_PAYMENT_METHODS = ["pix", "cash", "card"];
const VALID_PAYMENT_STATUSES = ["paid", "pending"];
const VALID_FULFILLMENT = ["delivery", "pickup"];
const MAX_QUANTITY = 30;

export function calculateOrderTotal({ unitPriceCents, quantity, extras = [] }) {
  if (!Number.isSafeInteger(unitPriceCents) || unitPriceCents < 0) {
    throw new TypeError("O preço do produto precisa ser um valor válido.");
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
    throw new RangeError(`A quantidade deve ser de 1 a ${MAX_QUANTITY} marmitas.`);
  }
  const extrasCents = extras.reduce((total, extra) => {
    if (!Number.isSafeInteger(extra.priceCents) || extra.priceCents < 0) {
      throw new TypeError("O preço de cada adicional precisa ser válido.");
    }
    return total + extra.priceCents;
  }, 0);
  const total = (unitPriceCents + extrasCents) * quantity;
  if (!Number.isSafeInteger(total)) throw new RangeError("O valor total ultrapassa o limite permitido.");
  return total;
}

export function createOrder(input, now = new Date()) {
  const customer = input?.customer;
  if (!customer || typeof customer.name !== "string" || !customer.name.trim()) throw new TypeError("Informe o nome do cliente.");
  if (typeof customer.phone !== "string" || !customer.phone.trim()) throw new TypeError("Informe o telefone do cliente.");
  if (!input.product || typeof input.product.id !== "string" || typeof input.product.name !== "string") throw new TypeError("Escolha uma marmita.");
  if (!VALID_FULFILLMENT.includes(input.fulfillment)) throw new TypeError("Escolha entrega ou retirada.");
  if (input.fulfillment === "delivery" && (typeof customer.address !== "string" || !customer.address.trim())) throw new TypeError("Informe o endereço de entrega.");
  if (!VALID_PAYMENT_METHODS.includes(input.paymentMethod)) throw new TypeError("Escolha uma forma de pagamento válida.");
  if (!VALID_PAYMENT_STATUSES.includes(input.paymentStatus)) throw new TypeError("Escolha a situação do pagamento.");
  if (input.notes !== undefined && typeof input.notes !== "string") throw new TypeError("A observação precisa ser um texto.");
  const totalCents = calculateOrderTotal({
    unitPriceCents: input.product.priceCents,
    quantity: input.quantity,
    extras: input.extras || [],
  });
  if (!Number.isInteger(input.number) || input.number < 1) throw new TypeError("O número do pedido precisa ser válido.");
  if (Number.isNaN(now.getTime())) throw new TypeError("A data do pedido precisa ser válida.");
  const createdAt = now.toISOString();
  return {
    id: input.id || globalThis.crypto?.randomUUID?.() || `order-${now.getTime()}-${Math.random().toString(36).slice(2, 9)}`,
    number: input.number,
    dateKey: localDateKey(now),
    createdAt,
    customer: {
      id: input.customer.id || customerKey(customer.phone),
      name: customer.name.trim(),
      phone: customer.phone.trim(),
      address: customer.address?.trim() || "",
    },
    product: {
      id: input.product.id,
      name: input.product.name,
      priceCents: input.product.priceCents,
    },
    quantity: input.quantity,
    customizations: [...new Set(input.customizations || [])],
    extras: (input.extras || []).map(({ id, name, priceCents }) => ({ id, name, priceCents })),
    notes: input.notes?.trim() || "",
    fulfillment: input.fulfillment,
    paymentMethod: input.paymentMethod,
    paymentStatus: input.paymentStatus,
    totalCents,
    status: "waiting",
  };
}

export function advanceOrderStatus(order) {
  const nextStatus = getNextOrderStatus(order);
  if (!nextStatus) return order;
  return { ...order, status: nextStatus.id };
}

export function getNextOrderStatus(order) {
  const index = ORDER_STATUSES.findIndex(({ id }) => id === order.status);
  if (index < 0) throw new TypeError("O pedido tem uma etapa desconhecida.");
  if (index === ORDER_STATUSES.length - 1) return null;
  if (order.status === "ready" && order.fulfillment === "pickup") {
    return { ...ORDER_STATUSES[index + 2], action: "Concluir retirada" };
  }
  return { ...ORDER_STATUSES[index + 1], action: ORDER_STATUSES[index].action };
}

export function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function customerKey(phone) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) throw new TypeError("Informe um telefone válido para identificar o cliente.");
  return `customer-${digits}`;
}

export function getDailySummary(orders, dateKey = localDateKey(new Date())) {
  if (!Array.isArray(orders)) throw new TypeError("A lista de pedidos precisa ser válida.");
  const today = orders.filter((order) => order.dateKey === dateKey);
  const statusCounts = Object.fromEntries(ORDER_STATUSES.map(({ id }) => [id, 0]));
  const receivedByMethod = { pix: 0, cash: 0, card: 0 };
  let revenueCents = 0;
  let receivedCents = 0;
  let pendingCents = 0;
  let paidCount = 0;
  let pendingCount = 0;

  for (const order of today) {
    if (!statusCounts.hasOwnProperty(order.status)) throw new TypeError("Um pedido tem uma etapa desconhecida.");
    if (!Number.isSafeInteger(order.totalCents) || order.totalCents < 0) throw new TypeError("Um pedido tem um valor inválido.");
    if (!VALID_PAYMENT_METHODS.includes(order.paymentMethod)) throw new TypeError("Um pedido tem uma forma de pagamento desconhecida.");
    statusCounts[order.status] += 1;
    revenueCents += order.totalCents;
    if (order.paymentStatus === "paid") {
      receivedByMethod[order.paymentMethod] += order.totalCents;
      receivedCents += order.totalCents;
      paidCount += 1;
    } else if (order.paymentStatus === "pending") {
      pendingCents += order.totalCents;
      pendingCount += 1;
    } else {
      throw new TypeError("Um pedido tem uma situação de pagamento desconhecida.");
    }
  }

  return { dateKey, orderCount: today.length, statusCounts, revenueCents, receivedCents, pendingCents, receivedByMethod, paidCount, pendingCount };
}
