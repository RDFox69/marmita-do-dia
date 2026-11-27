import { createIcons, icons } from "lucide";
import {
  createOrder,
  getFinanceSummary,
  getPaymentState,
  recordPayment,
  transitionOrderStatus,
} from "./domain.js";

const app = document.getElementById("app");
const storageKey = "marmita-em-dia:v1";
const products = [
  {
    id: "frango",
    name: "Frango grelhado",
    description: "Arroz, feijão, legumes e salada",
    priceCents: 2490,
    image: "/assets/frango-grelhado.webp",
    category: "Mais pedidos",
  },
  {
    id: "strogonoff",
    name: "Strogonoff de frango",
    description: "Arroz branco e batata palha",
    priceCents: 2690,
    image: "/assets/strogonoff.webp",
    category: "Mais pedidos",
  },
  {
    id: "bife",
    name: "Bife acebolado",
    description: "Arroz, feijão, fritas e salada",
    priceCents: 2890,
    image: "/assets/bife-acebolado.webp",
    category: "Mais pedidos",
  },
  {
    id: "vegetariana",
    name: "Marmita vegetariana",
    description: "Grão-de-bico, arroz e legumes assados",
    priceCents: 2390,
    image: "/assets/vegetariano.jpg",
    category: "Sem carne",
  },
  {
    id: "lasanha",
    name: "Lasanha bolonhesa",
    description: "Lasanha artesanal e salada fresca",
    priceCents: 2790,
    image: "/assets/lasanha.webp",
    category: "Mais pedidos",
  },
  {
    id: "tilapia",
    name: "Tilápia com legumes",
    description: "Filé assado, legumes e arroz integral",
    priceCents: 3190,
    image: "/assets/tilapia.jpg",
    category: "Leve",
  },
];
const addons = [
  { id: "ovo", name: "Ovo", priceCents: 300 },
  { id: "carne", name: "Porção extra de carne", priceCents: 600 },
  { id: "farofa", name: "Farofa", priceCents: 200 },
];
const statusLabels = {
  received: "Novo pedido",
  preparing: "Em preparo",
  ready: "Pronto",
  out_for_delivery: "Saiu para entrega",
  delivered: "Entregue",
  picked_up: "Retirado",
  canceled: "Cancelado",
};
const pageTitles = {
  dashboard: ["Visão geral", "Acompanhe o movimento da sua marmitaria."],
  kitchen: [
    "Fila da cozinha",
    "Pedidos organizados por etapa, sem perder nenhum detalhe.",
  ],
  customers: [
    "Clientes",
    "Contatos e endereços salvos para pedir de novo com rapidez.",
  ],
  finance: [
    "Financeiro",
    "Vendas, valores recebidos e o que ainda falta receber.",
  ],
  "new-order": [
    "Novo pedido",
    "Registre o pedido do WhatsApp em poucos passos.",
  ],
};

function money(cents) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((cents || 0) / 100);
}

function escapeHtml(value = "") {
  return String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char],
  );
}

function todayAt(hour, minute = 0) {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function demoOrder(
  id,
  customer,
  phone,
  fulfillment,
  status,
  totalCents,
  receivedCents,
  hour,
  address,
  description,
) {
  const product =
    products.find((entry) => entry.id === description) ?? products[0];
  return {
    id,
    createdAt: todayAt(hour),
    customer: { name: customer, phone },
    fulfillment,
    address,
    deliveryFeeCents: fulfillment === "delivery" ? 500 : 0,
    items: [
      {
        productId: product.id,
        name: product.name,
        unitPriceCents: totalCents - (fulfillment === "delivery" ? 500 : 0),
        quantity: 1,
        addons: [],
        customizations: [],
        notes: "",
      },
    ],
    totalCents,
    status,
    payment: { method: "pix", receivedCents },
    notes: "",
  };
}

function demoState() {
  const orders = [
    demoOrder(
      "MD-1048",
      "Ana Souza",
      "11987654321",
      "delivery",
      "received",
      2990,
      0,
      12,
      "Rua das Flores, 120",
      "frango",
    ),
    demoOrder(
      "MD-1047",
      "João Lima",
      "11981234567",
      "pickup",
      "preparing",
      2690,
      2690,
      11,
      "",
      "strogonoff",
    ),
    demoOrder(
      "MD-1046",
      "Carla Mendes",
      "11992345678",
      "delivery",
      "ready",
      2940,
      0,
      11,
      "Av. Brasil, 45",
      "bife",
    ),
    demoOrder(
      "MD-1045",
      "Paulo Reis",
      "11993456789",
      "delivery",
      "out_for_delivery",
      2990,
      2990,
      10,
      "Rua do Sol, 88",
      "frango",
    ),
    demoOrder(
      "MD-1044",
      "Lúcia Alves",
      "11994567890",
      "pickup",
      "picked_up",
      2390,
      2390,
      10,
      "",
      "vegetariana",
    ),
  ];
  return {
    page: "dashboard",
    orders,
    customers: [
      {
        name: "Ana Souza",
        phone: "11987654321",
        address: "Rua das Flores, 120",
      },
      {
        name: "João Lima",
        phone: "11981234567",
        address: "Rua do Mercado, 18",
      },
      { name: "Carla Mendes", phone: "11992345678", address: "Av. Brasil, 45" },
      { name: "Paulo Reis", phone: "11993456789", address: "Rua do Sol, 88" },
      {
        name: "Lúcia Alves",
        phone: "11994567890",
        address: "Rua das Palmeiras, 203",
      },
    ],
    draftItems: [],
    toast: "",
  };
}

let storageNotice = "";
function loadState() {
  try {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return demoState();
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed.orders) || !Array.isArray(parsed.customers)) {
      throw new Error("Os dados salvos estão incompletos.");
    }
    return { ...demoState(), ...parsed, draftItems: [], toast: "" };
  } catch (error) {
    storageNotice =
      error instanceof Error
        ? error.message
        : "Não foi possível ler os dados salvos.";
    return demoState();
  }
}

