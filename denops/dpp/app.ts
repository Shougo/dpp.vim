import { ContextBuilderImpl } from "./context.ts";
import { DppImpl } from "./dpp.ts";
import type {
  BaseParams,
  DppExtType,
  DppOptions,
  ExtOptions,
  ProtocolName,
} from "./types.ts";
import type { BaseExt } from "./base/ext.ts";
import type { BaseProtocol, Protocol } from "./base/protocol.ts";
import { Loader } from "./loader.ts";
import { extAction } from "./ext.ts";
import { isDenoCacheIssueError } from "./utils.ts";

import type { Denops, Entrypoint } from "jsr:@denops/std@~7.5.0";
import * as vars from "jsr:@denops/std@~7.5.0/variable";

import { Lock } from "jsr:@core/asyncutil@~1.2.0/lock";
import { ensure } from "jsr:@core/unknownutil@~4.3.0/ensure";
import { is } from "jsr:@core/unknownutil@~4.3.0/is";
import { toFileUrl } from "jsr:@std/path@~1.1.0/to-file-url";

export const main: Entrypoint = (denops: Denops) => {
  const loader = new Loader();
  const dpp = new DppImpl(loader);
  const contextBuilder = new ContextBuilderImpl();
  const lock = new Lock(0);

  denops.dispatcher = {
    async registerPath(arg1: unknown, arg2: unknown): Promise<void> {
      await loader.registerPath(
        ensure(arg1, is.String) as DppExtType,
        ensure(arg2, is.String),
      );
      return Promise.resolve();
    },
    registerExtension(
      arg1: unknown,
      arg2: unknown,
      arg3: unknown,
    ): Promise<void> {
      const type = ensure(arg1, is.String) as string;
      const extName = ensure(arg2, is.String) as string;

      switch (type) {
        case "ext":
          loader.registerExtension(type, extName, arg3 as BaseExt<BaseParams>);
          break;
        case "protocol":
          loader.registerExtension(
            type,
            extName,
            arg3 as BaseProtocol<BaseParams>,
          );
          break;
      }

      return Promise.resolve();
    },
    async extAction(
      arg1: unknown,
      arg2: unknown,
      arg3: unknown,
    ): Promise<unknown | undefined> {
      const extName = ensure(arg1, is.String) as string;
      const actionName = ensure(arg2, is.String) as string;
      const actionParams = ensure(arg3, is.Record) as Record<string, unknown>;

      // Set current options from dpp#_options
      const currentOptions = await vars.g.get(
        denops,
        "dpp#_options",
      ) as DppOptions;
      contextBuilder.setGlobal(currentOptions);

      const [context, options] = await contextBuilder.get(denops);

      return await extAction(
        denops,
        loader,
        context,
        options,
        extName,
        actionName,
        actionParams,
      );
    },
    async makeState(
      arg1: unknown,
      arg2: unknown,
      arg3: unknown,
      arg4: unknown,
    ): Promise<void> {
      //const startTime = Date.now();
      const basePath = ensure(arg1, is.String) as string;
      const configPath = ensure(arg2, is.String) as string;
      const name = ensure(arg3, is.String) as string;
      const extraArgs = ensure(arg4, is.Record) as Record<string, unknown>;

      await lock.lock(async () => {
        try {
          // NOTE: Import module with fragment so that reload works properly.
          // https://github.com/vim-denops/denops.vim/issues/227
          const mod = await import(
            `${toFileUrl(configPath).href}#${performance.now()}`
          );

          const obj = new mod.Config();

          //console.log(`${Date.now() - startTime} ms`);
          const configReturn = await obj.config({
            contextBuilder,
            denops,
            dpp,
            basePath,
            name,
            extraArgs,
          });
          //console.log(`${Date.now() - startTime} ms`);

          const [_, options] = await contextBuilder.get(denops);

          await dpp.makeState(
            denops,
            options,
            basePath,
            configPath,
            name,
            configReturn,
          );

          //console.log(`${Date.now() - startTime} ms`);
        } catch (e) {
          if (isDenoCacheIssueError(e)) {
            console.warn("*".repeat(80));
            console.warn(`Deno module cache issue is detected.`);
            console.warn(
              `Execute '!deno cache --reload "${configPath}"' and restart Vim/Neovim.`,
            );
            console.warn("*".repeat(80));
          }

          console.error(`Failed to load file '${configPath}': ${e}`);
          throw e;
        }
      });
    },
    async getExt(
      arg1: unknown,
    ): Promise<
      [
        BaseExt<BaseParams> | undefined,
        ExtOptions,
        BaseParams,
      ]
    > {
      const extName = ensure(arg1, is.String) as string;
      const [_, options] = await contextBuilder.get(denops);

      return await dpp.getExt(
        denops,
        options,
        extName,
      );
    },
    async getProtocols(): Promise<Record<ProtocolName, Protocol>> {
      const [_, options] = await contextBuilder.get(denops);

      return await dpp.getProtocols(
        denops,
        options,
      );
    },
  };
};
