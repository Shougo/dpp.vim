import { ContextBuilder } from "../context.ts";
import { Denops } from "../deps.ts";
import { Dpp, Plugin } from "../types.ts";

export type ConfigArguments = {
  denops: Denops;
  basePath: string;
  contextBuilder: ContextBuilder;
  dpp: Dpp;
};

export type ConfigReturn = {
  plugins: Plugin[];
  stateLines: string[];
};

export abstract class BaseConfig {
  apiVersion = 1;

  abstract config(_args: ConfigArguments): ConfigReturn | Promise<ConfigReturn>;
}
