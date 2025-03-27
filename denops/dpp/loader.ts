import type { BaseParams, DppExtType, ExtName, ProtocolName } from "./types.ts";
import type { BaseExt } from "./base/ext.ts";
import type { BaseProtocol } from "./base/protocol.ts";
import { isDenoCacheIssueError } from "./utils.ts";

import type { Denops } from "jsr:@denops/std@~7.5.0";
import * as op from "jsr:@denops/std@~7.5.0/option";
import * as fn from "jsr:@denops/std@~7.5.0/function";

import { basename } from "jsr:@std/path@~1.0.2/basename";
import { parse } from "jsr:@std/path@~1.0.2/parse";
import { toFileUrl } from "jsr:@std/path@~1.0.2/to-file-url";
import { Lock } from "jsr:@core/asyncutil@~1.2.0/lock";

type Ext = {
  ext: Record<string, BaseExt<BaseParams>>;
  protocol: Record<string, BaseProtocol<BaseParams>>;
};

export class Loader {
  #exts: Ext = {
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
  ): Promise<boolean> {
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
      return this.#prevRuntimepath === "";
    }

    await this.registerPath(type, this.#cachedPaths[key]);

    // NOTE: this.#prevRuntimepath may be true if initialized.
    // NOTE: If not found, it returns false, .
    return this.#prevRuntimepath === "" || this.#cachedPaths[key] !== undefined;
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
    const mod = await import(toFileUrl(path).href);

    const typeExt = this.#exts[type];
    let add;
    switch (type) {
      case "ext":
        add = (name: string) => {
          const ext = new mod.Ext();
          ext.name = name;
          ext.path = path;
          typeExt[name] = ext;
        };
        break;
      case "protocol":
        add = (name: string) => {
          const ext = new mod.Protocol();
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
