import {
  type Denops,
  ensure,
  type Entrypoint,
  is,
  toFileUrl,
  vars,
} from "./deps.ts";
import { ContextBuilder } from "./context.ts";
import { Dpp } from "./dpp.ts";
import type { DppOptions } from "./types.ts";
import { Loader } from "./loader.ts";
import { extAction } from "./ext.ts";
import { isDenoCacheIssueError } from "./utils.ts";

export const main: Entrypoint = (denops: Denops) => {
  const loader = new Loader();
  const dpp = new Dpp(loader);
  const contextBuilder = new ContextBuilder();

  denops.dispatcher = {
    async extAction(
      arg1: unknown,
      arg2: unknown,
      arg3: unknown,
    ): Promise<unknown | undefined> {
      const extName = ensure(arg1, is.String) as string;
      const actionName = ensure(arg2, is.String) as string;
      const actionParams = ensure(arg3, is.Record);

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
    ): Promise<void> {
      //const startTime = Date.now();
      const basePath = ensure(arg1, is.String) as string;
      const configPath = ensure(arg2, is.String) as string;
      const name = ensure(arg3, is.String) as string;

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
          basePath,
          dpp,
          name,
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
    },
  };
};