const state = loadState();
function persist() {
  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        orders: state.orders,
        customers: state.customers,
      }),
    );
    storageNotice = "";
  } catch {
    storageNotice =
      "Não foi possível salvar. Verifique o espaço e as permissões do navegador.";
    showToast(storageNotice, true);
  }
}

function showToast(message, isError = false) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.toggle("toast-error", isError);
  toast.classList.add("toast-visible");
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(
    () => toast.classList.remove("toast-visible"),
    3600,
  );
}

function activeOrders() {
  return state.orders.filter(
    (order) => !["delivered", "picked_up", "canceled"].includes(order.status),
  );
}

function pageNavigation() {
  return [
    { id: "dashboard", label: "Visão geral", icon: "layout-dashboard" },
    {
      id: "kitchen",
      label: "Fila da cozinha",
      icon: "clipboard-list",
      count: activeOrders().length,
    },
    { id: "customers", label: "Clientes", icon: "users" },
    { id: "finance", label: "Financeiro", icon: "wallet" },
  ];
}

function renderOrderLines(order) {
  return order.items
    .map((item) => {
      const extras = item.addons.map((addon) => addon.name).join(", ");
      const details = [...item.customizations, item.notes, extras]
        .filter(Boolean)
        .join(" · ");
      return `<li><span>${item.quantity}× ${escapeHtml(item.name)}</span>${details ? `<small>${escapeHtml(details)}</small>` : ""}</li>`;
    })
    .join("");
}

function nextAction(order) {
  if (order.status === "received")
    return ["preparing", "Iniciar preparo", "play"];
  if (order.status === "preparing")
    return ["ready", "Marcar como pronto", "check"];
  if (order.status === "ready" && order.fulfillment === "pickup")
    return ["picked_up", "Registrar retirada", "check-check"];
  if (order.status === "ready" && order.fulfillment === "delivery")
    return ["out_for_delivery", "Saiu para entrega", "bike"];
  if (order.status === "out_for_delivery")
    return ["delivered", "Confirmar entrega", "package-check"];
  return null;
}

function renderOrderCard(order, compact = false) {
  const action = nextAction(order);
  const paymentState = getPaymentState(order);
  const paymentText =
    paymentState === "paid"
      ? "Pago"
      : paymentState === "partial"
        ? "Parcial"
        : "Pendente";
  const canCancel = ["received", "preparing", "ready"].includes(order.status);
  return `
    <article class="order-card ${compact ? "order-card-compact" : ""}">
      <div class="order-card-top">
        <div><span class="order-number">${escapeHtml(order.id)}</span><span class="order-time">${new Date(order.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span></div>
        <span class="status-pill status-${order.status}">${statusLabels[order.status]}</span>
      </div>
      <div class="order-customer"><strong>${escapeHtml(order.customer.name)}</strong><span>${order.fulfillment === "delivery" ? "Entrega" : "Retirada"} · ${escapeHtml(order.customer.phone)}</span></div>
      <ul class="order-lines">${renderOrderLines(order)}</ul>
      ${order.fulfillment === "delivery" ? `<p class="order-address"><i data-lucide="map-pin"></i>${escapeHtml(order.address)}</p>` : ""}
      ${order.notes ? `<p class="order-note"><i data-lucide="message-square-text"></i>${escapeHtml(order.notes)}</p>` : ""}
      <div class="order-card-bottom"><strong>${money(order.totalCents)}</strong><span class="payment-label payment-${paymentState}">${paymentText}</span></div>
      ${
        action || paymentState !== "paid"
          ? `<div class="order-actions">
        ${action ? `<button class="button button-primary button-small" data-action="advance" data-order="${escapeHtml(order.id)}" data-next="${action[0]}"><i data-lucide="${action[2]}"></i>${action[1]}</button>` : ""}
        ${paymentState !== "paid" ? `<button class="button button-quiet button-small" data-action="pay" data-order="${escapeHtml(order.id)}"><i data-lucide="badge-dollar-sign"></i>Receber restante</button>` : ""}
        ${canCancel ? `<button class="button button-cancel button-small" data-action="cancel" data-order="${escapeHtml(order.id)}"><i data-lucide="ban"></i>Cancelar</button>` : ""}
      </div>`
          : ""
      }
    </article>`;
}

