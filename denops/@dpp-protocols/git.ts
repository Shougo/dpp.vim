import { BaseProtocol } from "../dpp/types.ts";

type Params = Record<string, never>;

export class Protocol extends BaseProtocol<Params> {
  override params(): Params {
    return {};
  }
}
