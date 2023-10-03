import { Actions, BaseExt, Plugin } from "../dpp/types.ts";
import { Denops, fn } from "../dpp/deps.ts";
import { isDirectory } from "../dpp/utils.ts";
import { basename } from "https://deno.land/std@0.202.0/path/mod.ts";

type Params = Record<string, never>;

type LocalArgs = {
  directory: string;
  options?: Partial<Plugin>;
  includes?: string[];
};

export class Ext extends BaseExt<Params> {
  override actions: Actions<Params> = {
    local: {
      description: "Load local plugins",
      callback: async (args: {
        denops: Denops;
        actionParams: unknown;
      }) => {
        const params = args.actionParams as LocalArgs;
        const base = await args.denops.call(
          "dpp#util#_expand",
          params.directory,
        );

        const defaultOptions = params.options ?? {};

        let plugins: Plugin[] = [];
        for (const include of params.includes ?? ["*"]) {
          const files = await fn.glob(
            args.denops,
            base + "/" + include,
            1,
            1,
          ) as string[];

          const bits = await Promise.all(
            files.map(async (file) => await isDirectory(file)),
          );
          const dirs = files.filter((_) => bits.shift());

          plugins = plugins.concat(
            dirs.map((dir) => {
              return {
                ...defaultOptions,
                repo: dir,
                local: true,
                path: dir,
                name: basename(dir),
              };
            }),
          );
        }

        return plugins;
      },
    },
  };

  override params(): Params {
    return {};
  }
}
