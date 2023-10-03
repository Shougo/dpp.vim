import { Actions, BaseExt, DppOptions, Plugin } from "../dpp/types.ts";
import { Denops, vars } from "../dpp/deps.ts";
import { isDirectory } from "../dpp/utils.ts";

type Params = Record<string, never>;

export class Ext extends BaseExt<Params> {
  override actions: Actions<Params> = {
    install: {
      description: "Install plugins",
      callback: async (args: {
        denops: Denops;
        options: DppOptions;
        actionParams: unknown;
      }) => {
        console.log(args.options);

        const plugins = await vars.g.get(
          args.denops,
          "dpp#_plugins",
        ) as Plugin[];

        const bits = await Promise.all(
          plugins.map(async (plugin) => !await isDirectory(plugin.path ?? "")),
        );
        for (const plugin of plugins.filter((_) => bits.shift())) {
          console.log(plugin);
        }
      },
    },
  };

  override params(): Params {
    return {};
  }
}
