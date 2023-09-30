import { Denops } from "../deps.ts";
import { Plugin, ProtocolOptions } from "../types.ts";

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

export type GetSyncCommandArguments<Params extends BaseProtocolParams> = {
  denops: Denops;
  plugin: Plugin;
  protocolOptions: ProtocolOptions;
  protocolParams: Params;
};

export type GetLogCommandArguments<Params extends BaseProtocolParams> = {
  denops: Denops;
  plugin: Plugin;
  protocolOptions: ProtocolOptions;
  protocolParams: Params;
};

export type GetRevisionLockCommandArguments<Params extends BaseProtocolParams> =
  {
    denops: Denops;
    plugin: Plugin;
    protocolOptions: ProtocolOptions;
    protocolParams: Params;
  };

export type GetRollbackCommandArguments<Params extends BaseProtocolParams> = {
  denops: Denops;
  plugin: Plugin;
  protocolOptions: ProtocolOptions;
  protocolParams: Params;
};

export type GetDiffCommandArguments<Params extends BaseProtocolParams> = {
  denops: Denops;
  plugin: Plugin;
  protocolOptions: ProtocolOptions;
  protocolParams: Params;
};

export type GetRevisionArguments<Params extends BaseProtocolParams> = {
  denops: Denops;
  plugin: Plugin;
  protocolOptions: ProtocolOptions;
  protocolParams: Params;
};

export abstract class BaseProtocol<Params extends BaseProtocolParams> {
  apiVersion = 1;

  name = "";
  path = "";
  isInitialized = false;

  onInit(_args: OnInitArguments<Params>): void | Promise<void> {}

  detect(_args: DetectArguments<Params>): Plugin | Promise<Plugin> | undefined {
    return;
  }

  getSyncCommand(_args: GetSyncCommandArguments<Params>): string {
    return "";
  }
  getLogCommand(_args: GetLogCommandArguments<Params>): string {
    return "";
  }
  getRevisionLockCommand(
    _args: GetRevisionLockCommandArguments<Params>,
  ): string {
    return "";
  }
  getRollbackCommand(_args: GetRollbackCommandArguments<Params>): string {
    return "";
  }
  getDiffCommand(_args: GetDiffCommandArguments<Params>): string {
    return "";
  }

  getRevision(_args: GetRevisionArguments<Params>): string {
    return "";
  }

  abstract params(): Params;
}

export function defaultProtocolOptions(): ProtocolOptions {
  return {};
}
