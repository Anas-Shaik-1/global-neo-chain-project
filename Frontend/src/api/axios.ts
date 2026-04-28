import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from "axios";
import type { AppStore } from "@/app/store";
import { accessTokenRefreshed, sessionCleared } from "@/features/auth/authSlice";

interface CreateApiClientOptions {
  store: AppStore;
  baseURL: string;
}

interface RetriedConfig extends InternalAxiosRequestConfig {
  __retried?: boolean;
}

export function createApiClient({ store, baseURL }: CreateApiClientOptions): AxiosInstance {
  const api = axios.create({ baseURL, withCredentials: true });

  let pendingRefresh: Promise<string | null> | null = null;

  api.interceptors.request.use((config) => {
    const token = store.getState().auth.accessToken;
    if (token) {
      config.headers.set("Authorization", `Bearer ${token}`);
    }
    return config;
  });

  api.interceptors.response.use(
    (r) => r,
    async (error: AxiosError) => {
      const original = error.config as RetriedConfig | undefined;
      const status = error.response?.status;
      const url = original?.url ?? "";

      if (status !== 401 || !original || original.__retried || url.includes("/auth/refresh")) {
        throw error;
      }

      original.__retried = true;

      if (!pendingRefresh) {
        pendingRefresh = (async () => {
          try {
            const res = await api.post<{ accessToken: string }>("/auth/refresh");
            store.dispatch(accessTokenRefreshed(res.data.accessToken));
            return res.data.accessToken;
          } catch {
            store.dispatch(sessionCleared());
            return null;
          } finally {
            pendingRefresh = null;
          }
        })();
      }

      const newToken = await pendingRefresh;
      if (!newToken) throw error;

      original.headers.set("Authorization", `Bearer ${newToken}`);
      return api(original);
    },
  );

  return api;
}

let singleton: AxiosInstance | null = null;

export function setupApiClient(store: AppStore, baseURL: string): AxiosInstance {
  singleton = createApiClient({ store, baseURL });
  return singleton;
}

export function getApi(): AxiosInstance {
  if (!singleton) throw new Error("API client not initialised — call setupApiClient first");
  return singleton;
}
