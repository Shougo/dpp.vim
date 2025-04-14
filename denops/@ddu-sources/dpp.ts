import type { Plugin } from "../dpp/types.ts";

import type { Denops } from "jsr:@denops/std@~7.5.0";
import * as vars from "jsr:@denops/std@~7.5.0/variable";

import {
  ActionFlags,
  type Actions,
  type DduItem,
  type Item,
} from "jsr:@shougo/ddu-vim@10.3.0/types";
import { BaseSource } from "jsr:@shougo/ddu-vim@10.3.0/source";
import type { ActionData } from "jsr:@shougo/ddu-kind-file@0.9.0";

type Params = {
  names: string[];
};

type Action = {
  path: string;
  url: string;
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
            word: plugin.description
              ? `${plugin.name} : ${plugin.description}`
              : plugin.name,
            highlights: [{
              name: "pluginName",
              hl_group: "Statement",
              col: 1,
              width: plugin.name.length,
            }],
            action: {
              path: plugin.path,
              url: plugin.url ?? "",
              __name: plugin.name,
            } as Action,
            info: [
              {
                text: plugin.path ?? "",
                hl_group: "Directory",
              },
            ],
          };
        });

        controller.enqueue(items);

        controller.close();
      },
    });
  }

  override actions: Actions<Params> = {
    browse: {
      description: "Browse the plugin URL.",
      callback: async (args: { denops: Denops; items: DduItem[] }) => {
        for (const item of args.items) {
          const action = item?.action as Action;
          if (action.url.length > 0) {
            await args.denops.call("ddu#kind#file#open", action.url, "");
          }
        }

        return Promise.resolve(ActionFlags.None);
      },
    },
  };

  override params(): Params {
    return {
      names: [],
    };
  }
}
