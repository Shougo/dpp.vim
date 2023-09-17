import { Actions, BaseExt } from "../dpp/types.ts";
import { Denops } from "../dpp/deps.ts";

type Params = Record<string, never>;

export class Ext extends BaseExt<Params> {
  override actions: Actions<Params> = {
    local: {
      description: "Load local plugins",
      callback: async (args: { denops: Denops }) => {
        console.log("hello");
      },
    },
  };

  override params(): Params {
    return {};
  }
}
