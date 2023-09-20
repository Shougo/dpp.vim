import { Denops, ensure, is, toFileUrl } from "./deps.ts";
import { ContextBuilder } from "./context.ts";
import { Dpp } from "./dpp.ts";
import { Loader } from "./loader.ts";

export function main(denops: Denops) {
  const loader = new Loader();
  const dpp = new Dpp(loader);
  const contextBuilder = new ContextBuilder();

  denops.dispatcher = {
    async makeState(arg1: unknown, arg2: unknown): Promise<void> {
      const basePath = ensure(arg1, is.String);
      const configPath = ensure(arg2, is.String);

      // NOTE: Import module with fragment so that reload works properly.
      // https://github.com/vim-denops/denops.vim/issues/227
      const mod = await import(
        `${toFileUrl(configPath).href}#${performance.now()}`
      );
      const obj = new mod.Config();
      const plugins = await obj.config({
        denops,
        basePath,
        contextBuilder,
        dpp,
      });

      await dpp.makeState(basePath, plugins);

      return Promise.resolve();
    },
  };
}
