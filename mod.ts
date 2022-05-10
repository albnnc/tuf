import * as bin from "./bindings/bindings.ts";

export type TuRequest = {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  timeout?: number;
  acceptInvalidHostnames?: boolean;
  acceptInvalidCerts?: boolean;
};

export type TuResponse = {
  status: number;
  headers: Record<string, string>;
  body: Uint8Array;
};

// TODO: Remove casting when new version will be released.
// See https://github.com/denoland/deno_bindgen/commit/58bffa2784bc58b931d4afd84e7860c53979b397
export async function tuFetch(req: TuRequest): Promise<TuResponse> {
  const { status, body, ...rest } = await bin.fetch({
    url: req.url,
    method: req.method ?? "GET",
    // deno-lint-ignore no-explicit-any
    headers: (req.headers as any) ?? undefined,
    timeout: req.timeout ? Math.floor(req.timeout) : undefined,
    accept_invalid_hostnames: req.acceptInvalidHostnames ?? undefined,
    accept_invalid_certs: req.acceptInvalidCerts ?? undefined,
  });
  if (!status) {
    throw new Error("Request failed");
  }
  return {
    status,
    body: new Uint8Array(body),
    // deno-lint-ignore no-explicit-any
    ...(rest as any),
  };
}

export interface KyReqHookOptions
  extends Pick<TuRequest, "acceptInvalidHostnames" | "acceptInvalidCerts"> {
  ignore?: (req: Request) => boolean;
}

export function createKyReqHook({ ignore, ...rest }: KyReqHookOptions) {
  return async (req: Request): Promise<Request | Response> => {
    if (ignore) {
      if (ignore(req)) {
        return req;
      }
    } else {
      const parsed = new URL(req.url);
      if (
        parsed.protocol !== "https:" ||
        !parsed.hostname.match(/\d+\.\d+\.\d+\.\d+/)
      ) {
        return req;
      }
    }
    const resp = await tuFetch({
      url: req.url,
      method: req.method,
      headers: Array.from(req.headers.entries()).reduce(
        (p, [k, v]) => ({ ...p, [k]: v }),
        {}
      ),
      ...rest,
    });
    return new Response(resp.body, {
      status: resp.status,
      headers: resp.headers,
    });
  };
}