function renderStat(label, value, note, icon, variant = "") {
  return `<article class="stat-card ${variant}"><span class="stat-icon"><i data-lucide="${icon}"></i></span><div><span class="stat-label">${label}</span><strong>${value}</strong><small>${note}</small></div></article>`;
}

function dashboardPage() {
  const todayOrders = state.orders.filter(
    (order) =>
      new Date(order.createdAt).toDateString() === new Date().toDateString(),
  );
  const todaySummary = getFinanceSummary(todayOrders);
  const queue = activeOrders().slice(0, 3);
  const weekday = new Date()
    .toLocaleDateString("pt-BR", { weekday: "long" })
    .toUpperCase();
  return `
    <section class="page-content">
      <div class="welcome-row"><div><p class="eyebrow">${weekday}, ${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long" }).toUpperCase()}</p><h1>Bom dia, Dona Marta <span aria-hidden="true">☀️</span></h1><p class="page-subtitle">Um resumo do que está acontecendo na sua cozinha hoje.</p></div><button class="button button-primary" data-page="new-order"><i data-lucide="plus"></i>Novo pedido</button></div>
      ${storageNotice ? `<div class="notice notice-warning" role="status"><i data-lucide="triangle-alert"></i>${escapeHtml(storageNotice)}</div>` : ""}
      <div class="stats-grid">
        ${renderStat("Pedidos em andamento", activeOrders().length, `${todayOrders.length} pedidos hoje`, "clipboard-list")}
        ${renderStat("Vendas de hoje", money(todaySummary.revenueCents), `${todaySummary.orderCount} pedidos no período`, "chart-no-axes-column-increasing", "stat-warm")}
        ${renderStat("Recebido hoje", money(getFinanceSummary(todayOrders).receivedCents), "Dinheiro que já entrou", "circle-dollar-sign", "stat-green")}
        ${renderStat("A receber hoje", money(todaySummary.pendingCents), "Confira os pagamentos pendentes", "hourglass", "stat-purple")}
      </div>
      <section class="section-block"><div class="section-title"><div><h2>Pedidos em andamento</h2><p>Acompanhe cada pedido até a entrega.</p></div><button class="text-button" data-page="kitchen">Ver fila completa <i data-lucide="arrow-up-right"></i></button></div>
        ${queue.length ? `<div class="orders-grid">${queue.map((order) => renderOrderCard(order, true)).join("")}</div>` : `<div class="empty-state"><i data-lucide="cooking-pot"></i><strong>Fila tranquila por aqui</strong><span>Quando chegar um novo pedido, ele aparecerá nesta lista.</span></div>`}
      </section>
      <div class="dashboard-bottom">
        <section class="section-block"><div class="section-title"><div><h2>Resumo do caixa</h2><p>Vendas não significam necessariamente dinheiro recebido.</p></div></div><div class="cash-summary"><div><span>Vendas de hoje</span><strong>${money(todaySummary.revenueCents)}</strong></div><div><span>Já recebido</span><strong class="text-success">${money(todaySummary.receivedCents)}</strong></div><div><span>Falta receber</span><strong class="text-warning">${money(todaySummary.pendingCents)}</strong></div><button class="button button-outline" data-page="finance">Abrir financeiro</button></div></section>
        <aside class="tip-card"><span class="tip-icon"><i data-lucide="lightbulb"></i></span><div><strong>Uma ajudinha para o dia</strong><p>Confira a fila entre um preparo e outro. Marque o pedido como pronto para não deixar ninguém esperando.</p><button class="text-button" data-page="kitchen">Abrir fila da cozinha <i data-lucide="arrow-right"></i></button></div></aside>
      </div>
      <p class="demo-note"><i data-lucide="info"></i>Dados de demonstração ficam salvos neste navegador. Você pode registrar novos pedidos a qualquer momento.</p>
    </section>`;
}

const kitchenColumns = [
  { status: "received", title: "Novos", icon: "inbox" },
  { status: "preparing", title: "Em preparo", icon: "cooking-pot" },
  { status: "ready", title: "Prontos", icon: "package-check" },
  { status: "out_for_delivery", title: "Em entrega", icon: "bike" },
];

