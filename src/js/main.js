import { createIcons, icons } from "lucide";
import { advanceOrderStatus, calculateOrderTotal, createOrder, getDailySummary, getNextOrderStatus, ORDER_STATUSES } from "./domain/orders.js";
import { extras, getExtras, getProduct, products } from "./domain/menu.js";
import { fetchOrders, insertOrder, updateOrder } from "./services/orders.js";
import { apiRequest } from "./services/api.js";
import { formatCurrency, formatTime, escapeHtml } from "./ui/helpers.js";
import "../css/app.css";

const app = document.getElementById("app");
const operatorNavigation = [
  { route: "#inicio", label: "Visão geral", icon: "layout-dashboard" },
  { route: "#pedidos", label: "Pedidos e cozinha", icon: "chef-hat" },
  { route: "#clientes", label: "Clientes", icon: "users" },
  { route: "#caixa", label: "Fechamento de caixa", icon: "wallet-cards" },
];
const customerNavigation = [
  { route: "#pedidos", label: "Meus pedidos", icon: "clipboard-list" },
  { route: "#novo-pedido", label: "Novo pedido", icon: "plus" },
];
const statusNames = Object.fromEntries(ORDER_STATUSES.map(({ id, label }) => [id, label]));
let orders = [];
let session = null;
let profile = null;
let authReady = false;
let authAudience = "customer";
let authMode = "login";
let flashMessage = "";
let flashType = "success";
let contextLoading = false;
let operatorAccessPending = false;
let orderRefreshTimer = null;
let isRefreshingOrders = false;

function routeInfo() {
  const [route, query = ""] = (location.hash || "#inicio").split("?");
  return { route, params: new URLSearchParams(query) };
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#96;");
}

