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

export type GetUrlArguments<Params extends BaseProtocolParams> = {
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

  detect(
    _args: DetectArguments<Params>,
  ): Promise<Partial<Plugin> | undefined> | undefined {
    return;
  }

  getUrl(_args: GetUrlArguments<Params>): Promise<string> | string {
    return "";
  }
  getSyncCommand(
    _args: GetSyncCommandArguments<Params>,
  ): Promise<string> | string {
    return "";
  }
  getLogCommand(
    _args: GetLogCommandArguments<Params>,
  ): Promise<string> | string {
    return "";
  }
  getRevisionLockCommand(
    _args: GetRevisionLockCommandArguments<Params>,
  ): Promise<string> | string {
    return "";
  }
  getRollbackCommand(
    _args: GetRollbackCommandArguments<Params>,
  ): Promise<string> | string {
    return "";
  }
  getDiffCommand(
    _args: GetDiffCommandArguments<Params>,
  ): Promise<string> | string {
    return "";
  }

  getRevision(_args: GetRevisionArguments<Params>): Promise<string> | string {
    return "";
  }

  abstract params(): Params;
}

export function defaultProtocolOptions(): ProtocolOptions {
  return {};
}