function kitchenPage() {
  return `<section class="page-content"><div class="welcome-row"><div><p class="eyebrow">ORGANIZAÇÃO DA COZINHA</p><h1>Fila da cozinha</h1><p class="page-subtitle">Da chegada do pedido até a entrega ou retirada.</p></div><button class="button button-primary" data-page="new-order"><i data-lucide="plus"></i>Novo pedido</button></div>
    <div class="kitchen-board">${kitchenColumns
      .map((column) => {
        const orders = state.orders.filter(
          (order) => order.status === column.status,
        );
        return `<section class="kitchen-column"><header><span class="column-icon"><i data-lucide="${column.icon}"></i></span><h2>${column.title}</h2><span class="column-count">${orders.length}</span></header>${orders.length ? orders.map((order) => renderOrderCard(order)).join("") : `<div class="column-empty">Nenhum pedido nesta etapa</div>`}</section>`;
      })
      .join("")}</div>
    <section class="section-block completed-section"><div class="section-title"><div><h2>Concluídos recentemente</h2><p>Entregas e retiradas do dia.</p></div></div><div class="orders-grid">${
      state.orders
        .filter((order) => ["delivered", "picked_up"].includes(order.status))
        .slice(0, 4)
        .map((order) => renderOrderCard(order, true))
        .join("") ||
      `<div class="column-empty">Ainda sem pedidos concluídos hoje.</div>`
    }</div></section>
  </section>`;
}

function customersPage() {
  const customers = [...state.customers].sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR"),
  );
  return `<section class="page-content"><div class="welcome-row"><div><p class="eyebrow">RELACIONAMENTO</p><h1>Seus clientes</h1><p class="page-subtitle">O cadastro é criado ao registrar um pedido, para facilitar a próxima compra.</p></div><button class="button button-primary" data-page="new-order"><i data-lucide="plus"></i>Novo pedido</button></div>
    <section class="section-block"><div class="section-title"><div><h2>${customers.length} contatos salvos</h2><p>Use o nome ou telefone para encontrar um endereço conhecido.</p></div></div>
      <div class="table-wrap"><table class="data-table"><thead><tr><th>Cliente</th><th>Telefone</th><th>Endereço salvo</th><th>Pedidos</th><th>Total em pedidos</th></tr></thead><tbody>${customers
        .map((customer) => {
          const orders = state.orders.filter(
            (order) =>
              order.customer.phone === customer.phone &&
              order.status !== "canceled",
          );
          const spent = orders.reduce(
            (sum, order) => sum + order.totalCents,
            0,
          );
          return `<tr><td><strong class="table-person"><span>${escapeHtml(customer.name.slice(0, 1).toUpperCase())}</span>${escapeHtml(customer.name)}</strong></td><td>${escapeHtml(customer.phone)}</td><td>${escapeHtml(customer.address || "Ainda não informado")}</td><td>${orders.length}</td><td>${money(spent)}</td></tr>`;
        })
        .join("")}</tbody></table></div>
      ${customers.length ? "" : `<div class="empty-state"><i data-lucide="contact-round"></i><strong>Nenhum cliente salvo</strong><span>Os clientes aparecem aqui depois do primeiro pedido.</span></div>`}
    </section></section>`;
}

function financePage() {
  const summary = getFinanceSummary(state.orders);
  const sortedOrders = [...state.orders].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  return `<section class="page-content"><div class="welcome-row"><div><p class="eyebrow">CONTROLE SIMPLES DO CAIXA</p><h1>Financeiro</h1><p class="page-subtitle">Veja a diferença entre o que vendeu e o que já entrou no caixa.</p></div><button class="button button-outline" data-action="export"><i data-lucide="download"></i>Baixar CSV</button></div>
      <div class="finance-highlight"><div><span>Vendas registradas</span><strong>${money(summary.revenueCents)}</strong><small>${summary.orderCount} pedidos válidos · pedidos cancelados ficam fora</small></div><i data-lucide="wallet-cards"></i></div>
      <div class="stats-grid finance-stats">${renderStat("Recebido", money(summary.receivedCents), "Pagamentos confirmados", "circle-check", "stat-green")}${renderStat("Pendente", money(summary.pendingCents), "Total ainda não recebido", "clock-3", "stat-warm")}${renderStat("Pedidos", summary.orderCount, "Pedidos não cancelados", "receipt-text", "")}</div>
      <section class="section-block"><div class="section-title"><div><h2>Pedidos e recebimentos</h2><p>Registre o valor recebido quando o pagamento acontecer.</p></div></div>
        <div class="table-wrap"><table class="data-table finance-table"><thead><tr><th>Pedido</th><th>Cliente</th><th>Forma</th><th>Total</th><th>Recebido</th><th>Falta receber</th><th>Situação</th><th></th></tr></thead><tbody>${sortedOrders
          .map((order) => {
            const received = order.payment?.receivedCents ?? 0;
            const paymentState = getPaymentState(order);
            const remaining = order.totalCents - received;
            return `<tr><td><strong>${escapeHtml(order.id)}</strong><small>${new Date(order.createdAt).toLocaleDateString("pt-BR")}</small></td><td>${escapeHtml(order.customer.name)}</td><td>${order.payment.method === "pix" ? "Pix" : order.payment.method === "card" ? "Cartão" : "Dinheiro"}</td><td>${money(order.totalCents)}</td><td class="text-success">${money(received)}</td><td class="${remaining ? "text-warning" : ""}">${money(remaining)}</td><td><span class="payment-label payment-${paymentState}">${paymentState === "paid" ? "Pago" : paymentState === "partial" ? "Parcial" : "Pendente"}</span></td><td>${remaining && order.status !== "canceled" ? `<button class="table-action" data-action="pay" data-order="${escapeHtml(order.id)}" aria-label="Registrar recebimento de ${escapeHtml(order.id)}">Receber</button>` : ""}</td></tr>`;
          })
          .join("")}</tbody></table></div>
      </section>
      <p class="finance-footnote"><i data-lucide="circle-help"></i>Vendas somam os pedidos ainda válidos. Pagamentos são contados somente depois de registrados; o valor pendente é a diferença.</p>
    </section>`;
}

