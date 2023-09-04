import {
  BaseExt,
  BaseExtParams,
  BaseProtocol,
  BaseProtocolParams,
  DppExtType,
  ExtName,
  ProtocolName,
} from "./types.ts";
import { Denops, fn, Lock, op, parse, toFileUrl } from "./deps.ts";

type Mod = {
  // deno-lint-ignore no-explicit-any
  mod: any;
  path: string;
};

export class Loader {
  private extensions: Record<string, Extension> = {};
  private mods: Record<DppExtType, Record<string, Mod>> = {
    ext: {},
    protocol: {},
  };
  private checkPaths: Record<string, boolean> = {};
  private registerLock = new Lock(0);

  async autoload(
    denops: Denops,
    type: DppExtType,
    name: string,
  ) {
    const paths = await globpath(
      denops,
      `denops/@dpp-${type}s/`,
      name,
    );

    if (paths.length === 0) {
      return;
    }

    await this.registerPath(type, paths[0]);
  }

  async registerPath(type: DppExtType, path: string) {
    await this.registerLock.lock(async () => {
      await this.register(type, path);
    });
  }

  getExt(index: string, name: ExtName): BaseExt<BaseExtParams> | null {
    const mod = this.mods.ext[name];
    if (!mod) {
      return null;
    }

    return this.getExtension(index).getExt(mod, name);
  }
  getProtocol(
    index: string,
    name: ProtocolName,
  ): BaseProtocol<BaseProtocolParams> | null {
    const mod = this.mods.protocol[name];
    if (!mod) {
      return null;
    }

    return this.getExtension(index).getProtocol(mod, name);
  }

  private getExtension(index: string): Extension {
    if (!this.extensions[index]) {
      this.extensions[index] = new Extension();
    }

    return this.extensions[index];
  }

  private async register(type: DppExtType, path: string) {
    if (path in this.checkPaths) {
      return;
    }

    const mods = this.mods[type];

    const name = parse(path).name;

    const mod: Mod = {
      mod: await import(toFileUrl(path).href),
      path,
    };

    mods[name] = mod;

    this.checkPaths[path] = true;
  }
}

class Extension {
  private exts: Record<ExtName, BaseExt<BaseExtParams>> = {};
  private protocols: Record<ProtocolName, BaseProtocol<BaseProtocolParams>> =
    {};

  getExt(mod: Mod, name: string): BaseExt<BaseExtParams> {
    if (!this.exts[name]) {
      const obj = new mod.mod.Ext();
      obj.name = name;
      obj.path = mod.path;
      this.exts[obj.name] = obj;
    }
    return this.exts[name];
  }

  getProtocol(mod: Mod, name: string): BaseProtocol<BaseProtocolParams> {
    if (!this.protocols[name]) {
      const obj = new mod.mod.Protocol();
      obj.name = name;
      obj.path = mod.path;
      this.protocols[obj.name] = obj;
    }
    return this.protocols[name];
  }
}

async function globpath(
  denops: Denops,
  search: string,
  file: string,
): Promise<string[]> {
  const runtimepath = await op.runtimepath.getGlobal(denops);

  const check: Record<string, boolean> = {};
  const paths: string[] = [];
  const glob = await fn.globpath(
    denops,
    runtimepath,
    search + file + ".ts",
    1,
    1,
  );

  for (const path of glob) {
    // Skip already added name.
    if (parse(path).name in check) {
      continue;
    }

    paths.push(path);
    check[parse(path).name] = true;
  }

  return paths;
}
