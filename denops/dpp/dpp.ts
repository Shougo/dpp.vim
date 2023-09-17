import { Denops } from "./deps.ts";
import {
  ActionName,
  BaseExt,
  BaseExtParams,
  Context,
  DppOptions,
  ExtName,
  ExtOptions,
} from "./types.ts";
import {
  defaultContext,
  defaultDppOptions,
  defaultDummy,
  foldMerge,
  mergeExtOptions,
  mergeExtParams,
} from "./context.ts";
import { Loader } from "./loader.ts";
import { defaultExtOptions } from "./base/ext.ts";
import { errorException } from "./utils.ts";

export class Dpp {
  private loader: Loader;
  private context: Context = defaultContext();
  private options: DppOptions = defaultDppOptions();

  constructor(loader: Loader) {
    this.loader = loader;
  }

  async extAction(
    denops: Denops,
    extName: ExtName,
    actionName: ActionName,
    actionParams: unknown = {},
  ) {
    const [ext, extOptions, extParams] = await this.getExt(denops, extName);
    if (!ext) {
      return;
    }

    const action = ext.actions[actionName];
    if (!action) {
      await denops.call(
        "ddu#util#print_error",
        `Not found UI action: ${actionName}`,
      );
      return;
    }

    const ret = await action.callback({
      denops,
      context: this.context,
      options: this.options,
      extOptions,
      extParams,
      actionParams,
    });

    return ret;
  }

  private async getExt(
    denops: Denops,
    extName: ExtName,
  ): Promise<
    [
      BaseExt<BaseExtParams> | undefined,
      ExtOptions,
      BaseExtParams,
    ]
  > {
    if (!this.loader.getExt(extName)) {
      await this.loader.autoload(denops, "ext", extName);
    }

    const ext = this.loader.getExt(extName);
    if (!ext) {
      if (extName.length !== 0) {
        await denops.call(
          "dpp#util#print_error",
          `Not found ext: "${extName}"`,
        );
      }
      return [
        undefined,
        defaultExtOptions(),
        defaultDummy(),
      ];
    }

    const [extOptions, extParams] = extArgs(this.options, ext);
    await checkExtOnInit(ext, denops, extOptions, extParams);

    return [ext, extOptions, extParams];
  }
}

async function checkExtOnInit(
  ext: BaseExt<BaseExtParams>,
  denops: Denops,
  extOptions: ExtOptions,
  extParams: BaseExtParams,
) {
  if (ext.isInitialized) {
    return;
  }

  try {
    await ext.onInit({
      denops,
      extOptions,
      extParams,
    });

    ext.isInitialized = true;
  } catch (e: unknown) {
    await errorException(
      denops,
      e,
      `ext: ${ext.name} "onInit()" failed`,
    );
  }
}

function extArgs<
  Params extends BaseExtParams,
>(
  options: DppOptions,
  ext: BaseExt<Params>,
): [ExtOptions, BaseExtParams] {
  const o = foldMerge(
    mergeExtOptions,
    defaultExtOptions,
    [
      options.extOptions["_"],
      options.extOptions[ext.name],
    ],
  );
  const p = foldMerge(mergeExtParams, defaultDummy, [
    ext.params(),
    options.extParams["_"],
    options.extParams[ext.name],
  ]);
  return [o, p];
}
