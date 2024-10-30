import type {
  ActionName,
  BaseParams,
  Context,
  DppOptions,
  ExtOptions,
  ProtocolName,
} from "../types.ts";
import type { Protocol } from "./protocol.ts";

import type { Denops } from "jsr:@denops/std@~7.3.0";

export type OnInitArguments<Params extends BaseParams> = {
  denops: Denops;
  extOptions: ExtOptions;
  extParams: Params;
};

export type ActionArguments<Params extends BaseParams> = {
  denops: Denops;
  context: Context;
  protocols: Record<ProtocolName, Protocol>;
  options: DppOptions;
  extOptions: ExtOptions;
  extParams: Params;
  actionParams: BaseParams;
};

export type ActionCallback<Params extends BaseParams, ReturnType = unknown> = (
  args: ActionArguments<Params>,
) => Promise<ReturnType> | ReturnType;

export type Action<Params extends BaseParams, ReturnType = unknown> = {
  description: string;
  callback: ActionCallback<Params, ReturnType>;
};

export type Actions<Params extends BaseParams> = {
  [K in ActionName]: Action<Params, unknown>;
};

export abstract class BaseExt<Params extends BaseParams> {
  apiVersion = 1;

  name = "";
  path = "";
  isInitialized = false;

  onInit(_args: OnInitArguments<Params>): void | Promise<void> {}

  abstract params(): Params;

  abstract actions: Actions<Params>;
}

export function defaultExtOptions(): ExtOptions {
  return {};
}
