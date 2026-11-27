export const products = [
  { id: "frango", name: "Frango grelhado", priceCents: 2490 },
  { id: "carne", name: "Carne de panela", priceCents: 2690 },
  { id: "vegetariana", name: "Marmita vegetariana", priceCents: 2390 },
  { id: "executiva", name: "Marmita executiva", priceCents: 2990 },
];

export const extras = [
  { id: "farofa", name: "Farofa", priceCents: 300 },
  { id: "ovo", name: "Ovo", priceCents: 250 },
  { id: "bacon", name: "Bacon", priceCents: 400 },
];

export function getProduct(id) {
  const product = products.find((item) => item.id === id);
  if (!product) throw new TypeError("Escolha uma marmita válida.");
  return product;
}

export function getExtras(ids) {
  const selectedIds = [...new Set(ids)];
  const selected = extras.filter(({ id }) => selectedIds.includes(id));
  if (selected.length !== selectedIds.length) throw new TypeError("Um acompanhamento escolhido não está disponível.");
  return selected;
}
