import {
  Actions,
  BaseExt,
  DppOptions,
  Plugin,
  Protocol,
  ProtocolName,
} from "../dpp/types.ts";
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
        protocols: Record<ProtocolName, Protocol>;
        actionParams: unknown;
      }) => {
        const plugins = Object.values(
          await vars.g.get(
            args.denops,
            "dpp#_plugins",
          ),
        ) as Plugin[];

        const bits = await Promise.all(
          plugins.map(async (plugin) => !await isDirectory(plugin.path ?? "")),
        );

        // Detect protocol
        for (const plugin of plugins.filter((_) => bits.shift())) {
          if ("protocol" in plugin) {
            continue;
          }

          for (
            const protocol of args.options.protocols.filter((protocolName) =>
              args.protocols[protocolName]
            ).map((protocolName) => args.protocols[protocolName])
          ) {
            const detect = await protocol.protocol.detect({
              denops: args.denops,
              plugin,
              protocolOptions: protocol.options,
              protocolParams: protocol.params,
            });

            if (detect) {
              // Overwrite by detect()
              Object.assign(plugin, {
                ...detect,
                protocol: protocol.protocol.name,
              });
            }
          }
        }

        //console.log(plugins);
      },
    },
  };

  override params(): Params {
    return {};
  }
}
