import { ContextBuilder } from "../context.ts";
import { Denops } from "../deps.ts";
import { Dpp, Plugin } from "../types.ts";

export type ConfigArguments = {
  basePath: string;
  contextBuilder: ContextBuilder;
  denops: Denops;
  dpp: Dpp;
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
  apiVersion = 1;

  abstract config(_args: ConfigArguments): ConfigReturn | Promise<ConfigReturn>;
}
