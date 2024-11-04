import type { Plugin } from "../dpp/types.ts";

import type { Denops } from "jsr:@denops/std@~7.3.0";
import * as vars from "jsr:@denops/std@~7.3.0/variable";

import type {
  ActionArguments,
  ActionFlags,
  Item,
} from "jsr:@shougo/ddu-vim@6.4.0/types";
import { BaseSource } from "jsr:@shougo/ddu-vim@6.4.0/source";
import type { ActionData } from "jsr:@shougo/ddu-kind-file@0.9.0";

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
