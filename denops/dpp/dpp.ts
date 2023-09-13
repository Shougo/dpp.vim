import { ActionName, ExtName } from "./types.ts";
import { Loader } from "./loader.ts";
import { errorException } from "./utils.ts";

export class Dpp {
  private loader: Loader;

  constructor(loader: Loader) {
    this.loader = loader;
  }

  async extAction(extName: ExtName, actionName: ActionName, params: unknown) {
  }
}
