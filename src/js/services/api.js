let csrfToken = "";

export function updateCsrfToken(token) {
  csrfToken = token || "";
}

export async function apiRequest(path, options = {}) {
  const method = options.method || "GET";
  const headers = { Accept: "application/json", ...options.headers };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (!["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) {
    headers["X-CSRF-Token"] = csrfToken;
  }
  let response;
  try {
    response = await fetch(path, {
      method,
      headers,
      credentials: "same-origin",
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new Error("Não foi possível conversar com o servidor Python. Confira se ele está ativo.");
  }
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("O servidor respondeu em um formato inesperado. Tente novamente.");
  }
  if (result.csrfToken) updateCsrfToken(result.csrfToken);
  if (!response.ok) throw new Error(result.error || "Não foi possível concluir a solicitação.");
  return result;
}
