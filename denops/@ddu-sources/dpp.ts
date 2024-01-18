import {
  ActionArguments,
  ActionFlags,
  BaseSource,
  Item,
} from "https://deno.land/x/ddu_vim@v3.9.0/types.ts";
import { Denops, vars } from "https://deno.land/x/ddu_vim@v3.9.0/deps.ts";
import { ActionData } from "https://deno.land/x/ddu_kind_file@v0.7.1/file.ts";
import { Plugin } from "../dpp/types.ts";

type Params = Record<string, never>;

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
        const plugins = Object.values(
          await vars.g.get(
            args.denops,
            "dpp#_plugins",
          ),
        ) as Plugin[];

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
    return {};
  }
}