function getCustomers() {
  const byPhone = new Map();
  for (const order of [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    const key = order.customer.phone.replace(/\D/g, "");
    if (!key) continue;
    const customer = byPhone.get(key);
    if (!customer) {
      byPhone.set(key, { ...order.customer });
    } else if (!customer.address && order.customer.address) {
      customer.address = order.customer.address;
    }
  }
  return [...byPhone.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

function currentDateLabel() {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
}

function shell(content, activeRoute) {
  const navigation = profile.role === "operator" ? operatorNavigation : customerNavigation;
  const displayName = profile.full_name || profile.email;
  const initials = displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const isOperator = profile.role === "operator";
  return `
    <div class="app-shell">
      <aside class="sidebar">
        <a class="brand" href="#inicio" aria-label="Marmita em Dia, início">
          <span class="brand-mark"><i data-lucide="soup"></i></span>
          <span><strong>Marmita em Dia</strong><small>Rotina mais leve</small></span>
        </a>
        <p class="nav-caption">${isOperator ? "COZINHA" : "ÁREA DO CLIENTE"}</p>
        <nav class="side-nav" aria-label="Navegação principal">
          ${navigation.map(({ route, label, icon }) => `<a href="${route}" class="nav-link ${route === activeRoute ? "active" : ""}"><i data-lucide="${icon}"></i><span>${label}</span>${route === "#pedidos" && orders.filter((order) => order.status !== "completed").length ? `<small class="nav-count">${orders.filter((order) => order.status !== "completed").length}</small>` : ""}</a>`).join("")}
        </nav>
        <div class="sidebar-note"><span class="note-icon"><i data-lucide="${isOperator ? "heart-handshake" : "shield-check"}"></i></span><strong>${isOperator ? "Pedidos em um só lugar" : "Acompanhe seu pedido"}</strong><p>${isOperator ? "Atualizações da cozinha aparecem para o cliente." : "Veja o andamento e a previsão por aqui."}</p></div>
        <div class="sidebar-profile"><span class="profile-avatar">${escapeHtml(initials)}</span><span class="profile-identity"><strong>${escapeHtml(displayName)}</strong><small>${isOperator ? "Equipe da cozinha" : "Cliente"}</small></span><button class="sign-out-button" type="button" data-action="sign-out" aria-label="Sair da conta" title="Sair"><i data-lucide="log-out"></i></button></div>
      </aside>
      <div class="app-main">
        <header class="topbar"><div class="mobile-brand"><span class="brand-mark"><i data-lucide="soup"></i></span><strong>Marmita em Dia</strong></div><div class="topbar-date"><i data-lucide="calendar-days"></i><span>${currentDateLabel()}</span></div>${isOperator ? `<a class="button button-primary topbar-action" href="#novo-pedido"><i data-lucide="plus"></i><span>Novo pedido</span></a>` : `<span class="topbar-account">${escapeHtml(displayName)}</span>`}<button class="topbar-signout" type="button" data-action="sign-out"><i data-lucide="log-out"></i><span>Sair</span></button></header>
        ${flashMessage ? `<div class="toast toast-${flashType}" role="status">${escapeHtml(flashMessage)}<button type="button" class="toast-close" aria-label="Fechar aviso" data-action="clear-flash">×</button></div>` : ""}
        <main class="content">${content}</main>
      </div>
      <nav class="mobile-nav ${isOperator ? "operator-mobile-nav" : "customer-mobile-nav"}" aria-label="Navegação principal">
        ${navigation.map(({ route, label, icon }) => `<a href="${route}" class="${route === activeRoute ? "active" : ""}" aria-label="${label}"><i data-lucide="${icon}"></i><span>${label === "Visão geral" ? "Início" : label === "Pedidos e cozinha" ? "Pedidos" : label === "Fechamento de caixa" ? "Caixa" : label}</span></a>`).join("")}
      </nav>
    </div>`;
}

function serverUnavailablePage(error) {
  return `<section class="auth-page"><div class="auth-card config-card"><span class="brand-mark"><i data-lucide="server-off"></i></span><p class="eyebrow">SERVIDOR INDISPONÍVEL</p><h1>Não foi possível conectar</h1><p class="auth-description">${escapeHtml(error.message || "O servidor não respondeu.")}</p><div class="auth-notice"><strong>Inicie o servidor Python para usar o sistema.</strong><span>Consulte o README para instalar as dependências e executar a aplicação Flask.</span></div><button class="button button-outline" type="button" data-action="retry-server">Tentar novamente</button></div></section>`;
}

function authPage() {
  const isSignup = authMode === "signup";
  return `<section class="auth-page">
    <div class="auth-intro"><a class="brand auth-brand" href="#login"><span class="brand-mark"><i data-lucide="soup"></i></span><span><strong>Marmita em Dia</strong><small>Rotina mais leve</small></span></a><p class="eyebrow">PEDIDO SEM COMPLICAÇÃO</p><h1>Comida caseira, com tudo em ordem.</h1><p>Peça sua marmita e acompanhe o preparo. A equipe organiza cada pedido em uma fila única.</p><div class="auth-benefits"><span><i data-lucide="clipboard-check"></i>Pedido organizado</span><span><i data-lucide="timer"></i>Previsão de preparo</span><span><i data-lucide="map-pin"></i>Entrega ou retirada</span></div></div>
    <div class="auth-card">
      <div class="auth-audience" aria-label="Tipo de acesso"><button type="button" data-action="auth-audience" data-audience="customer" class="${authAudience === "customer" ? "active" : ""}">Sou cliente</button><button type="button" data-action="auth-audience" data-audience="operator" class="${authAudience === "operator" ? "active" : ""}">Sou da equipe</button></div>
      <p class="eyebrow">${authAudience === "operator" ? "ACESSO DA COZINHA" : "ÁREA DO CLIENTE"}</p><h2>${authAudience === "operator" ? isSignup ? "Solicitar acesso à cozinha" : "Entrar na cozinha" : isSignup ? "Crie sua conta" : "Acesse sua conta"}</h2><p class="auth-description">${authAudience === "operator" ? isSignup ? "Crie uma conta e peça ao responsável para habilitar seu acesso à equipe." : "Entre para acompanhar e organizar todos os pedidos." : isSignup ? "Cadastre-se uma vez para pedir e acompanhar o preparo." : "Entre para fazer um pedido ou acompanhar sua entrega."}</p>
      ${authAudience === "customer" ? `<div class="auth-mode"><button type="button" data-action="auth-mode" data-mode="login" class="${authMode === "login" ? "active" : ""}">Entrar</button><button type="button" data-action="auth-mode" data-mode="signup" class="${authMode === "signup" ? "active" : ""}">Criar conta</button></div>` : `<button class="auth-request-link" type="button" data-action="auth-mode" data-mode="${isSignup ? "login" : "signup"}">${isSignup ? "Já tem acesso? Entrar" : "Precisa de acesso? Solicitar conta"}</button>`}
      ${flashMessage ? `<div class="auth-error" role="alert">${escapeHtml(flashMessage)}</div>` : ""}
      <form class="auth-form" id="auth-form">
        ${isSignup ? `<label class="field"><span>Seu nome <b>*</b></span><input name="fullName" autocomplete="name" required maxlength="100" placeholder="Ex.: Ana Souza"></label><label class="field"><span>Telefone / WhatsApp <b>*</b></span><input name="phone" type="tel" autocomplete="tel" required maxlength="30" placeholder="(11) 99999-9999"></label>` : ""}
        <label class="field"><span>E-mail <b>*</b></span><input name="email" type="email" autocomplete="email" required maxlength="254" placeholder="voce@email.com"></label>
        <label class="field"><span>Senha <b>*</b></span><input name="password" type="password" autocomplete="${isSignup ? "new-password" : "current-password"}" minlength="8" required placeholder="${isSignup ? "Pelo menos 8 caracteres" : "Sua senha"}"></label>
        <button class="button button-primary auth-submit" type="submit">${isSignup ? authAudience === "operator" ? "Criar conta e solicitar acesso" : "Criar conta de cliente" : "Entrar"}<i data-lucide="arrow-right"></i></button>
      </form>
      <p class="auth-footnote">${authAudience === "operator" ? "A solicitação não libera acesso automaticamente. Somente a administração pode autorizar o perfil da equipe." : "Seus pedidos ficam salvos com segurança e podem ser acessados em seus dispositivos."}</p>
    </div>
  </section>`;
}

function pageHeading(eyebrow, title, description, action = "") {
  return `<div class="page-heading"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p class="page-description">${description}</p></div>${action}</div>`;
}

function metricCard(icon, label, value, detail, tone = "green") {
  return `<article class="metric-card"><span class="metric-icon tone-${tone}"><i data-lucide="${icon}"></i></span><div><span class="metric-label">${label}</span><strong class="metric-value">${value}</strong><small>${detail}</small></div></article>`;
}

function formatETA(order) {
  if (order.status === "completed") return "Pedido concluído";
  if (order.status === "ready" || order.status === "delivering") return order.status === "ready" ? "Pedido pronto para retirada ou envio" : "Pedido a caminho";
  const eta = new Date(order.estimatedReadyAt);
  if (Number.isNaN(eta.getTime())) return "A equipe está preparando seu pedido";
  const minutes = Math.max(0, Math.ceil((eta.getTime() - Date.now()) / 60000));
  const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(eta);
  return minutes === 0 ? `Previsão: agora · ${time}` : `Previsão em cerca de ${minutes} min · ${time}`;
}

function orderCard(order, compact = false, customerView = false) {
  const customizations = [...order.customizations, ...order.extras.map(({ name }) => `Adicional: ${name}`)];
  const nextStatus = getNextOrderStatus(order);
  return `<article class="order-card ${compact ? "order-card-compact" : ""}">
    <div class="order-card-top"><span class="order-number">#${String(order.number).padStart(3, "0")}</span><span class="status-pill status-${order.status}">${statusNames[order.status]}</span></div>
    <div class="order-customer"><strong>${escapeHtml(order.customer.name)}</strong><span>${formatTime(order.createdAt)} · ${order.fulfillment === "delivery" ? "Entrega" : "Retirada"}</span></div>
    <div class="order-items">${order.quantity} × ${escapeHtml(order.product.name)}</div>
    ${customizations.length ? `<div class="order-tags">${customizations.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>` : ""}
    ${order.notes ? `<p class="order-note"><i data-lucide="message-square-text"></i>${escapeHtml(order.notes)}</p>` : ""}
    ${!compact && order.fulfillment === "delivery" && order.customer.address ? `<p class="order-address"><i data-lucide="map-pin"></i>${escapeHtml(order.customer.address)}</p>` : ""}
    ${!compact ? `<div class="order-eta"><i data-lucide="timer"></i><span>${escapeHtml(formatETA(order))}</span></div>` : ""}
    <div class="order-card-bottom"><strong>${formatCurrency(order.totalCents)}</strong><span class="payment-indicator ${order.paymentStatus}">${order.paymentStatus === "paid" ? "Pago" : "Pendente"} · ${order.paymentMethod === "pix" ? "Pix" : order.paymentMethod === "cash" ? "Dinheiro" : "Cartão"}</span></div>
    ${customerView ? "" : `<div class="order-card-actions">
      ${nextStatus ? `<button class="button button-soft" type="button" data-action="advance-status" data-id="${escapeAttr(order.id)}"><i data-lucide="arrow-right"></i>${nextStatus.action}</button>` : `<span class="completed-label"><i data-lucide="circle-check"></i>Pedido concluído</span>`}
      <button class="text-action" type="button" data-action="toggle-payment" data-id="${escapeAttr(order.id)}">${order.paymentStatus === "paid" ? "Marcar pendente" : "Marcar como pago"}</button>
      ${["waiting", "preparing"].includes(order.status) ? `<button class="text-action" type="button" data-action="extend-eta" data-id="${escapeAttr(order.id)}">Ajustar previsão +15 min</button>` : ""}
    </div>`}
  </article>`;
}

function dashboard() {
  const summary = getDailySummary(orders);
  const activeOrders = orders.filter((order) => order.dateKey === summary.dateKey).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const stageSummary = ORDER_STATUSES.map(({ id, label }) => `<div class="stage-row"><span class="stage-dot stage-dot-${id}"></span><span>${label}</span><strong>${summary.statusCounts[id]}</strong></div>`).join("");
  return `${pageHeading("ROTINA DA COZINHA", "Bom dia, Dona Marta <span class=\"wave\">☀</span>", "Um resumo simples para você cuidar de cada pedido com tranquilidade.", `<a class="button button-primary heading-action" href="#novo-pedido"><i data-lucide="plus"></i>Registrar pedido</a>`)}
    <section class="metrics-grid" aria-label="Resumo de hoje">
      ${metricCard("clipboard-list", "Pedidos de hoje", summary.orderCount, `${summary.statusCounts.waiting} aguardando preparo`, "green")}
      ${metricCard("chef-hat", "Em andamento", summary.statusCounts.preparing + summary.statusCounts.ready + summary.statusCounts.delivering, `${summary.statusCounts.preparing} em preparo · ${summary.statusCounts.ready} prontos`, "orange")}
      ${metricCard("circle-dollar-sign", "Faturamento do dia", formatCurrency(summary.revenueCents), `${summary.paidCount} ${summary.paidCount === 1 ? "pedido pago" : "pedidos pagos"}`, "green")}
      ${metricCard("clock-3", "Falta receber", formatCurrency(summary.pendingCents), `${summary.pendingCount} ${summary.pendingCount === 1 ? "pedido pendente" : "pedidos pendentes"}`, "yellow")}
    </section>
    <section class="dashboard-grid">
      <div class="panel today-panel"><div class="panel-heading"><div><p class="eyebrow">ACOMPANHAMENTO</p><h2>Pedidos de hoje</h2></div><a class="inline-link" href="#pedidos">Ver fila <i data-lucide="arrow-up-right"></i></a></div>
        ${activeOrders.length ? `<div class="today-list">${activeOrders.slice(0, 4).map((order) => orderCard(order, true)).join("")}</div>` : `<div class="empty-state"><span class="empty-icon"><i data-lucide="clipboard-plus"></i></span><strong>Seu dia começa por aqui</strong><p>Registre o primeiro pedido e acompanhe tudo nesta tela.</p><a class="button button-primary" href="#novo-pedido"><i data-lucide="plus"></i>Novo pedido</a></div>`}
      </div>
      <div class="panel stages-panel"><div class="panel-heading"><div><p class="eyebrow">NA COZINHA</p><h2>Etapas dos pedidos</h2></div><span class="panel-date">Hoje</span></div><div class="stage-list">${stageSummary}</div><div class="stage-footer"><span>Concluídos hoje</span><strong>${summary.statusCounts.completed}</strong></div><a class="panel-link" href="#pedidos">Abrir fila da cozinha <i data-lucide="arrow-right"></i></a></div>
    </section>
    <section class="tip-banner"><span><i data-lucide="sparkles"></i></span><div><strong>Uma coisa de cada vez</strong><p>Seus pedidos, personalizações e pagamentos estão organizados em um só lugar.</p></div><a href="#pedidos" aria-label="Ver pedidos"><i data-lucide="arrow-right"></i></a></section>`;
}

function customerOrdersPage() {
  const myOrders = [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return `${pageHeading("ACOMPANHE SEU PEDIDO", "Meus pedidos", "Veja o andamento e a previsão atualizada pela equipe da cozinha.", `<a class="button button-primary heading-action" href="#novo-pedido"><i data-lucide="plus"></i>Fazer pedido</a>`)}
    ${myOrders.length ? `<section class="customer-orders-list">${myOrders.map((order) => orderCard(order, false, true)).join("")}</section>` : `<section class="panel empty-state"><span class="empty-icon"><i data-lucide="clipboard-plus"></i></span><strong>Você ainda não fez um pedido</strong><p>Escolha sua marmita e acompanhe o preparo por aqui.</p><a class="button button-primary" href="#novo-pedido"><i data-lucide="plus"></i>Fazer primeiro pedido</a></section>`}`;
}

function kitchenQueue() {
  const summary = getDailySummary(orders);
  const filter = routeInfo().params.get("filtro") || "active";
  const visibleOrders = orders
    .filter((order) => filter === "all" || (filter === "today" ? order.dateKey === summary.dateKey : order.status !== "completed"))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const columns = ORDER_STATUSES.map(({ id, label, icon }) => {
    const items = visibleOrders.filter((order) => order.status === id);
    return `<section class="queue-column"><div class="queue-heading"><span class="queue-stage-icon stage-dot-${id}"><i data-lucide="${icon}"></i></span><div><h2>${label}</h2><small>${items.length} ${items.length === 1 ? "pedido" : "pedidos"}</small></div><span class="queue-count">${items.length}</span></div><div class="queue-cards">${items.length ? items.map((order) => orderCard(order)).join("") : `<div class="queue-empty">Nenhum pedido nesta etapa</div>`}</div></section>`;
  }).join("");
  return `${pageHeading("ORGANIZAÇÃO DA COZINHA", "Fila de pedidos", "Veja o que precisa ser preparado agora e avance cada pedido com um toque.", `<a class="button button-primary heading-action" href="#novo-pedido"><i data-lucide="plus"></i>Registrar pedido</a>`)}
    <div class="queue-help"><i data-lucide="info"></i><span>Pedidos atualizados automaticamente a cada 15 segundos. Use o botão em cada cartão para avançar na fila.</span><label class="queue-filter">Mostrar <select id="queue-filter"><option value="active" ${filter === "active" ? "selected" : ""}>Pedidos ativos</option><option value="all" ${filter === "all" ? "selected" : ""}>Todos os pedidos</option><option value="today" ${filter === "today" ? "selected" : ""}>Somente hoje</option></select></label></div>
    <div class="queue-board">${columns}</div>`;
}

function orderForm(customerId = "") {
  if (profile.role === "customer") return customerOrderForm();
  const customers = getCustomers();
  const selectedCustomer = customers.find((customer) => customer.id === customerId);
  const productOptions = products.map(({ id, name, priceCents }) => `<option value="${id}">${name} · ${formatCurrency(priceCents)}</option>`).join("");
  const extrasMarkup = extras.map(({ id, name, priceCents }) => `<label class="check-option"><input type="checkbox" name="extras" value="${id}"><span class="check-box"></span><span>${name}</span><small>+ ${formatCurrency(priceCents)}</small></label>`).join("");
  return `${pageHeading("NOVO PEDIDO", "Vamos anotar esse pedido", "Preencha o essencial. O valor é atualizado automaticamente.", "")}
    <form class="order-form" id="order-form">
      <section class="form-section"><div class="form-section-heading"><span class="form-step">1</span><div><h2>Quem está pedindo?</h2><p>Os dados ficam salvos para a próxima vez.</p></div></div>
        ${customers.length ? `<label class="field field-wide"><span>Cliente que já pediu antes <small>(opcional)</small></span><select id="customer-lookup"><option value="">Cliente novo</option>${customers.map((customer) => `<option value="${escapeAttr(customer.id)}" ${customer.id === customerId ? "selected" : ""}>${escapeHtml(customer.name)} · ${escapeHtml(customer.phone)}</option>`).join("")}</select></label>` : ""}
        <div class="form-grid"><label class="field"><span>Nome do cliente <b>*</b></span><input id="customer-name" name="customerName" value="${escapeAttr(selectedCustomer?.name || "")}" autocomplete="name" required placeholder="Ex.: Ana Souza"></label><label class="field"><span>Telefone / WhatsApp <b>*</b></span><input id="customer-phone" name="customerPhone" value="${escapeAttr(selectedCustomer?.phone || "")}" autocomplete="tel" required placeholder="(11) 99999-9999"></label></div>
      </section>
      <section class="form-section"><div class="form-section-heading"><span class="form-step">2</span><div><h2>O que vai na marmita?</h2><p>Escolha o prato e conte as preferências.</p></div></div>
        <div class="form-grid"><label class="field"><span>Tipo de marmita <b>*</b></span><select name="product" id="product-select" required>${productOptions}</select></label><label class="field"><span>Quantidade <b>*</b></span><input type="number" name="quantity" id="quantity-input" min="1" max="30" value="1" required></label></div>
        <fieldset class="choice-fieldset"><legend>Personalizações</legend><div class="check-grid"><label class="check-option"><input type="checkbox" name="customizations" value="Sem feijão"><span class="check-box"></span><span>Sem feijão</span></label><label class="check-option"><input type="checkbox" name="customizations" value="Sem salada"><span class="check-box"></span><span>Sem salada</span></label><label class="check-option"><input type="checkbox" name="customizations" value="Trocar salada por farofa"><span class="check-box"></span><span>Trocar salada por farofa</span></label></div></fieldset>
        <fieldset class="choice-fieldset"><legend>Adicionar um acompanhamento</legend><div class="check-grid">${extrasMarkup}</div></fieldset>
        <label class="field field-wide"><span>Observação para a cozinha <small>(opcional)</small></span><textarea name="notes" rows="2" placeholder="Ex.: molho separado, pouca pimenta..."></textarea></label>
      </section>
      <section class="form-section"><div class="form-section-heading"><span class="form-step">3</span><div><h2>Entrega e pagamento</h2><p>Deixe combinado como o pedido chega e será pago.</p></div></div>
        <fieldset class="choice-fieldset"><legend>Como vai receber?</legend><div class="segmented-options"><label><input type="radio" name="fulfillment" value="delivery" checked><span><i data-lucide="bike"></i>Entrega</span></label><label><input type="radio" name="fulfillment" value="pickup"><span><i data-lucide="store"></i>Retirada no local</span></label></div></fieldset>
        <label class="field field-wide" id="address-field"><span>Endereço de entrega <b>*</b></span><input id="customer-address" name="customerAddress" value="${escapeAttr(selectedCustomer?.address || "")}" autocomplete="street-address" placeholder="Rua, número, bairro"></label>
        <div class="form-grid payment-fields"><label class="field"><span>Forma de pagamento <b>*</b></span><select name="paymentMethod"><option value="pix">Pix</option><option value="cash">Dinheiro</option><option value="card">Cartão</option></select></label><label class="field"><span>Pagamento</span><select name="paymentStatus"><option value="pending">Ainda não pago</option><option value="paid">Já foi pago</option></select></label></div>
      </section>
      <aside class="form-total"><div><span>Total do pedido</span><small id="total-description">1 marmita · sem adicionais</small></div><strong id="order-total">${formatCurrency(products[0].priceCents)}</strong></aside>
      <div class="form-actions"><a class="button button-outline" href="#pedidos">Cancelar</a><button class="button button-primary submit-order" type="submit"><i data-lucide="check"></i>Salvar pedido</button></div>
    </form>`;
}

function customerOrderForm() {
  const previousAddress = orders.find((order) => order.customer.address)?.customer.address || "";
  const productOptions = products.map(({ id, name, priceCents }) => `<option value="${id}">${name} · ${formatCurrency(priceCents)}</option>`).join("");
  const extrasMarkup = extras.map(({ id, name, priceCents }) => `<label class="check-option"><input type="checkbox" name="extras" value="${id}"><span class="check-box"></span><span>${name}</span><small>+ ${formatCurrency(priceCents)}</small></label>`).join("");
  return `${pageHeading("NOVO PEDIDO", "Peça sua marmita", "Escolha o prato e conte à cozinha como você prefere.", "")}
    <form class="order-form customer-order-form" id="order-form">
      <section class="form-section"><div class="form-section-heading"><span class="form-step">1</span><div><h2>Quem vai receber?</h2><p>Usaremos os dados da sua conta para identificar o pedido.</p></div></div><div class="account-details"><strong>${escapeHtml(profile.full_name)}</strong><span>${escapeHtml(profile.phone)}</span></div></section>
      <section class="form-section"><div class="form-section-heading"><span class="form-step">2</span><div><h2>Escolha sua marmita</h2><p>Personalizações e adicionais serão enviados para a cozinha.</p></div></div>
        <div class="form-grid"><label class="field"><span>Tipo de marmita <b>*</b></span><select name="product" id="product-select" required>${productOptions}</select></label><label class="field"><span>Quantidade <b>*</b></span><input type="number" name="quantity" id="quantity-input" min="1" max="30" value="1" required></label></div>
        <fieldset class="choice-fieldset"><legend>Personalizações</legend><div class="check-grid"><label class="check-option"><input type="checkbox" name="customizations" value="Sem feijão"><span class="check-box"></span><span>Sem feijão</span></label><label class="check-option"><input type="checkbox" name="customizations" value="Sem salada"><span class="check-box"></span><span>Sem salada</span></label><label class="check-option"><input type="checkbox" name="customizations" value="Trocar salada por farofa"><span class="check-box"></span><span>Trocar salada por farofa</span></label></div></fieldset>
        <fieldset class="choice-fieldset"><legend>Adicionar um acompanhamento</legend><div class="check-grid">${extrasMarkup}</div></fieldset>
        <label class="field field-wide"><span>Observação para a cozinha <small>(opcional)</small></span><textarea name="notes" rows="2" maxlength="500" placeholder="Ex.: molho separado, pouca pimenta..."></textarea></label>
      </section>
      <section class="form-section"><div class="form-section-heading"><span class="form-step">3</span><div><h2>Entrega e pagamento</h2><p>A equipe verá a forma de recebimento escolhida.</p></div></div>
        <fieldset class="choice-fieldset"><legend>Como vai receber?</legend><div class="segmented-options"><label><input type="radio" name="fulfillment" value="delivery" checked><span><i data-lucide="bike"></i>Entrega</span></label><label><input type="radio" name="fulfillment" value="pickup"><span><i data-lucide="store"></i>Retirada no local</span></label></div></fieldset>
        <label class="field field-wide" id="address-field"><span>Endereço de entrega <b>*</b></span><input id="customer-address" name="customerAddress" value="${escapeAttr(previousAddress)}" maxlength="300" autocomplete="street-address" placeholder="Rua, número, bairro"></label>
        <div class="form-grid payment-fields"><label class="field"><span>Forma de pagamento <b>*</b></span><select name="paymentMethod"><option value="pix">Pix</option><option value="cash">Dinheiro</option><option value="card">Cartão</option></select></label><div class="payment-pending-note"><i data-lucide="info"></i><span>O pagamento fica pendente até a equipe confirmar o recebimento.</span></div></div>
      </section>
      <aside class="form-total"><div><span>Total do pedido</span><small id="total-description">1 marmita · sem adicionais</small></div><strong id="order-total">${formatCurrency(products[0].priceCents)}</strong></aside>
      <div class="form-actions"><a class="button button-outline" href="#pedidos">Cancelar</a><button class="button button-primary submit-order" type="submit"><i data-lucide="check"></i>Enviar pedido</button></div>
    </form>`;
}

function customersPage() {
  const customers = getCustomers();
  return `${pageHeading("SEUS CLIENTES", "Gente que volta sempre", "Consulte contatos e endereços usados para agilizar o próximo pedido.", `<a class="button button-primary heading-action" href="#novo-pedido"><i data-lucide="plus"></i>Novo pedido</a>`)}
    <section class="panel customers-panel"><div class="panel-heading"><div><p class="eyebrow">CLIENTES CADASTRADOS</p><h2>${customers.length} ${customers.length === 1 ? "pessoa" : "pessoas"}</h2></div><div class="customer-search"><i data-lucide="search"></i><input id="customer-search" type="search" placeholder="Buscar por nome ou telefone" aria-label="Buscar clientes"></div></div>
      ${customers.length ? `<div class="customer-list" id="customer-list">${customers.map((customer) => `<article class="customer-row" data-search="${escapeAttr(`${customer.name} ${customer.phone}`.toLocaleLowerCase("pt-BR"))}"><span class="customer-avatar">${escapeHtml(customer.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase())}</span><div class="customer-info"><strong>${escapeHtml(customer.name)}</strong><span>${escapeHtml(customer.phone)}</span></div><div class="customer-address"><i data-lucide="map-pin"></i><span>${customer.address ? escapeHtml(customer.address) : "Sem endereço salvo (retirada)"}</span></div><a class="button button-soft" href="#novo-pedido?cliente=${encodeURIComponent(customer.id)}"><i data-lucide="plus"></i>Novo pedido</a></article>`).join("")}<p class="no-search-results" hidden>Nenhum cliente encontrado.</p></div>` : `<div class="empty-state"><span class="empty-icon"><i data-lucide="users-round"></i></span><strong>Seus clientes aparecem aqui</strong><p>Quando você registrar um pedido, o contato será guardado para facilitar os próximos.</p><a class="button button-primary" href="#novo-pedido"><i data-lucide="plus"></i>Registrar primeiro pedido</a></div>`}
    </section>`;
}

function cashPage() {
  const summary = getDailySummary(orders);
  const methods = [
    { key: "pix", label: "Pix", icon: "qr-code" },
    { key: "cash", label: "Dinheiro", icon: "banknote" },
    { key: "card", label: "Cartão", icon: "credit-card" },
  ];
  const todayOrders = orders.filter((order) => order.dateKey === summary.dateKey).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return `${pageHeading("FECHAMENTO DO DIA", "Caixa sem surpresa", "Confira o faturamento e o que realmente entrou no caixa hoje.", `<span class="date-chip"><i data-lucide="calendar-days"></i>${currentDateLabel()}</span>`)}
    <section class="cash-highlight"><div><span>Faturamento total</span><strong>${formatCurrency(summary.revenueCents)}</strong><small>${summary.orderCount} ${summary.orderCount === 1 ? "pedido registrado" : "pedidos registrados"}</small></div><span class="cash-highlight-icon"><i data-lucide="chart-no-axes-combined"></i></span></section>
    <section class="cash-metrics">
      ${methods.map(({ key, label, icon }) => `<article class="panel cash-method"><span class="cash-method-icon"><i data-lucide="${icon}"></i></span><div><span>Recebido em ${label}</span><strong>${formatCurrency(summary.receivedByMethod[key])}</strong></div></article>`).join("")}
      <article class="panel cash-method pending-method"><span class="cash-method-icon"><i data-lucide="clock-3"></i></span><div><span>Falta receber</span><strong>${formatCurrency(summary.pendingCents)}</strong></div></article>
    </section>
    <section class="cash-bottom-grid"><article class="panel payment-counts"><div class="panel-heading"><div><p class="eyebrow">CONFERÊNCIA</p><h2>Situação dos pagamentos</h2></div></div><div class="payment-count-row"><span><i class="count-dot paid-dot"></i>Pagos</span><strong>${summary.paidCount}</strong></div><div class="payment-count-row"><span><i class="count-dot pending-dot"></i>Pendentes</span><strong>${summary.pendingCount}</strong></div><div class="cash-note"><i data-lucide="info"></i><span>O faturamento inclui todos os pedidos. O valor recebido considera apenas os pedidos marcados como pagos.</span></div></article>
      <article class="panel cash-orders"><div class="panel-heading"><div><p class="eyebrow">MOVIMENTO DE HOJE</p><h2>Últimos pedidos</h2></div><a href="#pedidos" class="inline-link">Ver fila <i data-lucide="arrow-up-right"></i></a></div>${todayOrders.length ? `<div class="cash-order-list">${todayOrders.slice(0, 5).map((order) => `<div class="cash-order-row"><span class="order-number">#${String(order.number).padStart(3, "0")}</span><span class="cash-customer">${escapeHtml(order.customer.name)}<small>${order.paymentStatus === "paid" ? (order.paymentMethod === "pix" ? "Pix" : order.paymentMethod === "cash" ? "Dinheiro" : "Cartão") : "Pagamento pendente"}</small></span><strong>${formatCurrency(order.totalCents)}</strong></div>`).join("")}</div>` : `<p class="no-cash-orders">Ainda não há pedidos registrados hoje.</p>`}</article>
    </section>`;
}

function operatorApprovalPage() {
  return `<section class="auth-page"><div class="auth-card config-card"><span class="brand-mark"><i data-lucide="shield-check"></i></span><p class="eyebrow">SOLICITAÇÃO RECEBIDA</p><h1>Aguardando autorização</h1><p class="auth-description">Sua conta foi criada, mas ainda não tem acesso aos pedidos da cozinha. Peça à pessoa responsável para aprovar seu perfil de equipe.</p><div class="auth-notice"><strong>O acesso da equipe é protegido.</strong><span>Somente a administração pode aprovar esta solicitação. Depois da aprovação, entre novamente pela opção “Sou da equipe”.</span></div><button class="button button-outline" type="button" data-action="sign-out">Sair da conta</button></div></section>`;
}

function render() {
  if (!authReady) {
    app.innerHTML = `<section class="auth-page"><div class="auth-card"><span class="brand-mark"><i data-lucide="soup"></i></span><h1>Carregando sua conta...</h1><p class="auth-description">Estamos verificando seu acesso com segurança.</p></div></section>`;
    createIcons({ icons });
    return;
  }
  if (!session) {
    app.innerHTML = authPage();
    createIcons({ icons });
    bindAuthForm();
    return;
  }
  if (contextLoading) {
    app.innerHTML = `<section class="auth-page"><div class="auth-card"><span class="brand-mark"><i data-lucide="soup"></i></span><h1>Carregando seus pedidos...</h1><p class="auth-description">Só um instante.</p></div></section>`;
    createIcons({ icons });
    return;
  }
  if (!profile) {
    app.innerHTML = `<section class="auth-page"><div class="auth-card"><span class="brand-mark"><i data-lucide="circle-alert"></i></span><h1>Não foi possível abrir sua conta</h1><p class="auth-error" role="alert">${escapeHtml(flashMessage || "Confira a configuração do projeto e tente novamente.")}</p><button class="button button-outline" type="button" data-action="sign-out">Sair da conta</button></div></section>`;
    createIcons({ icons });
    return;
  }
  if (operatorAccessPending && profile.role !== "operator") {
    app.innerHTML = operatorApprovalPage();
    createIcons({ icons });
    return;
  }
  const { route, params } = routeInfo();
  const pages = profile.role === "operator" ? {
    "#inicio": dashboard,
    "#pedidos": kitchenQueue,
    "#clientes": customersPage,
    "#caixa": cashPage,
    "#novo-pedido": () => orderForm(params.get("cliente") || ""),
  } : {
    "#pedidos": customerOrdersPage,
    "#novo-pedido": () => orderForm(),
  };
  const fallbackRoute = profile.role === "operator" ? "#inicio" : "#pedidos";
  if (!pages[route]) {
    location.hash = fallbackRoute;
    return;
  }
  const activeRoute = route === "#novo-pedido" ? (profile.role === "operator" ? "#pedidos" : "#novo-pedido") : route;
  app.innerHTML = shell(pages[route](), activeRoute);
  createIcons({ icons });
  if (route === "#novo-pedido") bindOrderForm();
  if (profile.role === "operator" && route === "#clientes") bindCustomerSearch();
  if (profile.role === "operator" && route === "#pedidos") bindQueueFilter();
}

function bindOrderForm() {
  const form = document.getElementById("order-form");
  if (!form) return;
  const addressField = document.getElementById("address-field");
  const addressInput = document.getElementById("customer-address");
  const updateFulfillment = () => {
    const delivery = form.elements.fulfillment.value === "delivery";
    addressField.hidden = !delivery;
    addressInput.required = delivery;
  };
  const updateTotal = () => {
    const data = new FormData(form);
    const quantity = Number(data.get("quantity"));
    try {
      const product = getProduct(data.get("product"));
      const chosenExtras = getExtras(data.getAll("extras"));
      const total = calculateOrderTotal({ unitPriceCents: product.priceCents, quantity, extras: chosenExtras });
      document.getElementById("order-total").textContent = formatCurrency(total);
      document.getElementById("total-description").textContent = `${quantity} ${quantity === 1 ? "marmita" : "marmitas"} · ${chosenExtras.length ? `${chosenExtras.length} adicional(is)` : "sem adicionais"}`;
    } catch (error) {
      document.getElementById("order-total").textContent = "—";
      document.getElementById("total-description").textContent = error.message;
    }
  };
  form.addEventListener("change", (event) => {
    if (event.target.name === "fulfillment") updateFulfillment();
    if (event.target.matches("#customer-lookup")) {
      const customer = getCustomers().find(({ id }) => id === event.target.value);
      document.getElementById("customer-name").value = customer?.name || "";
      document.getElementById("customer-phone").value = customer?.phone || "";
      addressInput.value = customer?.address || "";
    }
    updateTotal();
  });
  form.addEventListener("input", updateTotal);
  updateFulfillment();
  updateTotal();
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const submitButton = form.querySelector('[type="submit"]');
    submitButton.disabled = true;
    try {
      const now = new Date();
      const order = createOrder({
        number: 1,
        customer: {
          id: profile.role === "customer" ? profile.id : "",
          name: profile.role === "customer" ? profile.full_name : data.get("customerName").trim(),
          phone: profile.role === "customer" ? profile.phone : data.get("customerPhone").trim(),
          address: data.get("fulfillment") === "delivery" ? data.get("customerAddress").trim() : "",
        },
        product: getProduct(data.get("product")),
        quantity: Number(data.get("quantity")),
        customizations: data.getAll("customizations"),
        extras: getExtras(data.getAll("extras")),
        notes: (data.get("notes") || "").trim(),
        fulfillment: data.get("fulfillment"),
        paymentMethod: data.get("paymentMethod"),
        paymentStatus: profile.role === "customer" ? "pending" : data.get("paymentStatus"),
      }, now);
      const linkedCustomerId = profile.role === "operator" ? data.get("customerLookup") : null;
      const savedOrder = await insertOrder(order, linkedCustomerId);
      orders = [savedOrder, ...orders.filter(({ id }) => id !== savedOrder.id)];
      flashMessage = profile.role === "customer"
        ? `Pedido #${String(savedOrder.number).padStart(3, "0")} enviado. Acompanhe a previsão por aqui.`
        : `Pedido #${String(savedOrder.number).padStart(3, "0")} salvo. Bom trabalho!`;
      flashType = "success";
      location.hash = "#pedidos";
    } catch (error) {
      flashMessage = error.message || "Não foi possível salvar. Tente novamente.";
      flashType = "error";
      render();
    } finally {
      if (submitButton.isConnected) submitButton.disabled = false;
    }
  });
}

function bindQueueFilter() {
  const filter = document.getElementById("queue-filter");
  if (!filter) return;
  filter.addEventListener("change", () => {
    location.hash = `#pedidos?filtro=${encodeURIComponent(filter.value)}`;
  });
}

function bindCustomerSearch() {
  const search = document.getElementById("customer-search");
  if (!search) return;
  search.addEventListener("input", () => {
    const query = search.value.trim().toLocaleLowerCase("pt-BR");
    const rows = [...document.querySelectorAll(".customer-row")];
    let visible = 0;
    for (const row of rows) {
      const matches = row.dataset.search.includes(query);
      row.hidden = !matches;
      if (matches) visible += 1;
    }
    document.querySelector(".no-search-results").hidden = visible !== 0;
  });
}

async function mutateOrder(id, getChanges) {
  try {
    const currentOrder = orders.find((order) => order.id === id);
    if (!currentOrder) throw new Error("Esse pedido não está mais disponível.");
    const changes = getChanges(currentOrder);
    const savedOrder = await updateOrder(id, changes);
    orders = orders.map((order) => order.id === id ? savedOrder : order);
    render();
  } catch (error) {
    flashMessage = error.message || "Não foi possível atualizar o pedido.";
    flashType = "error";
    render();
  }
}

async function applySession(nextProfile, pendingAccess = false) {
  if (orderRefreshTimer) clearInterval(orderRefreshTimer);
  orderRefreshTimer = null;
  session = nextProfile ? { user: { id: nextProfile.id } } : null;
  profile = nextProfile;
  operatorAccessPending = Boolean(nextProfile && pendingAccess);
  orders = [];
  contextLoading = Boolean(nextProfile);
  authReady = true;
  if (!nextProfile) {
    authMode = "login";
    operatorAccessPending = false;
    render();
    return;
  }
  render();
  try {
    orders = await fetchOrders();
    contextLoading = false;
    flashMessage = "";
    orderRefreshTimer = setInterval(() => {
      const focusedField = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
      if (!document.hidden && !focusedField && routeInfo().route !== "#novo-pedido" && !isRefreshingOrders) void refreshOrders();
    }, 15000);
    if (!location.hash) location.hash = profile.role === "operator" ? "#inicio" : "#pedidos";
    render();
  } catch (error) {
    contextLoading = false;
    flashMessage = error.message || "Não foi possível abrir sua conta.";
    flashType = "error";
    profile = null;
    render();
  }
}

function bindAuthForm() {
  const form = document.getElementById("auth-form");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const button = form.querySelector('[type="submit"]');
    const data = new FormData(form);
    const email = String(data.get("email")).trim().toLowerCase();
    const password = String(data.get("password"));
    button.disabled = true;
    flashMessage = "";
    try {
      if (authMode === "signup") {
        const fullName = String(data.get("fullName")).trim();
        const phone = String(data.get("phone")).trim();
        if (password.length < 8) throw new Error("A senha precisa ter pelo menos 8 caracteres.");
        const signup = await apiRequest("/api/auth/signup", {
          method: "POST",
          body: { email, password, fullName, phone, accountType: authAudience },
        });
        await applySession(signup.profile, signup.operatorAccessPending);
        if (authAudience === "customer") location.hash = "#pedidos";
        return;
      }

      const login = await apiRequest("/api/auth/login", { method: "POST", body: { email, password } });
      await applySession(login.profile, login.operatorAccessPending);
      if (!profile) throw new Error(flashMessage || "Não foi possível carregar o perfil desta conta.");
      if (authAudience === "operator" && login.operatorAccessPending && profile.role === "customer") return;
      if (profile?.role !== authAudience) {
        await apiRequest("/api/auth/logout", { method: "POST" });
        await apiRequest("/api/session");
        await applySession(null);
        throw new Error(authAudience === "operator"
          ? "Esta conta não tem acesso de equipe. Peça ao responsável para habilitar o perfil."
          : "Esta conta é de equipe. Selecione “Sou da equipe” para entrar.");
      }
      location.hash = profile.role === "operator" ? "#inicio" : "#pedidos";
      render();
    } catch (error) {
      flashType = "error";
      flashMessage = error.message || "Não foi possível acessar a conta. Confira os dados e tente novamente.";
      render();
    } finally {
      if (button.isConnected) button.disabled = false;
    }
  });
}

async function refreshOrders() {
  if (!profile || isRefreshingOrders) return;
  isRefreshingOrders = true;
  try {
    const freshOrders = await fetchOrders();
    if (JSON.stringify(freshOrders) !== JSON.stringify(orders)) {
      orders = freshOrders;
      render();
    }
  } catch (error) {
    flashMessage = error.message || "Não foi possível atualizar os pedidos.";
    flashType = "error";
    render();
  } finally {
    isRefreshingOrders = false;
  }
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  if (button.dataset.action === "auth-audience") {
    authAudience = button.dataset.audience;
    authMode = "login";
    flashMessage = "";
    render();
  }
  if (button.dataset.action === "auth-mode") {
    authMode = button.dataset.mode;
    flashMessage = "";
    render();
  }
  if (button.dataset.action === "clear-flash") {
    flashMessage = "";
    render();
  }
  if (button.dataset.action === "advance-status") {
    const order = orders.find(({ id }) => id === button.dataset.id);
    if (!order) return;
    mutateOrder(order.id, (current) => ({ status: advanceOrderStatus(current).status }));
  }
  if (button.dataset.action === "toggle-payment") {
    mutateOrder(button.dataset.id, (order) => ({ paymentStatus: order.paymentStatus === "paid" ? "pending" : "paid" }));
  }
  if (button.dataset.action === "extend-eta") {
    mutateOrder(button.dataset.id, (order) => {
      const current = new Date(order.estimatedReadyAt).getTime();
      const start = Number.isFinite(current) ? Math.max(Date.now(), current) : Date.now();
      return { estimatedReadyAt: new Date(start + 15 * 60 * 1000).toISOString() };
    });
  }
  if (button.dataset.action === "sign-out") {
    void apiRequest("/api/auth/logout", { method: "POST" })
      .then(() => apiRequest("/api/session"))
      .then(() => applySession(null))
      .catch((error) => {
        flashMessage = error.message || "Não foi possível sair da conta.";
        flashType = "error";
        render();
      });
  }
  if (button.dataset.action === "retry-server") {
    void initializeApp();
  }
});

addEventListener("hashchange", render);

async function initializeApp() {
  try {
    const currentSession = await apiRequest("/api/session");
    await applySession(currentSession.profile, currentSession.operatorAccessPending);
  } catch (error) {
    authReady = true;
    app.innerHTML = serverUnavailablePage(error);
    flashType = "error";
    createIcons({ icons });
  }
}

void initializeApp();
