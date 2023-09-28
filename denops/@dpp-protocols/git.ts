import { BaseProtocol } from "../dpp/types.ts";

type Params = Record<string, never>;

export class Ext extends BaseProtocol<Params> {
  override params(): Params {
    return {};
  }
}
