import type { BaseParams, Plugin, ProtocolOptions } from "../types.ts";

import type { Denops } from "jsr:@denops/std@~7.5.0";

export type OnInitArguments<Params extends BaseParams> = {
  denops: Denops;
  protocolOptions: ProtocolOptions;
  protocolParams: Params;
};

type BaseProtocolArguments<Params extends BaseParams> = {
  denops: Denops;
  plugin: Plugin;
  protocolOptions: ProtocolOptions;
  protocolParams: Params;
};

export type DetectArguments<Params extends BaseParams> = BaseProtocolArguments<
  Params
>;

export type GetUrlArguments<Params extends BaseParams> = BaseProtocolArguments<
  Params
>;

export type GetSyncCommandsArguments<Params extends BaseParams> =
  BaseProtocolArguments<Params>;

export type GetLogCommandsArguments<Params extends BaseParams> =
  & BaseProtocolArguments<Params>
  & {
    newRev: string;
    oldRev: string;
  };

export type GetRevisionLockCommandsArguments<
  Params extends BaseParams,
> = BaseProtocolArguments<Params>;

export type GetRollbackCommandsArguments<Params extends BaseParams> =
  & BaseProtocolArguments<Params>
  & {
    rev: string;
  };

export type GetDiffCommandsArguments<Params extends BaseParams> =
  & BaseProtocolArguments<Params>
  & {
    newRev: string;
    oldRev: string;
  };

export type GetChangesCountArguments<Params extends BaseParams> =
  & BaseProtocolArguments<Params>
  & {
    newRev: string;
    oldRev: string;
  };

export type GetRevisionArguments<Params extends BaseParams> =
  BaseProtocolArguments<Params>;

export type Command = {
  command: string;
  args: string[];
};

export type Protocol = {
  protocol: BaseProtocol<BaseParams>;
  options: ProtocolOptions;
  params: BaseParams;
};

export abstract class BaseProtocol<Params extends BaseParams> {
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
  getChangesCountCommands(
    _args: GetChangesCountArguments<Params>,
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
