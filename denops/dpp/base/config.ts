import { Denops } from "../deps.ts";

export type ConfigArguments = {
  denops: Denops;
  basePath: string;
};

export abstract class BaseConfig {
  apiVersion = 1;

  config(_args: ConfigArguments): void | Promise<void> {}
}
