import { Denops } from "../dpp/deps.ts";
import { BaseProtocol, Plugin } from "../dpp/types.ts";

type Params = {
  cloneDepth: number;
  commandPath: string;
  defaultHubSite: string;
  defaultProtocol: string;
  partialClone: boolean;
  pullCommand: string;
};

export class Protocol extends BaseProtocol<Params> {
  override detect(args: {
    denops: Denops;
    plugin: Plugin;
    protocolParams: Params;
  }): Plugin | Promise<Plugin> | undefined {
    console.log(args.protocolParams);
    return;
  }

  override params(): Params {
    return {
      cloneDepth: 0,
      commandPath: "git",
      defaultHubSite: "github.com",
      defaultProtocol: "https",
      partialClone: false,
      pullCommand: "pull --ff --ff-only",
    };
  }
}
