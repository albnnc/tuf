import mod from "./mod.json" assert { type: "json" };
import { ffinch } from "./deps.ts";

const lib = await ffinch.open(
  {
    ...mod,
    lib: new URL("./target/release/", import.meta.url).toString(),
  },
  {
    fetch: {
      parameters: ["pointer"],
      result: "pointer",
      nonblocking: true,
    },
  }
);

const libFetch = ffinch.withJsonIo(lib.symbols.fetch);

export type TuRequest = {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  timeout?: number;
  acceptInvalidCerts?: boolean;
};

export type TuResponse = {
  status: number;
  headers: Record<string, string>;
  body: Uint8Array;
};

export async function tuFetch(req: TuRequest): Promise<TuResponse> {
  const { status, body, ...rest } = await libFetch({
    url: req.url,
    method: req.method ?? "GET",
    headers: req.headers ?? undefined,
    timeout: req.timeout ? Math.floor(req.timeout) : undefined,
    accept_invalid_certs: req.acceptInvalidCerts ?? undefined,
  });
  return {
    status,
    body: Uint8Array.from(body as number[]),
    ...rest,
  } as TuResponse;
}

export interface KyReqHookOptions
  extends Pick<TuRequest, "acceptInvalidCerts"> {
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