function draftTotal() {
  if (state.draftItems.length === 0) return 0;
  const subtotal = state.draftItems.reduce((sum, item) => {
    const extras = item.addons.reduce(
      (addonsTotal, addon) => addonsTotal + addon.priceCents,
      0,
    );
    return sum + (item.unitPriceCents + extras) * item.quantity;
  }, 0);
  const fulfillment =
    document.querySelector('input[name="fulfillment"]:checked')?.value ??
    "delivery";
  const deliveryFee =
    fulfillment === "delivery"
      ? parseCurrency(document.getElementById("delivery-fee")?.value ?? "5,00")
      : 0;
  return deliveryFee === null ? null : subtotal + deliveryFee;
}

function parseCurrency(value) {
  const normalized = String(value).trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const cents = Math.round(Number(normalized) * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

function readCurrencyInput(element, label) {
  const cents = parseCurrency(element.value);
  if (cents === null)
    throw new Error(
      `${label}: informe um valor não negativo com até duas casas decimais.`,
    );
  return cents;
}

function renderCart() {
  const cart = document.getElementById("draft-cart");
  if (!cart) return;
  cart.innerHTML = state.draftItems.length
    ? state.draftItems
        .map((item, index) => {
          const extras = item.addons.map((addon) => addon.name).join(", ");
          const details = [...item.customizations, item.notes, extras]
            .filter(Boolean)
            .join(" · ");
          const rowTotal =
            (item.unitPriceCents +
              item.addons.reduce((sum, addon) => sum + addon.priceCents, 0)) *
            item.quantity;
          return `<div class="cart-row"><div><strong>${item.quantity}× ${escapeHtml(item.name)}</strong>${details ? `<small>${escapeHtml(details)}</small>` : ""}</div><span>${money(rowTotal)}</span><button type="button" class="icon-button" data-action="remove-draft" data-index="${index}" aria-label="Remover ${escapeHtml(item.name)}"><i data-lucide="x"></i></button></div>`;
        })
        .join("")
    : `<p class="cart-empty">A sacola ainda está vazia. Escolha um prato para começar.</p>`;
  const subtotal = state.draftItems.reduce((sum, item) => {
    const extras = item.addons.reduce(
      (addonsTotal, addon) => addonsTotal + addon.priceCents,
      0,
    );
    return sum + (item.unitPriceCents + extras) * item.quantity;
  }, 0);
  const subtotalElement = document.getElementById("draft-subtotal");
  if (subtotalElement) subtotalElement.textContent = money(subtotal);
  const total = document.getElementById("draft-total");
  if (total)
    total.textContent =
      draftTotal() === null ? "Confira a taxa" : money(draftTotal());
  const count = document.getElementById("draft-count");
  if (count) {
    const itemCount = state.draftItems.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );
    count.textContent = `${itemCount} ${itemCount === 1 ? "item" : "itens"} na sacola.`;
  }
  createIcons({ icons });
}

function newOrderPage() {
  const customers = [...state.customers].sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR"),
  );
  return `<section class="page-content order-page"><div class="welcome-row"><div><p class="eyebrow">REGISTRO RÁPIDO</p><h1>Novo pedido</h1><p class="page-subtitle">Anote os detalhes da conversa e deixe a conta por nossa conta.</p></div><button class="button button-outline" data-page="dashboard"><i data-lucide="arrow-left"></i>Voltar</button></div>
    <form id="order-form" novalidate>
      <div class="order-layout">
        <div class="order-main">
          <section class="form-card"><div class="form-section-title"><span>01</span><div><h2>Quem está pedindo?</h2><p>Escolha um cliente salvo ou cadastre os dados do pedido.</p></div></div>
            ${customers.length ? `<label class="field-label" for="saved-customer">Cliente conhecido</label><select class="form-control" id="saved-customer"><option value="">Novo cliente</option>${customers.map((customer) => `<option value="${escapeHtml(customer.phone)}">${escapeHtml(customer.name)} · ${escapeHtml(customer.phone)}</option>`).join("")}</select>` : ""}
            <div class="form-grid"><label class="field-label">Nome do cliente<input class="form-control" id="customer-name" name="customerName" autocomplete="name" required placeholder="Ex.: Ana Souza"></label><label class="field-label">Telefone / WhatsApp<input class="form-control" id="customer-phone" name="customerPhone" type="tel" autocomplete="tel" required placeholder="(11) 99999-9999"></label></div>
            <label class="field-label">Como vai receber?<div class="fulfillment-options"><label class="choice-card"><input type="radio" name="fulfillment" value="delivery" checked><span><i data-lucide="bike"></i><strong>Entrega</strong><small>Vamos levar até o cliente</small></span></label><label class="choice-card"><input type="radio" name="fulfillment" value="pickup"><span><i data-lucide="store"></i><strong>Retirada</strong><small>Cliente busca no balcão</small></span></label></div></label>
            <div id="address-fields"><label class="field-label">Endereço de entrega<input class="form-control" id="customer-address" name="address" autocomplete="street-address" placeholder="Rua, número e complemento"></label><label class="field-label">Taxa de entrega<input class="form-control short-input" id="delivery-fee" name="deliveryFee" inputmode="decimal" value="5,00"><small class="field-hint">Em reais. Deixe 0,00 se não houver taxa.</small></label></div>
          </section>
          <section class="form-card"><div class="form-section-title"><span>02</span><div><h2>O que vai na marmita?</h2><p>Escolha o prato e ajuste do jeito que o cliente pediu.</p></div></div>
            <label class="field-label" for="product-choice">Prato do cardápio<select class="form-control" id="product-choice">${products.map((product) => `<option value="${product.id}">${escapeHtml(product.name)} · ${money(product.priceCents)}</option>`).join("")}</select></label>
            <div class="product-shortcuts">${products.map((product) => `<button type="button" class="product-shortcut" data-product="${product.id}"><img src="${product.image}" alt="" loading="lazy"><span>${escapeHtml(product.name)}</span><strong>${money(product.priceCents)}</strong></button>`).join("")}</div>
            <label class="field-label">Adicionais <span class="optional-label">opcional</span><div class="check-list">${addons.map((addon) => `<label><input type="checkbox" name="addon" value="${addon.id}"><span>${escapeHtml(addon.name)}</span><strong>+ ${money(addon.priceCents)}</strong></label>`).join("")}</div></label>
            <label class="field-label">Ajustes pedidos <span class="optional-label">opcional</span><div class="check-list check-list-simple"><label><input type="checkbox" name="customization" value="Sem cebola"><span>Sem cebola</span></label><label><input type="checkbox" name="customization" value="Sem salada"><span>Sem salada</span></label><label><input type="checkbox" name="customization" value="Sem feijão"><span>Sem feijão</span></label></div></label>
            <div class="form-grid item-extra-fields"><label class="field-label">Quantidade<input class="form-control short-input" id="item-quantity" type="number" min="1" max="99" value="1"></label><label class="field-label">Observação do prato<input class="form-control" id="item-notes" placeholder="Ex.: molho à parte"></label></div>
            <button type="button" class="button button-outline add-item-button" data-action="add-item"><i data-lucide="plus"></i>Adicionar prato à sacola</button>
          </section>
        </div>
        <aside class="order-aside"><section class="form-card cart-card">                <div class="form-section-title"><span>03</span><div><h2>Resumo do pedido</h2><p id="draft-count">0 itens na sacola.</p></div></div>
            <div id="draft-cart"></div><div class="cart-subtotal"><span>Subtotal dos pratos</span><strong id="draft-subtotal">${money(0)}</strong></div><div class="cart-grand-total"><span>Total do pedido</span><strong id="draft-total">${money(0)}</strong></div>
            <label class="field-label" for="payment-method">Forma de pagamento<select class="form-control" id="payment-method"><option value="cash">Dinheiro</option><option value="pix">Pix</option><option value="card">Cartão</option></select></label>
            <label class="field-label" for="payment-amount">Quanto já foi recebido?<input class="form-control" id="payment-amount" inputmode="decimal" value="0,00"><small class="field-hint">Use 0,00 se o cliente pagar na entrega ou retirada.</small></label>
            <label class="field-label" for="order-notes">Observação para a cozinha<textarea class="form-control" id="order-notes" rows="2" placeholder="Algo importante sobre este pedido?"></textarea></label>
            <button type="submit" class="button button-primary submit-order-button"><i data-lucide="check"></i>Salvar pedido</button>
            <p class="privacy-hint"><i data-lucide="lock-keyhole"></i>Os dados ficam salvos apenas neste navegador.</p>
          </section></aside>
      </div>
    </form>
  </section>`;
}

