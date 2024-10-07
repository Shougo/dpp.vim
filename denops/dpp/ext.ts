import type {
  ActionName,
  BaseParams,
  Context,
  DppOptions,
  ExtName,
  ExtOptions,
  ProtocolName,
  ProtocolOptions,
} from "./types.ts";
import {
  defaultDummy,
  foldMerge,
  mergeExtOptions,
  mergeExtParams,
  mergeProtocolOptions,
  mergeProtocolParams,
} from "./context.ts";
import type { Loader } from "./loader.ts";
import { type BaseExt, defaultExtOptions } from "./base/ext.ts";
import { type BaseProtocol, defaultProtocolOptions } from "./base/protocol.ts";
import type { Protocol } from "./base/protocol.ts";
import { printError } from "./utils.ts";

import type { Denops } from "jsr:@denops/std@~7.2.0";
import * as fn from "jsr:@denops/std@~7.2.0/function";

export async function getProtocols(
  denops: Denops,
  loader: Loader,
  options: DppOptions,
) {
  const protocols: Record<ProtocolName, Protocol> = {};

  for (const procotolName of options.protocols) {
    const [protocol, protocolOptions, protocolParams] = await getProtocol(
      denops,
      loader,
      options,
      procotolName,
    );
    if (!protocol) {
      continue;
    }

    protocols[procotolName] = {
      protocol,
      options: protocolOptions,
      params: protocolParams,
    };
  }

  return protocols;
}

export async function extAction(
  denops: Denops,
  loader: Loader,
  context: Context,
  options: DppOptions,
  extName: ExtName,
  actionName: ActionName,
  actionParams: BaseParams = {},
): Promise<unknown | undefined> {
  const [ext, extOptions, extParams] = await getExt(
    denops,
    loader,
    options,
    extName,
  );
  if (!ext) {
    return;
  }

  const action = ext.actions[actionName];
  if (!action) {
    await printError(
      denops,
      `Not found UI action: ${actionName}`,
    );
    return;
  }

  const ret = await action.callback({
    denops,
    context,
    options,
    protocols: await getProtocols(denops, loader, options),
    extOptions,
    extParams,
    actionParams,
  });

  if (
    await fn.exists(
      denops,
      `#User#Dpp:extActionPost:${extName}:${actionName}`,
    )
  ) {
    await denops.cmd(
      `doautocmd <nomodeline> User Dpp:extActionPost:${extName}:${actionName}`,
    );
  }

  return ret;
}

export async function getExt(
  denops: Denops,
  loader: Loader,
  options: DppOptions,
  name: ExtName,
): Promise<
  [
    BaseExt<BaseParams> | undefined,
    ExtOptions,
    BaseParams,
  ]
> {
  if (!loader.getExt(name)) {
    const exists = await loader.autoload(denops, "ext", name);
    if (!exists) {
      await printError(
        denops,
        `Not found ext: "${name}"`,
      );
    }
  }

  const ext = loader.getExt(name);
  if (!ext) {
    return [
      undefined,
      defaultExtOptions(),
      defaultDummy(),
    ];
  }

  const [extOptions, extParams] = extArgs(options, ext);
  await checkExtOnInit(ext, denops, extOptions, extParams);

  return [ext, extOptions, extParams];
}

async function getProtocol(
  denops: Denops,
  loader: Loader,
  options: DppOptions,
  name: ProtocolName,
): Promise<
  [
    BaseProtocol<BaseParams> | undefined,
    ProtocolOptions,
    BaseParams,
  ]
> {
  if (!loader.getProtocol(name)) {
    const exists = await loader.autoload(denops, "protocol", name);
    if (!exists) {
      await printError(
        denops,
        `Not found protocol: "${name}"`,
      );
    }
  }

  const protocol = loader.getProtocol(name);
  if (!protocol) {
    return [
      undefined,
      defaultProtocolOptions(),
      defaultDummy(),
    ];
  }

  const [protocolOptions, protocolParams] = protocolArgs(options, protocol);
  await checkProtocolOnInit(
    protocol,
    denops,
    protocolOptions,
    protocolParams,
  );

  return [protocol, protocolOptions, protocolParams];
}

async function checkExtOnInit(
  ext: BaseExt<BaseParams>,
  denops: Denops,
  extOptions: ExtOptions,
  extParams: BaseParams,
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
    await printError(
      denops,
      e,
      `ext: ${ext.name} "onInit()" failed`,
    );
  }
}

function extArgs<
  Params extends BaseParams,
>(
  options: DppOptions,
  ext: BaseExt<Params>,
): [ExtOptions, BaseParams] {
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

async function checkProtocolOnInit(
  protocol: BaseProtocol<BaseParams>,
  denops: Denops,
  protocolOptions: ProtocolOptions,
  protocolParams: BaseParams,
) {
  if (protocol.isInitialized) {
    return;
  }

  try {
    await protocol.onInit({
      denops,
      protocolOptions,
      protocolParams,
    });

    protocol.isInitialized = true;
  } catch (e: unknown) {
    await printError(
      denops,
      e,
      `protocol: ${protocol.name} "onInit()" failed`,
    );
  }
}

function protocolArgs<
  Params extends BaseParams,
>(
  options: DppOptions,
  protocol: BaseProtocol<Params>,
): [ExtOptions, BaseParams] {
  const o = foldMerge(
    mergeProtocolOptions,
    defaultProtocolOptions,
    [
      options.protocolOptions["_"],
      options.protocolOptions[protocol.name],
    ],
  );
  const p = foldMerge(mergeProtocolParams, defaultDummy, [
    protocol.params(),
    options.protocolParams["_"],
    options.protocolParams[protocol.name],
  ]);
  return [o, p];
}
