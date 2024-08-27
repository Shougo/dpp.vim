import type { Plugin, ProtocolOptions } from "../types.ts";

import type { Denops } from "jsr:@denops/std@~7.1.0";

export type BaseProtocolParams = Record<string, unknown>;

export type OnInitArguments<Params extends BaseProtocolParams> = {
  denops: Denops;
  protocolOptions: ProtocolOptions;
  protocolParams: Params;
};

export type DetectArguments<Params extends BaseProtocolParams> = {
  denops: Denops;
  plugin: Plugin;
  protocolOptions: ProtocolOptions;
  protocolParams: Params;
};

export type GetUrlArguments<Params extends BaseProtocolParams> = {
  denops: Denops;
  plugin: Plugin;
  protocolOptions: ProtocolOptions;
  protocolParams: Params;
};

export type GetSyncCommandsArguments<Params extends BaseProtocolParams> = {
  denops: Denops;
  plugin: Plugin;
  protocolOptions: ProtocolOptions;
  protocolParams: Params;
};

export type GetLogCommandsArguments<Params extends BaseProtocolParams> = {
  denops: Denops;
  plugin: Plugin;
  protocolOptions: ProtocolOptions;
  protocolParams: Params;
  newRev: string;
  oldRev: string;
};

export type GetRevisionLockCommandsArguments<
  Params extends BaseProtocolParams,
> = {
  denops: Denops;
  plugin: Plugin;
  protocolOptions: ProtocolOptions;
  protocolParams: Params;
};

export type GetRollbackCommandsArguments<Params extends BaseProtocolParams> = {
  denops: Denops;
  plugin: Plugin;
  protocolOptions: ProtocolOptions;
  protocolParams: Params;
  rev: string;
};

export type GetDiffCommandsArguments<Params extends BaseProtocolParams> = {
  denops: Denops;
  plugin: Plugin;
  protocolOptions: ProtocolOptions;
  protocolParams: Params;
  newRev: string;
  oldRev: string;
};

export type GetRevisionArguments<Params extends BaseProtocolParams> = {
  denops: Denops;
  plugin: Plugin;
  protocolOptions: ProtocolOptions;
  protocolParams: Params;
};

export type Command = {
  command: string;
  args: string[];
};

export abstract class BaseProtocol<Params extends BaseProtocolParams> {
  apiVersion = 1;

  name = "";
  path = "";
  isInitialized = false;

  onInit(_args: OnInitArguments<Params>): void | Promise<void> {}

  detect(
    _args: DetectArguments<Params>,
  ): Promise<Partial<Plugin> | undefined> | undefined {
    return;
  }

  getUrl(_args: GetUrlArguments<Params>): Promise<string> | string {
    return "";
  }

  getSyncCommands(
    _args: GetSyncCommandsArguments<Params>,
  ): Promise<Command[]> | Command[] {
    return [];
  }
  getLogCommands(
    _args: GetLogCommandsArguments<Params>,
  ): Promise<Command[]> | Command[] {
    return [];
  }
  getRevisionLockCommands(
    _args: GetRevisionLockCommandsArguments<Params>,
  ): Promise<Command[]> | Command[] {
    return [];
  }
  getRollbackCommands(
    _args: GetRollbackCommandsArguments<Params>,
  ): Promise<Command[]> | Command[] {
    return [];
  }
  getDiffCommands(
    _args: GetDiffCommandsArguments<Params>,
  ): Promise<Command[]> | Command[] {
    return [];
  }

  getRevision(_args: GetRevisionArguments<Params>): Promise<string> | string {
    return "";
  }

  abstract params(): Params;
}

export function defaultProtocolOptions(): ProtocolOptions {
  return {};
}
