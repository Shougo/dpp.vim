import { Actions, BaseExt, DppOptions } from "../dpp/types.ts";
import { Denops } from "../dpp/deps.ts";

type Params = Record<string, never>;

export class Ext extends BaseExt<Params> {
  override actions: Actions<Params> = {
    install: {
      description: "Install plugins",
      callback: (args: {
        denops: Denops;
        options: DppOptions;
        actionParams: unknown;
      }) => {
        console.log(args.options);
      },
    },
  };

  override params(): Params {
    return {};
  }
}
