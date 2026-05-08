import axios, {
  AxiosError,
  AxiosHeaders,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";
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

      if (status !== 401 || !original || original.__retried) {
        throw error;
      }

      // Resolve the request URL against the base URL and check the pathname so
      // benign URLs like `/users?next=/auth/refresh` don't trip this guard.
      let pathname = "";
      try {
        pathname = new URL(original.url ?? "", baseURL).pathname;
      } catch {
        pathname = original.url ?? "";
      }
      if (pathname.endsWith("/auth/refresh")) {
        throw error;
      }

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

      // Only mark the request as retried after a successful refresh, so that
      // concurrent 401s don't permanently lock themselves out of a future
      // re-refresh attempt if the in-flight refresh failed.
      original.__retried = true;
      // Some raw configs (e.g. ones constructed from interceptors or tests)
      // arrive without an `AxiosHeaders` instance. Ensure we always have one
      // before calling `.set(...)`.
      if (!original.headers) {
        original.headers = new AxiosHeaders();
      }
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
