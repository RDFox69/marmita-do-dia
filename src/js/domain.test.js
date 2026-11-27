import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateOrderTotal,
  createOrder,
  getFinanceSummary,
  recordPayment,
  transitionOrderStatus,
} from "./domain.js";

test("calculates item, add-on, quantity, and delivery totals in cents", () => {
  const total = calculateOrderTotal(
    [
      {
        productId: "frango",
        name: "Frango grelhado",
        unitPriceCents: 2490,
        quantity: 2,
        addons: [{ id: "ovo", name: "Ovo", priceCents: 300 }],
      },
    ],
    500,
  );
  assert.equal(total, 6080);
});

test("creates a valid customized order with a calculated total", () => {
  const order = createOrder({
    customer: { name: "Ana", phone: "11999999999" },
    fulfillment: "delivery",
    address: "Rua das Flores, 10",
    items: [
      {
        productId: "frango",
        name: "Frango grelhado",
        unitPriceCents: 2490,
        quantity: 1,
        customizations: ["Sem cebola"],
        addons: [{ id: "ovo", name: "Ovo", priceCents: 300 }],
      },
    ],
    deliveryFeeCents: 500,
  });
  assert.equal(order.totalCents, 3290);
  assert.equal(order.status, "received");
  assert.deepEqual(order.items[0].customizations, ["Sem cebola"]);
  assert.equal(order.items[0].addons[0].priceCents, 300);
});

test("rejects invalid quantities, prices, and missing delivery addresses", () => {
  assert.throws(
    () =>
      calculateOrderTotal([
        { productId: "arroz", name: "Arroz", unitPriceCents: 500, quantity: 0 },
      ]),
    /quantidade/i,
  );
  assert.throws(
    () =>
      calculateOrderTotal([
        {
          productId: "arroz",
          name: "Arroz",
          unitPriceCents: 500,
          quantity: 100,
        },
      ]),
    /quantidade/i,
  );
  assert.throws(
    () =>
      calculateOrderTotal([
        { productId: "arroz", name: "Arroz", unitPriceCents: -1, quantity: 1 },
      ]),
    /preço/i,
  );
  assert.throws(
    () =>
      calculateOrderTotal([
        {
          productId: "arroz",
          name: "Arroz",
          unitPriceCents: 500.5,
          quantity: 1,
        },
      ]),
    /preço/i,
  );
  assert.throws(
    () =>
      createOrder({
        customer: { name: "Ana", phone: "11999999999" },
        fulfillment: "delivery",
        items: [
          {
            productId: "arroz",
            name: "Arroz",
            unitPriceCents: 500,
            quantity: 1,
          },
        ],
      }),
    /endereço/i,
  );
  assert.throws(
    () =>
      createOrder({
        customer: { name: "Ana", phone: "11999999999" },
        fulfillment: "pickup",
        paymentMethod: "transferência",
        items: [
          {
            productId: "arroz",
            name: "Arroz",
            unitPriceCents: 500,
            quantity: 1,
          },
        ],
      }),
    /pagamento/i,
  );
});

test("permits only forward kitchen and fulfillment status transitions", () => {
  const order = {
    id: "p-1",
    fulfillment: "delivery",
    status: "received",
    payment: { receivedCents: 0 },
  };
  const preparing = transitionOrderStatus(order, "preparing");
  const ready = transitionOrderStatus(preparing, "ready");
  const outForDelivery = transitionOrderStatus(ready, "out_for_delivery");
  const delivered = transitionOrderStatus(outForDelivery, "delivered");
  assert.equal(preparing.status, "preparing");
  assert.equal(delivered.status, "delivered");
  assert.throws(() => transitionOrderStatus(order, "delivered"), /transição/i);
  assert.throws(() => transitionOrderStatus(ready, "delivered"), /transição/i);
  assert.throws(
    () =>
      transitionOrderStatus(
        { ...ready, fulfillment: "pickup" },
        "out_for_delivery",
      ),
    /retirada/i,
  );
});

test("pickup orders do not include delivery fees or transition to delivery", () => {
  const order = createOrder({
    customer: { name: "João", phone: "11999999999" },
    fulfillment: "pickup",
    deliveryFeeCents: 500,
    items: [
      { productId: "arroz", name: "Arroz", unitPriceCents: 500, quantity: 1 },
    ],
  });
  assert.equal(order.totalCents, 500);
  const preparing = transitionOrderStatus(order, "preparing");
  const ready = transitionOrderStatus(preparing, "ready");
  assert.equal(transitionOrderStatus(ready, "picked_up").status, "picked_up");
});

test("summarizes revenue, received money, and pending balances separately", () => {
  const summary = getFinanceSummary([
    { status: "delivered", totalCents: 3000, payment: { receivedCents: 3000 } },
    { status: "preparing", totalCents: 2500, payment: { receivedCents: 1000 } },
    { status: "canceled", totalCents: 9000, payment: { receivedCents: 0 } },
  ]);
  assert.deepEqual(summary, {
    revenueCents: 5500,
    receivedCents: 4000,
    pendingCents: 1500,
    orderCount: 2,
  });
});

test("rejects payment received above the order total", () => {
  assert.throws(
    () =>
      getFinanceSummary([
        {
          status: "received",
          totalCents: 1000,
          payment: { receivedCents: 1200 },
        },
      ]),
    /pagamento/i,
  );
});

test("records partial then full payment without exceeding the balance", () => {
  const order = {
    totalCents: 2000,
    payment: { method: "pix", receivedCents: 0 },
  };
  const partial = recordPayment(order, 750);
  const paid = recordPayment(partial, 1250);
  assert.equal(partial.payment.receivedCents, 750);
  assert.equal(paid.payment.receivedCents, 2000);
  assert.throws(() => recordPayment(paid, 1), /pagamento/i);
});
