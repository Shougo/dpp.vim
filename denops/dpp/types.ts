import type { Denops } from "jsr:@denops/std@~7.6.0";

export type DppExtType = "ext" | "protocol";

export type ExtName = string;
export type ProtocolName = string;
export type ActionName = string;

export type Context = {
  // TODO: remove placeholder
  placeholder?: unknown;
};

export interface ContextBuilder {
  get(denops: Denops): Promise<[Context, DppOptions]>;
  getGlobal(): Partial<DppOptions>;
  setGlobal(options: Partial<DppOptions>): void;
  patchGlobal(options: Partial<DppOptions>): void;
}

export type DppOptions = {
  extOptions: Record<ExtName, Partial<ExtOptions>>;
  extParams: Record<ExtName, Partial<BaseParams>>;
  hooksFileMarker: string;
  inlineVimrcs: string[];
  protocolOptions: Record<ProtocolName, Partial<ExtOptions>>;
  protocolParams: Record<ProtocolName, Partial<BaseParams>>;
  protocols: ProtocolName[];
  skipMergeFilenamePattern: string;
};

export type BaseParams = Record<string, unknown>;

export type UserOptions = Record<string, unknown>;

export type ExtOptions = {
  // TODO: remove placeholder
  placeholder?: unknown;
};

export type ProtocolOptions = {
  // TODO: remove placeholder
  placeholder?: unknown;
};

export type Plugin = {
  augroup?: string;
  depends?: string | string[];
  description?: string;
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
  group?: string | string[];
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
