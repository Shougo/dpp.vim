import type { ContextBuilder } from "../types.ts";
import type { Plugin } from "../types.ts";
import type { Dpp } from "./dpp.ts";

import type { Denops } from "jsr:@denops/std@~7.3.0";

export type ConfigArguments = {
  contextBuilder: ContextBuilder;
  denops: Denops;
  dpp: Dpp;
  basePath: string;
  name: string;
};

export type MultipleHook = {
  hook_add?: string;
  hook_post_source?: string;
  hook_source?: string;
  plugins: string[];
};

export type ConfigReturn = {
  checkFiles?: string[];
  ftplugins?: Record<string, string>;
  hooksFiles?: string[];
  multipleHooks?: MultipleHook[];
  plugins: Plugin[];
  stateLines?: string[];
};

export abstract class BaseConfig {
  apiVersion = 2;

  abstract config(_args: ConfigArguments): ConfigReturn | Promise<ConfigReturn>;
}
