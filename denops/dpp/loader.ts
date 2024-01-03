import {
  BaseExt,
  BaseExtParams,
  BaseProtocol,
  BaseProtocolParams,
  DppExtType,
  ExtName,
  ProtocolName,
} from "./types.ts";
import { basename, Denops, fn, Lock, op, parse, toFileUrl } from "./deps.ts";

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
      await this.#register(type, path);
    });
  }

  getExt(name: ExtName): BaseExt<BaseExtParams> | null {
    const mod = this.#mods.ext[name];
    if (!mod) {
      return null;
    }

    return this.#extension.getExt(mod, name);
  }
  getProtocol(name: ProtocolName): BaseProtocol<BaseProtocolParams> | null {
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
  #exts: Record<ExtName, BaseExt<BaseExtParams>> = {};
  #protocols: Record<ProtocolName, BaseProtocol<BaseProtocolParams>> =
    {};

  getExt(mod: Mod, name: string): BaseExt<BaseExtParams> {
    if (!this.#exts[name]) {
      const obj = new mod.mod.Ext();
      obj.name = name;
      obj.path = mod.path;
      this.#exts[obj.name] = obj;
    }
    return this.#exts[name];
  }

  getProtocol(mod: Mod, name: string): BaseProtocol<BaseProtocolParams> {
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
