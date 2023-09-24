import { Actions, BaseExt, Plugin } from "../dpp/types.ts";
import { Denops } from "../dpp/deps.ts";
import { parse } from "https://deno.land/std@0.118.0/encoding/toml.ts";
import { basename } from "https://deno.land/std@0.201.0/path/mod.ts";

type Params = Record<string, never>;

type LoadArgs = {
  path: string;
  options?: Partial<Plugin>;
};

type Toml = {
  hooks_file?: string;
  plugins: Plugin[];
};

export class Ext extends BaseExt<Params> {
  override actions: Actions<Params> = {
    load: {
      description: "Load toml config",
      callback: async (args: {
        denops: Denops;
        actionParams: unknown;
      }) => {
        const params = args.actionParams as LoadArgs;
        const path = await args.denops.call(
          "dpp#util#_expand",
          params.path,
        ) as string;

        const defaultOptions = params.options ?? {};

        const toml = parse(await Deno.readTextFile(path)) as Toml;

        const plugins = toml.plugins.map((plugin: Plugin) => {
          return {
            ...defaultOptions,
            ...plugin,
            name: plugin.name ?? basename(plugin.repo ?? ""),
          };
        });

        return plugins;
      },
    },
  };

  override params(): Params {
    return {};
  }
}
