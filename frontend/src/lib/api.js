// Set in frontend/.env (see .env.example)
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

// Sends a request to the backend and returns the JSON body.
// Throws an Error with the backend's message when the request fails,
// so pages can show it to the user.
async function request(path, { headers, ...options } = {}) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      headers: { "Content-Type": "application/json", ...headers },
      ...options,
    });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new Error("Cannot reach the server. Check that the backend is running.", { cause: err });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || "Something went wrong");
    error.status = res.status;
    error.attemptsLeft = data.attemptsLeft;
    throw error;
  }
  return data;
}

// filters: { status, category, q, returned }. Empty values are left out.
export function getItems(filters = {}, { signal } = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== "" && value !== undefined && value !== null) params.set(key, value);
  }
  const query = params.toString();
  return request(`/items${query ? `?${query}` : ""}`, { signal });
}

export function getItem(id) {
  return request(`/items/${id}`);
}

export function createItem(item) {
  return request("/items", { method: "POST", body: JSON.stringify(item) });
}

// Returns { message, contact } when the answer is correct.
// Throws with error.attemptsLeft when it is wrong.
export function claimItem(id, answer) {
  return request(`/items/${id}/claim`, { method: "POST", body: JSON.stringify({ answer }) });
}

export function markReturned(id) {
  return request(`/items/${id}/returned`, { method: "PATCH" });
}

// reason: spam | fake | wrong-info. reporterId: see lib/reporter.js
// Returns { message, hidden }. Throws with status 409 if already reported.
export function reportItem(id, reason, reporterId) {
  return request(`/items/${id}/report`, { method: "POST", body: JSON.stringify({ reason, reporterId }) });
}

// Admin only. password is the server's ADMIN_TOKEN
const asAdmin = (password) => ({ Authorization: `Bearer ${password}` });

export function getReported(password) {
  return request("/admin/reports", { headers: asAdmin(password) });
}

export function restoreItem(id, password) {
  return request(`/admin/items/${id}/restore`, { method: "POST", headers: asAdmin(password) });
}

export function deleteItem(id, password) {
  return request(`/admin/items/${id}`, { method: "DELETE", headers: asAdmin(password) });
}
