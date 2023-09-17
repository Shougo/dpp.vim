import { BaseExtParams } from "./base/ext.ts";
import { BaseProtocolParams } from "./base/protocol.ts";
import { Denops } from "./deps.ts";

export { BaseConfig } from "./base/config.ts";
export { BaseExt } from "./base/ext.ts";
export type { BaseExtParams } from "./base/ext.ts";
export { BaseProtocol } from "./base/protocol.ts";
export type { BaseProtocolParams } from "./base/protocol.ts";

export { ContextBuilder } from "./context.ts";

export { Dpp } from "./dpp.ts";

export type DppExtType = "ext" | "protocol";

export type ExtName = string;
export type ProtocolName = string;
export type ActionName = string;

export type Context = {
  // TODO: remove placeholder
  placeholder?: unknown;
};

export type DppOptions = {
  extOptions: Record<ExtName, Partial<ExtOptions>>;
  extParams: Record<ExtName, Partial<BaseExtParams>>;
  protocolOptions: Record<ProtocolName, Partial<ExtOptions>>;
  protocolParams: Record<ProtocolName, Partial<BaseProtocolParams>>;
};

export type UserOptions = Record<string, unknown>;

export type ExtOptions = {
  // TODO: remove placeholder
  placeholder?: unknown;
};

export type ProtocolOptions = {
  // TODO: remove placeholder
  placeholder?: unknown;
};

export type BaseActionParams = Record<string, unknown>;

export type ActionArguments<Params extends BaseActionParams> = {
  denops: Denops;
  context: Context;
  options: DppOptions;
  extOptions: ExtOptions;
  extParams: Params;
  actionParams: unknown;
};

export type ActionCallback<Params extends BaseExtParams> = (
  args: ActionArguments<Params>,
) => undefined | unknown;

export type Actions<Params extends BaseActionParams> = Record<
  ActionName,
  Action<Params>
>;

export type Action<Params extends BaseActionParams> = {
  description: string;
  callback: ActionCallback<Params>;
};

export type Plugin = {
  name: string;
};
