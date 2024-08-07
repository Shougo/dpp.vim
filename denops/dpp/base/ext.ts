import type { Denops } from "../deps.ts";
import type { Actions, ExtOptions } from "../types.ts";

export type BaseExtParams = Record<string, unknown>;

export type OnInitArguments<Params extends BaseExtParams> = {
  denops: Denops;
  extOptions: ExtOptions;
  extParams: Params;
};

export abstract class BaseExt<Params extends BaseExtParams> {
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
