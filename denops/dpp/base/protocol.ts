import { Denops } from "../deps.ts";
import { ProtocolOptions } from "../types.ts";

export type BaseProtocolParams = Record<string, unknown>;

export type OnInitArguments<Params extends BaseProtocolParams> = {
  denops: Denops;
  protocolOptions: ProtocolOptions;
  protocolParams: Params;
};

export abstract class BaseProtocol<Params extends BaseProtocolParams> {
  apiVersion = 1;

  name = "";
  path = "";
  isInitialized = false;

  onInit(_args: OnInitArguments<Params>): void | Promise<void> {}

  abstract params(): Params;
}

export function defaultProtocolOptions(): ProtocolOptions {
  return {};
}