function render() {
  const [title, subtitle] = pageTitles[state.page] ?? pageTitles.dashboard;
  const page =
    state.page === "kitchen"
      ? kitchenPage()
      : state.page === "customers"
        ? customersPage()
        : state.page === "finance"
          ? financePage()
          : state.page === "new-order"
            ? newOrderPage()
            : dashboardPage();
  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <button class="brand" data-page="dashboard" aria-label="Marmita em Dia, início"><span class="brand-mark"><i data-lucide="cooking-pot"></i></span><span><strong>Marmita em Dia</strong><small>gestão da sua cozinha</small></span></button>
        <div class="restaurant-switch"><span class="restaurant-avatar">DM</span><span><strong>Marmitaria da Marta</strong><small><i></i> Aberta agora</small></span><i class="switch-chevron" data-lucide="chevrons-up-down"></i></div>
        <span class="nav-caption">MENU PRINCIPAL</span>
        <nav class="side-nav" aria-label="Navegação principal">${pageNavigation()
          .map(
            (item) =>
              `<button class="${state.page === item.id ? "nav-active" : ""}" data-page="${item.id}" ${state.page === item.id ? 'aria-current="page"' : ""}><i data-lucide="${item.icon}"></i><span>${item.label}</span>${item.count ? `<small>${item.count}</small>` : ""}</button>`,
          )
          .join("")}</nav>
        <button class="button button-primary sidebar-new-order" data-page="new-order"><i data-lucide="plus"></i>Registrar pedido</button>
        <div class="sidebar-bottom"><div class="help-card"><span><i data-lucide="heart-handshake"></i></span><strong>Feito para facilitar</strong><p>Organize os pedidos de hoje sem perder o cuidado de sempre.</p></div><div class="profile"><span class="profile-avatar">DM</span><span><strong>Dona Marta</strong><small>Administradora</small></span><button aria-label="Opções do perfil"><i data-lucide="ellipsis"></i></button></div></div>
      </aside>
      <main class="main-area"><header class="topbar"><div class="breadcrumb"><span>Início</span><i data-lucide="chevron-right"></i><strong>${title}</strong></div><div class="topbar-actions"><span class="today-chip"><i data-lucide="calendar-days"></i>${new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</span><button class="icon-button notification-button" aria-label="Notificações"><i data-lucide="bell"></i><span></span></button><span class="top-avatar">DM</span></div></header>
        <div class="mobile-brand"><span class="brand-mark"><i data-lucide="cooking-pot"></i></span><strong>Marmita em Dia</strong><button class="button button-primary button-small" data-page="new-order"><i data-lucide="plus"></i>Novo pedido</button></div>
        <div class="page-heading-mobile"><h2>${title}</h2><p>${subtitle}</p></div>${page}
      </main>
      <nav class="mobile-nav" aria-label="Navegação principal">${pageNavigation()
        .map(
          (item) =>
            `<button class="${state.page === item.id ? "nav-active" : ""}" data-page="${item.id}"><i data-lucide="${item.icon}"></i><span>${item.label}</span></button>`,
        )
        .join("")}</nav>
    </div>
    <div class="toast" id="toast" role="status" aria-live="polite"></div>`;
  createIcons({ icons });
  if (state.page === "new-order") renderCart();
}

function updateCustomerForm(phone) {
  const customer = state.customers.find((entry) => entry.phone === phone);
  if (!customer) {
    document.getElementById("customer-name").value = "";
    document.getElementById("customer-phone").value = "";
    document.getElementById("customer-address").value = "";
    return;
  }
  document.getElementById("customer-name").value = customer.name;
  document.getElementById("customer-phone").value = customer.phone;
  document.getElementById("customer-address").value = customer.address ?? "";
}

function addDraftItem() {
  const selectedProduct = products.find(
    (product) => product.id === document.getElementById("product-choice").value,
  );
  const quantity = Number(document.getElementById("item-quantity").value);
  if (
    !selectedProduct ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > 99
  ) {
    showToast("Escolha um prato e uma quantidade entre 1 e 99.", true);
    return;
  }
  const selectedAddons = [
    ...document.querySelectorAll('input[name="addon"]:checked'),
  ]
    .map((input) => addons.find((addon) => addon.id === input.value))
    .filter(Boolean);
  const customizations = [
    ...document.querySelectorAll('input[name="customization"]:checked'),
  ].map((input) => input.value);
  state.draftItems.push({
    productId: selectedProduct.id,
    name: selectedProduct.name,
    unitPriceCents: selectedProduct.priceCents,
    quantity,
    addons: selectedAddons,
    customizations,
    notes: document.getElementById("item-notes").value.trim(),
  });
  document.getElementById("item-quantity").value = "1";
  document.getElementById("item-notes").value = "";
  document
    .querySelectorAll('input[name="addon"], input[name="customization"]')
    .forEach((input) => {
      input.checked = false;
    });
  renderCart();
}

function handleSubmit(event) {
  if (event.target.id !== "order-form") return;
  event.preventDefault();
  try {
    const fulfillment = document.querySelector(
      'input[name="fulfillment"]:checked',
    ).value;
    const total = draftTotal();
    let order = createOrder({
      customer: {
        name: document.getElementById("customer-name").value,
        phone: document.getElementById("customer-phone").value,
      },
      fulfillment,
      address: document.getElementById("customer-address").value,
      deliveryFeeCents:
        fulfillment === "delivery"
          ? readCurrencyInput(
              document.getElementById("delivery-fee"),
              "Taxa de entrega",
            )
          : 0,
      items: state.draftItems,
      paymentMethod: document.getElementById("payment-method").value,
      notes: document.getElementById("order-notes").value,
    });
    const paymentAmount = readCurrencyInput(
      document.getElementById("payment-amount"),
      "Valor recebido",
    );
    if (paymentAmount > 0)
      order = recordPayment(order, paymentAmount, order.payment.method);
    if (order.totalCents !== total)
      throw new Error(
        "O total mudou durante o registro. Confira os itens e tente novamente.",
      );

    state.orders.unshift(order);
    const customer = state.customers.find(
      (entry) => entry.phone === order.customer.phone,
    );
    const savedCustomer = {
      ...order.customer,
      address:
        fulfillment === "delivery" ? order.address : (customer?.address ?? ""),
    };
    if (customer) Object.assign(customer, savedCustomer);
    else state.customers.push(savedCustomer);
    state.draftItems = [];
    state.page = "dashboard";
    persist();
    render();
    showToast(`Pedido ${order.id} salvo na fila da cozinha.`);
  } catch (error) {
    showToast(
      error instanceof Error
        ? error.message
        : "Não foi possível salvar o pedido.",
      true,
    );
  }
}

function exportCsv() {
  const rows = [
    [
      "Pedido",
      "Data",
      "Cliente",
      "Status",
      "Entrega/retirada",
      "Total",
      "Recebido",
      "Pendente",
      "Pagamento",
    ],
    ...state.orders.map((order) => [
      order.id,
      new Date(order.createdAt).toLocaleDateString("pt-BR"),
      order.customer.name,
      statusLabels[order.status],
      order.fulfillment === "delivery" ? "Entrega" : "Retirada",
      (order.totalCents / 100).toFixed(2).replace(".", ","),
      ((order.payment?.receivedCents ?? 0) / 100).toFixed(2).replace(".", ","),
      ((order.totalCents - (order.payment?.receivedCents ?? 0)) / 100)
        .toFixed(2)
        .replace(".", ","),
      order.payment.method,
    ]),
  ];
  const csv = `\uFEFF${rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")).join("\r\n")}`;
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `marmita-em-dia-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function handleClick(event) {
  const pageButton = event.target.closest("[data-page]");
  if (pageButton) {
    state.page = pageButton.dataset.page;
    render();
    return;
  }
  const productShortcut = event.target.closest("[data-product]");
  if (productShortcut) {
    document.getElementById("product-choice").value =
      productShortcut.dataset.product;
    document.getElementById("product-choice").focus();
    return;
  }
  const button = event.target.closest("[data-action]");
  if (!button) return;
  if (button.dataset.action === "add-item") addDraftItem();
  if (button.dataset.action === "remove-draft") {
    state.draftItems.splice(Number(button.dataset.index), 1);
    renderCart();
  }
  if (
    button.dataset.action === "advance" ||
    button.dataset.action === "cancel"
  ) {
    const order = state.orders.find(
      (entry) => entry.id === button.dataset.order,
    );
    if (!order) return;
    if (
      button.dataset.action === "cancel" &&
      !window.confirm(
        `Cancelar o pedido ${order.id}? Esta ação não pode ser desfeita.`,
      )
    )
      return;
    try {
      const nextStatus =
        button.dataset.action === "cancel" ? "canceled" : button.dataset.next;
      Object.assign(order, transitionOrderStatus(order, nextStatus));
      persist();
      render();
      showToast(
        `Pedido ${order.id}: ${statusLabels[nextStatus].toLowerCase()}.`,
      );
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o pedido.",
        true,
      );
    }
  }
  if (button.dataset.action === "pay") {
    const order = state.orders.find(
      (entry) => entry.id === button.dataset.order,
    );
    if (!order) return;
    try {
      const remaining = order.totalCents - (order.payment?.receivedCents ?? 0);
      Object.assign(order, recordPayment(order, remaining));
      persist();
      render();
      showToast(`Recebimento de ${money(remaining)} registrado.`);
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Não foi possível registrar o recebimento.",
        true,
      );
    }
  }
  if (button.dataset.action === "export") exportCsv();
}

function handleChange(event) {
  if (event.target.id === "saved-customer")
    updateCustomerForm(event.target.value);
  if (event.target.name === "fulfillment") {
    document.getElementById("address-fields").hidden =
      event.target.value !== "delivery";
    renderCart();
  }
  if (event.target.id === "delivery-fee") renderCart();
}

app.addEventListener("click", handleClick);
app.addEventListener("submit", handleSubmit);
app.addEventListener("change", handleChange);
render();
