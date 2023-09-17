import { ContextBuilder } from "../context.ts";
import { Denops } from "../deps.ts";
import { Dpp, Plugin } from "../types.ts";

export type ConfigArguments = {
  denops: Denops;
  basePath: string;
  contextBuilder: ContextBuilder;
  dpp: Dpp;
};

export abstract class BaseConfig {
  apiVersion = 1;

  config(_args: ConfigArguments): Plugin[] | Promise<Plugin[]> {
    return [];
  }
}
