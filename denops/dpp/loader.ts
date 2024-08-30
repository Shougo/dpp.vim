import type {
  BaseExt,
  BaseParams,
  BaseProtocol,
  DppExtType,
  ExtName,
  ProtocolName,
} from "./types.ts";
import { isDenoCacheIssueError } from "./utils.ts";

import type { Denops } from "jsr:@denops/std@~7.1.0";
import * as op from "jsr:@denops/std@~7.1.0/option";
import * as fn from "jsr:@denops/std@~7.1.0/function";

import { basename } from "jsr:@std/path@~1.0.2/basename";
import { parse } from "jsr:@std/path@~1.0.2/parse";
import { toFileUrl } from "jsr:@std/path@~1.0.2/to-file-url";
import { Lock } from "jsr:@core/asyncutil@~1.1.1/lock";

type Mod = {
  // deno-lint-ignore no-explicit-any
  mod: any;
  path: string;
};

export class Loader {
  #extension: Extension = new Extension();
  #mods: Record<DppExtType, Record<string, Mod>> = {
    ext: {},
    protocol: {},
  };
  #checkPaths: Record<string, boolean> = {};
  #registerLock = new Lock(0);
  #cachedPaths: Record<string, string> = {};
  #prevRuntimepath = "";

  async autoload(
    denops: Denops,
    type: DppExtType,
    name: string,
  ) {
    const runtimepath = await op.runtimepath.getGlobal(denops);
    if (runtimepath !== this.#prevRuntimepath) {
      this.#cachedPaths = await globpath(
        denops,
        "denops/@dpp-*s",
      );
      this.#prevRuntimepath = runtimepath;
    }

    const key = `@dpp-${type}s/${name}`;

    if (!this.#cachedPaths[key]) {
      return;
    }

    await this.registerPath(type, this.#cachedPaths[key]);
  }

  async registerPath(type: DppExtType, path: string) {
    await this.#registerLock.lock(async () => {
      try {
        await this.#register(type, path);
      } catch (e) {
        if (isDenoCacheIssueError(e)) {
          console.warn("*".repeat(80));
          console.warn(`Deno module cache issue is detected.`);
          console.warn(
            `Execute '!deno cache --reload "${path}"' and restart Vim/Neovim.`,
          );
          console.warn("*".repeat(80));
        }

        console.error(`Failed to load file '${path}': ${e}`);
        throw e;
      }
    });
  }

  getExt(name: ExtName): BaseExt<BaseParams> | null {
    const mod = this.#mods.ext[name];
    if (!mod) {
      return null;
    }

    return this.#extension.getExt(mod, name);
  }
  getProtocol(name: ProtocolName): BaseProtocol<BaseParams> | null {
    const mod = this.#mods.protocol[name];
    if (!mod) {
      return null;
    }

    return this.#extension.getProtocol(mod, name);
  }

  async #register(type: DppExtType, path: string) {
    if (path in this.#checkPaths) {
      return;
    }

    const mods = this.#mods[type];

    const name = parse(path).name;

    const mod: Mod = {
      mod: await import(toFileUrl(path).href),
      path,
    };

    mods[name] = mod;

    this.#checkPaths[path] = true;
  }
}

class Extension {
  #exts: Record<ExtName, BaseExt<BaseParams>> = {};
  #protocols: Record<ProtocolName, BaseProtocol<BaseParams>> = {};

  getExt(mod: Mod, name: string): BaseExt<BaseParams> {
    if (!this.#exts[name]) {
      const obj = new mod.mod.Ext();
      obj.name = name;
      obj.path = mod.path;
      this.#exts[obj.name] = obj;
    }
    return this.#exts[name];
  }

  getProtocol(mod: Mod, name: string): BaseProtocol<BaseParams> {
    if (!this.#protocols[name]) {
      const obj = new mod.mod.Protocol();
      obj.name = name;
      obj.path = mod.path;
      this.#protocols[obj.name] = obj;
    }
    return this.#protocols[name];
  }
}

async function globpath(
  denops: Denops,
  search: string,
): Promise<Record<string, string>> {
  const runtimepath = await op.runtimepath.getGlobal(denops);

  const paths: Record<string, string> = {};
  const glob = await fn.globpath(
    denops,
    runtimepath,
    search + "/*.ts",
    1,
    1,
  );

  for (const path of glob) {
    // Skip already added name.
    const parsed = parse(path);
    const key = `${basename(parsed.dir)}/${parsed.name}`;
    if (key in paths) {
      continue;
    }

    paths[key] = path;
  }

  return paths;
}
