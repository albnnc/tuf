import * as bin from "./bindings/bindings.ts";

export type TuRequest = {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  acceptInvalidHostnames?: boolean;
  acceptInvalidCerts?: boolean;
};

export type TuResponse = {
  status: number;
  headers: Record<string, string>;
  body: Uint8Array;
};

export async function tuFetch(req: TuRequest): Promise<TuResponse> {
  const { body, ...rest } = await bin.fetch({
    url: req.url,
    method: req.method ?? "GET",
    headers: req.headers ?? undefined,
    accept_invalid_hostnames: req.acceptInvalidHostnames ?? undefined,
    accept_invalid_certs: req.acceptInvalidCerts ?? undefined,
  });
  return {
    ...rest,
    body: new Uint8Array(body),
  };
}

export function createKyReqHook(
  opts: Pick<TuRequest, "acceptInvalidHostnames" | "acceptInvalidCerts">
) {
  return async (req: Request): Promise<Request | Response> => {
    const parsed = new URL(req.url);
    if (
      parsed.protocol !== "https:" ||
      !parsed.hostname.match(/\d+\.\d+\.\d+\.\d+/)
    ) {
      return req;
    }
    const resp = await tuFetch({
      url: req.url,
      method: req.method,
      headers: Array.from(req.headers.entries()).reduce(
        (p, [k, v]) => ({ ...p, [k]: v }),
        {}
      ),
      ...opts,
    });
    return new Response(resp.body, {
      status: resp.status,
      headers: resp.headers,
    });
  };
}
