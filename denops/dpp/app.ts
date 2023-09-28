import { Denops, ensure, is, toFileUrl } from "./deps.ts";
import { ContextBuilder } from "./context.ts";
import { Dpp } from "./dpp.ts";
import { Loader } from "./loader.ts";

export function main(denops: Denops) {
  const loader = new Loader();
  const dpp = new Dpp(loader);
  const contextBuilder = new ContextBuilder();

  denops.dispatcher = {
    async extAction(
      arg1: unknown,
      arg2: unknown,
      arg3: unknown,
    ): Promise<unknown | undefined> {
      const extName = ensure(arg1, is.String);
      const actionName = ensure(arg2, is.String);
      const actionParams = ensure(arg3, is.Record);

      return await dpp.extAction(denops, extName, actionName, actionParams);
    },
    async makeState(arg1: unknown, arg2: unknown): Promise<void> {
      const basePath = ensure(arg1, is.String);
      const configPath = ensure(arg2, is.String);

      // NOTE: Import module with fragment so that reload works properly.
      // https://github.com/vim-denops/denops.vim/issues/227
      const mod = await import(
        `${toFileUrl(configPath).href}#${performance.now()}`
      );
      const obj = new mod.Config();
      const configReturn = await obj.config({
        denops,
        basePath,
        contextBuilder,
        dpp,
      });

      const [_, options] = await contextBuilder.get(denops);

      await dpp.makeState(denops, options, basePath, configReturn);
    },
  };
}
