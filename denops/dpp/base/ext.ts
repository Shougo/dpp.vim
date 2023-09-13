import { Actions } from "../types.ts";

export type BaseExtParams = Record<string, unknown>;

export abstract class BaseExt<Params extends BaseExtParams> {
  apiVersion = 1;

  name = "";
  path = "";
  isInitialized = false;

  abstract params(): Params;

  actions: Actions<Params> = {};
}
