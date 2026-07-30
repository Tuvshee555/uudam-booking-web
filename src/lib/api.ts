import axios from "axios";

/**
 * Shared API client.
 *
 * The API now lives inside this same Next app, so the base URL is a relative
 * `/api` — no cross-origin request, no CORS preflight, and nothing to
 * reconfigure when the domain changes. NEXT_PUBLIC_BACKEND_URL only needs a
 * value if you deliberately point the frontend at a different deployment.
 *
 *   import { api } from "@/lib/api";
 *   const { data } = await api.get(`/trips/${slug}`);
 *   await api.post("/bookings", payload);
 */
export const API_BASE_URL = `${process.env.NEXT_PUBLIC_BACKEND_URL ?? ""}/api`;

export const api = axios.create({ baseURL: API_BASE_URL });

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

/**
 * Pull a human-readable message out of a failed request.
 *
 * The API answers errors as `{ message }`, so surfacing that beats showing
 * axios's "Request failed with status code 409" to a customer.
 */
export function apiErrorMessage(error: unknown, fallback = "Алдаа гарлаа"): string {
  if (axios.isAxiosError(error)) {
    const message = (error.response?.data as { message?: string } | undefined)?.message;
    if (typeof message === "string" && message.trim()) return message;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
