import { Denops, ensure, is, toFileUrl } from "./deps.ts";
import { Dpp } from "./dpp.ts";
import { Loader } from "./loader.ts";

export function main(denops: Denops) {
  const loader = new Loader();
  const dpp = new Dpp(loader);

  denops.dispatcher = {
    async makeState(arg1: unknown, arg2: unknown): Promise<void> {
      const basePath = ensure(arg1, is.String);
      const scriptPath = ensure(arg2, is.String);

      // NOTE: Import module with fragment so that reload works properly.
      // https://github.com/vim-denops/denops.vim/issues/227
      const mod = await import(
        `${toFileUrl(scriptPath).href}#${performance.now()}`
      );
      const obj = new mod.Config();
      await obj.config({ denops, basePath });

      return Promise.resolve();
    },
  };
}
