import { BaseExtParams } from "./base/ext.ts";
import { BaseProtocol, BaseProtocolParams } from "./base/protocol.ts";
import { Denops } from "./deps.ts";

export { BaseConfig } from "./base/config.ts";
export { BaseExt } from "./base/ext.ts";
export type { BaseExtParams } from "./base/ext.ts";
export { BaseProtocol } from "./base/protocol.ts";
export type { BaseProtocolParams, Command } from "./base/protocol.ts";

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
  hooksFileMarker: string;
  inlineVimrcs: string[];
  protocolOptions: Record<ProtocolName, Partial<ExtOptions>>;
  protocolParams: Record<ProtocolName, Partial<BaseProtocolParams>>;
  protocols: ProtocolName[];
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

export type Protocol = {
  protocol: BaseProtocol<BaseProtocolParams>;
  options: ProtocolOptions;
  params: BaseProtocolParams;
};

export type BaseActionParams = Record<string, unknown>;

export type ActionArguments<Params extends BaseActionParams> = {
  denops: Denops;
  context: Context;
  protocols: Record<ProtocolName, Protocol>;
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
  augroup?: string;
  build?: string;
  depends?: string | string[];
  frozen?: boolean;
  ftplugin?: Record<string, string>;
  if?: boolean | string;
  hook_add?: string;
  hook_depends_update?: string;
  hook_done_update?: string;
  hook_post_source?: string;
  hook_post_update?: string;
  hook_source?: string;
  lazy?: boolean;
  local?: boolean;
  lua_add?: string;
  lua_depends_update?: string;
  lua_done_update?: string;
  lua_post_source?: string;
  lua_post_update?: string;
  lua_source?: string;
  merge_ftdetect?: string;
  merged?: boolean;
  name: string;
  normalized_name?: string;
  on_cmd?: string | string[];
  on_event?: string | string[];
  on_ft?: string | string[];
  on_func?: string | string[];
  on_if?: string | string[];
  on_lua?: string | string[];
  on_map?: string | string[];
  on_path?: string | string[];
  on_source?: string | string[];
  path?: string;
  protocol?: string;
  repo?: string;
  rev?: string;
  rtp?: string;
  script_type?: string;
  sourced?: boolean;
  timeout?: number;
  url?: string;
};
