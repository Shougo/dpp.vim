import type { Actions, BaseParams, ExtOptions } from "../types.ts";

import type { Denops } from "jsr:@denops/std@~7.1.0";

export type OnInitArguments<Params extends BaseParams> = {
  denops: Denops;
  extOptions: ExtOptions;
  extParams: Params;
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
