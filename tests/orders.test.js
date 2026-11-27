import test from "node:test";
import assert from "node:assert/strict";
import { advanceOrderStatus, calculateOrderTotal, createOrder, getDailySummary, getNextOrderStatus, localDateKey, ORDER_STATUSES } from "../src/js/domain/orders.js";

const product = { id: "frango", name: "Frango grelhado", priceCents: 2490 };
const farofa = { id: "farofa", name: "Farofa", priceCents: 300 };
const orderInput = (overrides = {}) => ({
  number: 1,
  customer: { name: "Ana Souza", phone: "(11) 99999-0000", address: "Rua das Flores, 10" },
  product,
  quantity: 1,
  customizations: [],
  extras: [],
  fulfillment: "delivery",
  paymentMethod: "pix",
  paymentStatus: "pending",
  ...overrides,
});

test("calcula total do pedido com quantidade e adicionais", () => {
  assert.equal(calculateOrderTotal({ unitPriceCents: 2490, quantity: 2, extras: [farofa] }), 5580);
});

test("rejeita preço, quantidade e adicional inválidos ou extremos", () => {
  assert.throws(() => calculateOrderTotal({ unitPriceCents: -1, quantity: 1 }), /preço/i);
  assert.throws(() => calculateOrderTotal({ unitPriceCents: 100, quantity: 0 }), /quantidade/i);
  assert.throws(() => calculateOrderTotal({ unitPriceCents: 100, quantity: 31 }), /quantidade/i);
  assert.throws(() => calculateOrderTotal({ unitPriceCents: Number.MAX_SAFE_INTEGER, quantity: 2 }), /limite/i);
  assert.throws(() => calculateOrderTotal({ unitPriceCents: 100, quantity: 1, extras: [{ priceCents: -1 }] }), /adicional/i);
});

test("cria pedido com personalizações, preço calculado e etapa inicial", () => {
  const order = createOrder(orderInput({ customizations: ["Sem feijão"], extras: [farofa] }), new Date("2026-11-27T14:00:00.000Z"));
  assert.equal(order.totalCents, 2790);
  assert.deepEqual(order.customizations, ["Sem feijão"]);
  assert.equal(order.status, "waiting");
  assert.equal(order.dateKey, "2026-11-27");
});

test("recusa pedido sem cliente, produto ou endereço de entrega", () => {
  assert.throws(() => createOrder(orderInput({ customer: { name: "", phone: "11" } })), /nome/i);
  assert.throws(() => createOrder(orderInput({ customer: { name: "Ana", phone: "11" } })), /endereço/i);
  assert.throws(() => createOrder(orderInput({ product: null })), /marmita/i);
  assert.throws(() => createOrder(orderInput({ fulfillment: "teleporte" })), /entrega ou retirada/i);
  assert.throws(() => createOrder(orderInput({ paymentMethod: "cheque" })), /pagamento/i);
  assert.throws(() => createOrder(orderInput({ customer: { name: "Ana", phone: 123, address: "Rua" } })), /telefone/i);
});

test("aceita retirada sem endereço de entrega", () => {
  const order = createOrder(orderInput({ fulfillment: "pickup", customer: { name: "Ana", phone: "11" } }));
  assert.equal(order.customer.address, "");
});

test("resume faturamento, valores recebidos por forma e pendências separadamente", () => {
  const date = new Date();
  const today = localDateKey(date);
  const summary = getDailySummary([
    { dateKey: today, status: "waiting", totalCents: 2490, paymentStatus: "paid", paymentMethod: "pix" },
    { dateKey: today, status: "ready", totalCents: 3000, paymentStatus: "pending", paymentMethod: "cash" },
    { dateKey: today, status: "completed", totalCents: 2000, paymentStatus: "paid", paymentMethod: "card" },
    { dateKey: "2000-01-01", status: "waiting", totalCents: 10000, paymentStatus: "paid", paymentMethod: "pix" },
  ], today);
  assert.equal(summary.orderCount, 3);
  assert.equal(summary.revenueCents, 7490);
  assert.equal(summary.receivedCents, 4490);
  assert.equal(summary.pendingCents, 3000);
  assert.equal(summary.receivedByMethod.pix, 2490);
  assert.equal(summary.receivedByMethod.card, 2000);
  assert.equal(summary.statusCounts.waiting, 1);
  assert.equal(summary.paidCount, 2);
  assert.equal(summary.pendingCount, 1);
});

test("rejeita etapa e situação de pagamento desconhecidas no resumo", () => {
  assert.throws(() => getDailySummary([{ dateKey: "x", status: "lost", totalCents: 0, paymentStatus: "pending", paymentMethod: "pix" }], "x"), /etapa desconhecida/i);
  assert.throws(() => getDailySummary([{ dateKey: "x", status: "waiting", totalCents: 0, paymentStatus: "maybe", paymentMethod: "pix" }], "x"), /situação/i);
  assert.throws(() => getDailySummary([{ dateKey: "x", status: "waiting", totalCents: -1, paymentStatus: "pending", paymentMethod: "pix" }], "x"), /valor inválido/i);
});

test("define a sequência completa de etapas da cozinha", () => {
  assert.deepEqual(ORDER_STATUSES.map(({ id }) => id), ["waiting", "preparing", "ready", "delivering", "completed"]);
});

test("avança pedidos pela fila e mantém os concluídos estáveis", () => {
  const initial = { id: "1", status: "waiting" };
  const preparing = advanceOrderStatus(initial);
  assert.equal(preparing.status, "preparing");
  assert.equal(initial.status, "waiting");
  const completed = { id: "2", status: "completed" };
  assert.equal(advanceOrderStatus(completed), completed);
  assert.throws(() => advanceOrderStatus({ id: "3", status: "cancelado" }), /etapa desconhecida/i);
});

test("retirada pode ser concluída direto da etapa pronto sem falsa etapa de entrega", () => {
  const pickup = { id: "4", status: "ready", fulfillment: "pickup" };
  assert.equal(getNextOrderStatus(pickup).id, "completed");
  assert.equal(advanceOrderStatus(pickup).status, "completed");
  const delivery = { id: "5", status: "ready", fulfillment: "delivery" };
  assert.equal(getNextOrderStatus(delivery).id, "delivering");
});
