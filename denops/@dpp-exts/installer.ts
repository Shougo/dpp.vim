import { Actions, BaseExt, Plugin } from "../dpp/types.ts";
import { Denops } from "../dpp/deps.ts";

type Params = Record<string, never>;

export class Ext extends BaseExt<Params> {
  override actions: Actions<Params> = {};

  override params(): Params {
    return {};
  }
}
