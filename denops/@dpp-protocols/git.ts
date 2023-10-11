import { Denops, vars } from "../dpp/deps.ts";
import {
  BaseProtocol,
  Command,
  Plugin,
  ProtocolOptions,
} from "../dpp/types.ts";
import { isDirectory } from "../dpp/utils.ts";

type Params = {
  cloneDepth: number;
  commandPath: string;
  defaultHubSite: string;
  defaultProtocol: string;
  partialClone: boolean;
  pullArgs: string[];
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

    if (
      args.plugin.repo.match(
        /\/\/(raw|gist)\.githubusercontent\.com\/|\/archive\/[^\/]+.zip$/,
      )
    ) {
      // Raw repository
      return;
    }

    if (await isDirectory(args.plugin.repo)) {
      // Local repository
      return {
        local: true,
        path: args.plugin.repo,
      };
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
    if (!args.plugin.repo || !args.plugin.repo.match(/\//)) {
      return "";
    }

    if (await isDirectory(args.plugin.repo)) {
      // Local repository
      return args.plugin.repo;
    }

    let protocol = args.protocolParams.defaultProtocol;
    let host = args.protocolParams.defaultHubSite;
    let name = args.plugin.repo;

    const sshMatch = args.plugin.repo.match(/^git@(?<host>[^:]+):(?<name>.+)/);
    const protocolMatch = args.plugin.repo.match(
      /^(?<protocol>[^:]+):(?<host>[^\/]+)\/(?<name>.+)/,
    );
    if (sshMatch && sshMatch.groups) {
      // Parse "git@host:name" pattern
      protocol = "ssh";
      host = sshMatch.groups.host;
      name = sshMatch.groups.name;
    } else if (protocolMatch && protocolMatch.groups) {
      // Parse "protocol://host/name" pattern
      protocol = protocolMatch.groups.protocol;
      host = protocolMatch.groups.host;
      name = protocolMatch.groups.name;
    }

    if (protocol !== "https" && protocol !== "ssh") {
      await args.denops.call(
        "dpp#util#_error",
        `Invalid git protocol: "${protocol}"`,
      );

      return "";
    }

    const url = (protocol === "ssh")
      ? `git@${host}:${name}`
      : `${protocol}://${host}/${name}`;

    return url;
  }

  override async getSyncCommands(args: {
    denops: Denops;
    plugin: Plugin;
    protocolOptions: ProtocolOptions;
    protocolParams: Params;
  }): Promise<Command[]> {
    if (!args.plugin.repo || !args.plugin.path) {
      return [];
    }

    if (await isDirectory(args.plugin.path)) {
      const fetchArgs = [
        "-c",
        "credential.helper=",
        "fetch",
      ];

      const remoteArgs = [
        "remote",
        "set-head",
        "origin",
        "-a",
      ];

      const submoduleArgs = [
        "submodule",
        "update",
        "--init",
        "--recursive",
      ];

      // TODO: depth support

      return [
        {
          command: args.protocolParams.commandPath,
          args: fetchArgs,
        },
        {
          command: args.protocolParams.commandPath,
          args: remoteArgs,
        },
        {
          command: args.protocolParams.commandPath,
          args: args.protocolParams.pullArgs,
        },
        {
          command: args.protocolParams.commandPath,
          args: submoduleArgs,
        },
      ];
    } else {
      const commandArgs = [
        "-c",
        "credential.helper=",
        "clone",
        "--recursive",
      ];

      if (args.protocolParams.partialClone) {
        commandArgs.push("--filter=blob:none");
      }

      // TODO: depth support

      commandArgs.push(await this.getUrl(args));
      commandArgs.push(args.plugin.path);

      return [{
        command: args.protocolParams.commandPath,
        args: commandArgs,
      }];
    }
  }

  override params(): Params {
    return {
      cloneDepth: 0,
      commandPath: "git",
      defaultHubSite: "github.com",
      defaultProtocol: "https",
      partialClone: false,
      pullArgs: ["pull", "--ff", "--ff-only"],
    };
  }
}
