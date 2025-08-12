import type { BaseParams, DppExtType, ExtName, ProtocolName } from "./types.ts";
import type { BaseExt } from "./base/ext.ts";
import type { BaseProtocol } from "./base/protocol.ts";
import { importPlugin, isDenoCacheIssueError } from "./utils.ts";

import type { Denops } from "@denops/std";
import * as op from "@denops/std/option";
import * as fn from "@denops/std/function";

import { basename } from "@std/path/basename";
import { dirname } from "@std/path/dirname";
import { join } from "@std/path/join";
import { parse } from "@std/path/parse";
import { Lock } from "@core/asyncutil/lock";

type Mod = {
  // deno-lint-ignore no-explicit-any
  mod: any;
  path: string;
};

type Ext = {
  ext: Record<string, BaseExt<BaseParams>>;
  protocol: Record<string, BaseProtocol<BaseParams>>;
};

const PLUGIN_PREFIX = "@dpp";

// Pattern for directories where auto-loadable extensions are placed by type
const TYPE_DIR_PATTERN = `denops/${PLUGIN_PREFIX}-*s`;

// Structured extension module entry point file.
const EXT_ENTRY_POINT_FILE = "main.ts";

export class Loader {
  #exts: Ext = {
    ext: {},
    protocol: {},
  };
  #checkPaths: Record<string, boolean> = {};
  #registerLock = new Lock(0);
  #cachedPaths = new Map<string, string>();
  #prevRuntimepath = "";

  async autoload(
    denops: Denops,
    type: DppExtType,
    name: string,
  ): Promise<boolean> {
    const runtimepath = await op.runtimepath.getGlobal(denops);
    if (runtimepath !== this.#prevRuntimepath) {
      const cachedPaths = await createPathCache(denops, runtimepath);

      // NOTE: glob may be invalid.
      if (cachedPaths.size > 0) {
        this.#cachedPaths = cachedPaths;
        this.#prevRuntimepath = runtimepath;
      }
    }

    const key = `${PLUGIN_PREFIX}-${type}s/${name}`;
    const path = this.#cachedPaths.get(key);

    if (!path) {
      return this.#prevRuntimepath === "";
    }

    await this.registerPath(type, path);
    return true;
  }

  async registerPath(type: DppExtType, path: string): Promise<void> {
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

  registerExtension(
    type: "ext",
    name: string,
    ext: BaseExt<BaseParams>,
  ): void;
  registerExtension(
    type: "protocol",
    name: string,
    ext: BaseProtocol<BaseParams>,
  ): void;
  registerExtension(
    type: DppExtType,
    name: string,
    ext:
      | BaseExt<BaseParams>
      | BaseProtocol<BaseParams>,
  ) {
    ext.name = name;
    this.#exts[type][name] = ext;
  }

  async getExt(
    denops: Denops,
    name: ExtName,
  ): Promise<BaseExt<BaseParams> | null> {
    if (!this.#exts.ext[name]) {
      await this.autoload(denops, "ext", name);
    }

    return this.#exts.ext[name];
  }
  async getProtocol(
    denops: Denops,
    name: ProtocolName,
  ): Promise<BaseProtocol<BaseParams> | null> {
    if (!this.#exts.protocol[name]) {
      await this.autoload(denops, "protocol", name);
    }

    return this.#exts.protocol[name];
  }

  async #register(type: DppExtType, path: string) {
    if (path in this.#checkPaths) {
      return;
    }

    const name = parse(path).name;
    const mod: Mod = {
      mod: undefined,
      path,
    };

    // NOTE: We intentionally use Deno.stat instead of safeStat here. We expect
    // errors to be thrown when paths don't exist or are inaccessible.
    const fileInfo = await Deno.stat(path);

    if (fileInfo.isDirectory) {
      // Load structured extension module
      const entryPoint = join(path, EXT_ENTRY_POINT_FILE);
      mod.mod = await importPlugin(entryPoint);
    } else {
      // Load single-file extension module
      mod.mod = await importPlugin(path);
    }

    const typeExt = this.#exts[type];
    let add;
    switch (type) {
      case "ext":
        add = (name: string) => {
          const ext = new mod.mod.Ext();
          ext.name = name;
          ext.path = path;
          typeExt[name] = ext;
        };
        break;
      case "protocol":
        add = (name: string) => {
          const ext = new mod.mod.Protocol();
          ext.name = name;
          ext.path = path;
          typeExt[name] = ext;
        };
        break;
    }

    add(name);

    this.#checkPaths[path] = true;
  }
}

async function createPathCache(
  denops: Denops,
  runtimepath: string,
): Promise<Map<string, string>> {
  const extFileGlob = await globpath(
    denops,
    runtimepath,
    `${TYPE_DIR_PATTERN}/*.ts`,
  );
  const extDirEntryPointGlob = await globpath(
    denops,
    runtimepath,
    `${TYPE_DIR_PATTERN}/*/${EXT_ENTRY_POINT_FILE}`,
  );

  // Create key paths for both single-file and directory entry points.
  // Prioritize the first occurrence key in keyPaths.
  const keyPaths: Readonly<[key: string, path: string]>[] = [
    //   1. `{name}.ts`
    ...extFileGlob.map((extFile) => {
      const { name, dir: typeDir } = parse(extFile);
      const typeDirName = basename(typeDir);
      const key = `${typeDirName}/${name}`;
      return [key, extFile] as const;
    }),
    //   2. `{name}/main.ts`
    ...extDirEntryPointGlob.map((entryPoint) => {
      const extDir = dirname(entryPoint);
      const { base: name, dir: typeDir } = parse(extDir);
      const typeDirName = basename(typeDir);
      const key = `${typeDirName}/${name}`;
      return [key, extDir] as const;
    }),
  ];

  // Remove duplicate keys.
  // Note that `Map` prioritizes the later value, so need to reversed.
  const cache = new Map(keyPaths.toReversed());

  return cache;
}

async function globpath(
  denops: Denops,
  path: string,
  pattern: string,
): Promise<string[]> {
  return await fn.globpath(denops, path, pattern, 1, 1) as unknown as string[];
}
