import { Denops, vars } from "../dpp/deps.ts";
import { BaseProtocol, Plugin, ProtocolOptions } from "../dpp/types.ts";

type Params = {
  cloneDepth: number;
  commandPath: string;
  defaultHubSite: string;
  defaultProtocol: string;
  partialClone: boolean;
  pullCommand: string;
};

export class Protocol extends BaseProtocol<Params> {
  override async detect(args: {
    denops: Denops;
    plugin: Plugin;
    protocolOptions: ProtocolOptions;
    protocolParams: Params;
  }): Promise<Partial<Plugin> | undefined> {
    if (!args.plugin.repo) {
      return;
    }

    const url = await this.getUrl(args);
    if (url.length === 0) {
      return;
    }

    const directory = url.replace(/\.git$/, "").replace(/^https:\/+|^git@/, "")
      .replace(/:/, "/");

    return {
      path: `${await vars.g.get(
        args.denops,
        "dpp#_base_path",
      )}/repos/${directory}`,
    };
  }

  override async getUrl(args: {
    denops: Denops;
    plugin: Plugin;
    protocolOptions: ProtocolOptions;
    protocolParams: Params;
  }): Promise<string> {
    if (!args.plugin.repo) {
      return "";
    }

    return args.plugin.repo;
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
