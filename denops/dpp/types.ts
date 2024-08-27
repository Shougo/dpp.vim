import type { BaseExtParams } from "./base/ext.ts";
import type { BaseProtocol, BaseProtocolParams } from "./base/protocol.ts";
import type { Denops } from "jsr:@denops/std@~7.1.0";

export { BaseConfig } from "./base/config.ts";
export type {
  ConfigArguments,
  ConfigReturn,
  MultipleHook,
} from "./base/config.ts";
export { BaseExt } from "./base/ext.ts";
export type { BaseExtParams } from "./base/ext.ts";
export { BaseProtocol } from "./base/protocol.ts";
export type { BaseProtocolParams, Command } from "./base/protocol.ts";

export { ContextBuilder } from "./context.ts";

export { Dpp } from "./dpp.ts";
export type { Denops } from "jsr:@denops/std@~7.1.0";

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
  skipMergeFilenamePattern: string;
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

export type ActionCallback<Params extends BaseExtParams, ReturnType = unknown> =
  (
    args: ActionArguments<Params>,
  ) => Promise<ReturnType> | ReturnType;

export type Action<Params extends BaseActionParams, ReturnType = unknown> = {
  description: string;
  callback: ActionCallback<Params, ReturnType>;
};

export type Actions<Params extends BaseActionParams> = {
  [K in ActionName]: Action<Params, unknown>;
};

export type Plugin = {
  augroup?: string;
  depends?: string | string[];
  dummy_commands?: string[];
  dummy_mappings?: [string, string][];
  extAttrs?: unknown;
  ftplugin?: Record<string, string>;
  hook_add?: string;
  hook_depends_update?: string;
  hook_done_update?: string;
  hook_post_source?: string;
  hook_post_update?: string;
  hook_source?: string;
  hooks_file?: string | string[];
  if?: boolean | string;
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
  on_cmd?: string | string[];
  on_event?: string | string[];
  on_ft?: string | string[];
  on_func?: string | string[];
  on_if?: string | string[];
  on_lua?: string | string[];
  on_map?: string | string[] | Record<string, string | string[]>;
  on_path?: string | string[];
  on_post_source?: string | string[];
  on_source?: string | string[];
  path?: string;
  protocol?: string;
  protocolAttrs?: unknown;
  repo?: string;
  rev?: string;
  rtp?: string;
  script_type?: string;
  sourced?: boolean;
  url?: string;
};
