import type {
  ActionName,
  BaseParams,
  Context,
  DppOptions,
  ExtName,
  ExtOptions,
  ProtocolName,
} from "../types.ts";
import type { BaseExt } from "./ext.ts";
import type { Protocol } from "./protocol.ts";

import type { Denops } from "jsr:@denops/std@~7.3.0";

export interface Dpp {
  extAction(
    denops: Denops,
    context: Context,
    options: DppOptions,
    extName: ExtName,
    actionName: ActionName,
    actionParams: BaseParams,
  ): Promise<unknown | undefined>;

  getExt(
    denops: Denops,
    options: DppOptions,
    extName: ExtName,
  ): Promise<
    [
      BaseExt<BaseParams> | undefined,
      ExtOptions,
      BaseParams,
    ]
  >;

  getProtocols(
    denops: Denops,
    options: DppOptions,
  ): Promise<Record<ProtocolName, Protocol>>;
}
