import type { AxiosRequestConfig } from "axios";
import { getApi } from "./axios";

export async function orvalAxios<T>(config: AxiosRequestConfig): Promise<T> {
  const res = await getApi().request<T>(config);
  return res.data;
}

export type OrvalErrorType<E> = E;
