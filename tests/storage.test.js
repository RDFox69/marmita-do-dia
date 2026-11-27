import test from "node:test";
import assert from "node:assert/strict";
import { loadOrders, saveOrders } from "../src/js/domain/storage.js";

function memoryStorage(initial = null) {
  let value = initial;
  return {
    getItem: () => value,
    setItem: (_key, next) => { value = next; },
  };
}

test("persists and restores orders", () => {
  const storage = memoryStorage();
  const orders = [{
    id: "1",
    number: 1,
    dateKey: "2026-11-27",
    createdAt: "2026-11-27T12:00:00.000Z",
    customer: { id: "customer-11", name: "Ana", phone: "11", address: "Rua" },
    product: { id: "frango", name: "Frango", priceCents: 2490 },
    quantity: 1,
    customizations: [],
    extras: [],
    notes: "",
    fulfillment: "delivery",
    paymentMethod: "pix",
    paymentStatus: "pending",
    totalCents: 2490,
    status: "waiting",
  }];
  saveOrders(orders, storage);
  assert.deepEqual(loadOrders(storage), orders);
});

test("shows an explicit error for damaged saved data without replacing it", () => {
  const storage = memoryStorage("{broken");
  assert.throws(() => loadOrders(storage), /danificados/i);
  assert.equal(storage.getItem(), "{broken");
});

test("reports browser storage failures", () => {
  assert.throws(() => saveOrders([], { setItem: () => { throw new Error("blocked"); } }), /não foi possível salvar/i);
  assert.throws(() => loadOrders({ getItem: () => { throw new Error("blocked"); } }), /não permitiu acessar/i);
});

test("refuses a saved array that contains an incomplete order", () => {
  assert.throws(() => loadOrders(memoryStorage('[{"id":"partial"}]')), /danificados/i);
});
