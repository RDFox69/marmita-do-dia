const validFulfillments = new Set(["delivery", "pickup"]);
const validPaymentMethods = new Set(["cash", "pix", "card"]);
const validStatuses = new Set([
  "received",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered",
  "picked_up",
  "canceled",
]);
const transitions = {
  received: ["preparing", "canceled"],
  preparing: ["ready", "canceled"],
  ready: ["out_for_delivery", "picked_up", "canceled"],
  out_for_delivery: ["delivered"],
  delivered: [],
  picked_up: [],
  canceled: [],
};

function assertCents(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(
      `${label} deve ser um valor em centavos igual ou maior que zero.`,
    );
  }
}

function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Adicione pelo menos um item ao pedido.");
  }

  return items.map((item) => {
    if (
      !item ||
      typeof item !== "object" ||
      typeof item.name !== "string" ||
      !item.name.trim() ||
      !item.productId
    ) {
      throw new Error("Cada item precisa de um produto válido.");
    }
    assertCents(item.unitPriceCents, "O preço");
    if (
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 99
    ) {
      throw new Error("A quantidade deve ficar entre 1 e 99.");
    }
    if (item.addons !== undefined && !Array.isArray(item.addons)) {
      throw new Error("A lista de adicionais do item é inválida.");
    }
    if (
      item.customizations !== undefined &&
      !Array.isArray(item.customizations)
    ) {
      throw new Error("A lista de ajustes do item é inválida.");
    }
    const addons = (item.addons ?? []).map((addon) => {
      if (
        !addon ||
        typeof addon.id !== "string" ||
        !addon.id ||
        typeof addon.name !== "string" ||
        !addon.name.trim()
      ) {
        throw new Error(
          "Cada adicional precisa de uma identificação e um nome.",
        );
      }
      assertCents(addon.priceCents, "O preço do adicional");
      return { id: addon.id, name: addon.name, priceCents: addon.priceCents };
    });
    const customizations = (item.customizations ?? [])
      .filter((entry) => typeof entry === "string" && entry.trim())
      .map((entry) => entry.trim());

    return {
      productId: item.productId,
      name: item.name.trim(),
      unitPriceCents: item.unitPriceCents,
      quantity: item.quantity,
      addons,
      customizations,
      notes: typeof item.notes === "string" ? item.notes.trim() : "",
    };
  });
}

export function calculateOrderTotal(items, deliveryFeeCents = 0) {
  assertCents(deliveryFeeCents, "A taxa de entrega");
  return normalizeItems(items).reduce((total, item) => {
    const extrasCents = item.addons.reduce(
      (sum, addon) => sum + addon.priceCents,
      0,
    );
    const itemTotal = (item.unitPriceCents + extrasCents) * item.quantity;
    if (!Number.isSafeInteger(total + itemTotal)) {
      throw new Error("O valor do pedido ultrapassa o limite permitido.");
    }
    return total + itemTotal;
  }, deliveryFeeCents);
}

export function createOrder(input) {
  if (!input || typeof input !== "object") {
    throw new Error("Informe os dados do pedido.");
  }
  const name =
    typeof input.customer?.name === "string" ? input.customer.name.trim() : "";
  const phone =
    typeof input.customer?.phone === "string"
      ? input.customer.phone.trim()
      : "";
  if (!name || !phone || phone.replace(/\D/g, "").length < 8) {
    throw new Error("Informe o nome e um telefone válido do cliente.");
  }
  if (!validFulfillments.has(input.fulfillment)) {
    throw new Error("Selecione entrega ou retirada.");
  }
  const address = typeof input.address === "string" ? input.address.trim() : "";
  if (input.fulfillment === "delivery" && !address) {
    throw new Error("Informe o endereço para entrega.");
  }
  const items = normalizeItems(input.items);
  const deliveryFeeCents =
    input.fulfillment === "delivery" ? (input.deliveryFeeCents ?? 0) : 0;
  const paymentMethod = input.paymentMethod ?? "cash";
  if (!validPaymentMethods.has(paymentMethod)) {
    throw new Error("Selecione uma forma de pagamento válida.");
  }
  const totalCents = calculateOrderTotal(items, deliveryFeeCents);

  return {
    id:
      input.id ??
      `MD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
    createdAt: input.createdAt ?? new Date().toISOString(),
    customer: { name, phone },
    fulfillment: input.fulfillment,
    address,
    deliveryFeeCents,
    items,
    totalCents,
    status: "received",
    payment: {
      method: paymentMethod,
      receivedCents: 0,
    },
    notes: typeof input.notes === "string" ? input.notes.trim() : "",
  };
}

export function transitionOrderStatus(order, nextStatus) {
  if (
    !order ||
    !validStatuses.has(order.status) ||
    !validStatuses.has(nextStatus)
  ) {
    throw new Error("Status do pedido inválido.");
  }
  if (!transitions[order.status].includes(nextStatus)) {
    throw new Error(
      `Transição de ${order.status} para ${nextStatus} não permitida.`,
    );
  }
  if (
    order.fulfillment === "pickup" &&
    ["out_for_delivery", "delivered"].includes(nextStatus)
  ) {
    throw new Error("Pedidos para retirada devem ser marcados como retirados.");
  }
  if (order.fulfillment === "delivery" && nextStatus === "picked_up") {
    throw new Error(
      "Pedidos para entrega não podem ser marcados como retirados.",
    );
  }
  return { ...order, status: nextStatus };
}

export function recordPayment(
  order,
  amountCents,
  method = order.payment?.method ?? "cash",
) {
  if (
    !order ||
    !Number.isSafeInteger(order.totalCents) ||
    order.totalCents < 0
  ) {
    throw new Error("Pedido inválido para registrar pagamento.");
  }
  assertCents(amountCents, "O pagamento");
  if (!validPaymentMethods.has(method)) {
    throw new Error("Selecione uma forma de pagamento válida.");
  }
  const receivedCents = order.payment?.receivedCents ?? 0;
  assertCents(receivedCents, "O valor recebido");
  if (amountCents === 0 || receivedCents + amountCents > order.totalCents) {
    throw new Error(
      "O pagamento deve ser maior que zero e não pode ultrapassar o total.",
    );
  }
  return {
    ...order,
    payment: { method, receivedCents: receivedCents + amountCents },
  };
}

export function getFinanceSummary(orders) {
  if (!Array.isArray(orders)) {
    throw new Error("A lista de pedidos é inválida.");
  }
  const included = orders.filter((order) => order.status !== "canceled");
  const summary = included.reduce(
    (totals, order) => {
      assertCents(order.totalCents, "O total do pedido");
      const receivedCents = order.payment?.receivedCents ?? 0;
      assertCents(receivedCents, "O pagamento");
      if (receivedCents > order.totalCents) {
        throw new Error(
          "O pagamento recebido não pode ultrapassar o total do pedido.",
        );
      }
      totals.revenueCents += order.totalCents;
      totals.receivedCents += receivedCents;
      return totals;
    },
    {
      revenueCents: 0,
      receivedCents: 0,
      pendingCents: 0,
      orderCount: included.length,
    },
  );

  summary.pendingCents = summary.revenueCents - summary.receivedCents;
  return summary;
}

export function getPaymentState(order) {
  const receivedCents = order.payment?.receivedCents ?? 0;
  if (receivedCents === 0) return "pending";
  if (receivedCents < order.totalCents) return "partial";
  return "paid";
}
