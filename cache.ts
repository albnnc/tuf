import { ffinch } from "./deps.ts";
import mod from "./mod.json" assert { type: "json" };

await ffinch.cacheLib({
  ...mod,
  cargoRepo: `https://github.com/albnnc/tuf.git#${mod.version}`,
  reload: true,
});
