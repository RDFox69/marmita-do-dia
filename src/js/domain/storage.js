const STORAGE_KEY = "marmita-em-dia.orders.v1";
const VALID_STATUSES = new Set(["waiting", "preparing", "ready", "delivering", "completed"]);
const VALID_PAYMENT_METHODS = new Set(["pix", "cash", "card"]);

function isValidOrder(order) {
  return Boolean(
    order &&
    typeof order.id === "string" &&
    Number.isInteger(order.number) && order.number > 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(order.dateKey) &&
    typeof order.createdAt === "string" && !Number.isNaN(Date.parse(order.createdAt)) &&
    order.customer && typeof order.customer.id === "string" &&
    typeof order.customer.name === "string" && typeof order.customer.phone === "string" &&
    typeof order.customer.address === "string" &&
    order.product && typeof order.product.id === "string" && typeof order.product.name === "string" &&
    Number.isSafeInteger(order.product.priceCents) && order.product.priceCents >= 0 &&
    Number.isInteger(order.quantity) && order.quantity >= 1 && order.quantity <= 30 &&
    Array.isArray(order.customizations) && order.customizations.every((item) => typeof item === "string") &&
    Array.isArray(order.extras) && order.extras.every((extra) => extra && typeof extra.id === "string" &&
      typeof extra.name === "string" && Number.isSafeInteger(extra.priceCents) && extra.priceCents >= 0) &&
    typeof order.notes === "string" &&
    ["delivery", "pickup"].includes(order.fulfillment) &&
    VALID_PAYMENT_METHODS.has(order.paymentMethod) &&
    ["paid", "pending"].includes(order.paymentStatus) &&
    Number.isSafeInteger(order.totalCents) && order.totalCents >= 0 &&
    VALID_STATUSES.has(order.status)
  );
}

export function loadOrders(storage) {
  if (storage === undefined) {
    try {
      storage = globalThis.localStorage;
    } catch {
      throw new Error("O navegador não permitiu acessar os dados salvos.");
    }
  }
  if (!storage) throw new Error("O navegador não oferece armazenamento para salvar os pedidos.");
  let saved;
  try {
    saved = storage.getItem(STORAGE_KEY);
  } catch {
    throw new Error("O navegador não permitiu acessar os dados salvos.");
  }
  if (saved === null) return [];
  try {
    const orders = JSON.parse(saved);
    if (!Array.isArray(orders) || !orders.every(isValidOrder)) {
      throw new TypeError("O conteúdo salvo não é uma lista válida de pedidos.");
    }
    return orders;
  } catch {
    throw new Error("Os dados salvos parecem estar danificados. Eles foram preservados para não perder informações.");
  }
}

export function saveOrders(orders, storage) {
  if (!Array.isArray(orders)) throw new TypeError("A lista de pedidos precisa ser válida.");
  if (storage === undefined) {
    try {
      storage = globalThis.localStorage;
    } catch {
      throw new Error("O navegador não permitiu acessar os dados salvos.");
    }
  }
  if (!storage) throw new Error("O navegador não oferece armazenamento para salvar os pedidos.");
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(orders));
  } catch {
    throw new Error("Não foi possível salvar. Verifique se o armazenamento do navegador está disponível.");
  }
}
