import { apiFetch } from "./api";

export const userService = {
  list: () => apiFetch("/api/users"),
  get: (id) => apiFetch(`/api/users/${id}`),
  create: (payload) => apiFetch("/api/users", {
    method: "POST",
    body: JSON.stringify(payload),
  }),
  update: (id, payload) => apiFetch(`/api/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }),
  remove: (id) => apiFetch(`/api/users/${id}`, { method: "DELETE" }),
};
