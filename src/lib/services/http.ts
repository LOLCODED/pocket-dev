import { invoke } from "@tauri-apps/api/core";

export interface HttpHeader {
  name: string;
  value: string;
}

export interface HttpRequest {
  method: string;
  url: string;
  headers: HttpHeader[];
  body?: string | null;
}

export interface HttpResponse {
  status: number;
  headers: HttpHeader[];
  body: string;
  took_ms: number;
  size_bytes: number;
}

export interface SavedEndpoint {
  id: string;
  name: string;
  method: string;
  url: string;
  headers: HttpHeader[];
  body?: string | null;
}

export const httpService = {
  send: (request: HttpRequest) =>
    invoke<HttpResponse>("send_request", { request }),
  listSaved: () => invoke<SavedEndpoint[]>("list_saved_endpoints"),
  save: (endpoint: SavedEndpoint) =>
    invoke<SavedEndpoint>("save_endpoint", { endpoint }),
  delete: (id: string) => invoke<void>("delete_endpoint", { id }),
};
