import {
  type ActionArguments,
  type ActionFlags,
  BaseSource,
  type Item,
} from "jsr:@shougo/ddu-vim@v5.0.0-pre6/types";
import { type Denops, vars } from "jsr:@shougo/ddu-vim@v5.0.0-pre6/deps";
import type { ActionData } from "https://deno.land/x/ddu_kind_file@v0.7.1/file.ts";
import type { Plugin } from "../dpp/types.ts";

type Params = {
  names: string[];
};

type Action = {
  path: string;
  __name: string;
};

export class Source extends BaseSource<Params> {
  override kind = "file";

  override gather(args: {
    denops: Denops;
    sourceParams: Params;
  }): ReadableStream<Item<ActionData>[]> {
    return new ReadableStream({
      async start(controller) {
        let plugins = Object.values(
          await vars.g.get(
            args.denops,
            "dpp#_plugins",
          ),
        ) as Plugin[];

        if (args.sourceParams.names.length > 0) {
          plugins = plugins.filter((plugin) =>
            args.sourceParams.names.indexOf(plugin.name) >= 0
          );
        }

        const items = plugins.map((plugin) => {
          return {
            word: plugin.name,
            action: {
              path: plugin.path,
              __name: plugin.name,
            } as Action,
          };
        });

        controller.enqueue(items);

        controller.close();
      },
    });
  }

  override actions: Record<
    string,
    (args: ActionArguments<Params>) => Promise<ActionFlags>
  > = {};

  override params(): Params {
    return {
      names: [],
    };
  }
}
