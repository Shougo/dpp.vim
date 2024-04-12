import { Denops, fn } from "./deps.ts";
import {
  ActionName,
  BaseExt,
  BaseExtParams,
  BaseProtocol,
  BaseProtocolParams,
  Context,
  DppOptions,
  ExtName,
  ExtOptions,
  Protocol,
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
import { Loader } from "./loader.ts";
import { defaultExtOptions } from "./base/ext.ts";
import { defaultProtocolOptions } from "./base/protocol.ts";
import { errorException } from "./utils.ts";

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
  actionParams: unknown = {},
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
    await denops.call(
      "dpp#util#_error",
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

async function getExt(
  denops: Denops,
  loader: Loader,
  options: DppOptions,
  name: ExtName,
): Promise<
  [
    BaseExt<BaseExtParams> | undefined,
    ExtOptions,
    BaseExtParams,
  ]
> {
  if (!loader.getExt(name)) {
    await loader.autoload(denops, "ext", name);
  }

  const ext = loader.getExt(name);
  if (!ext) {
    if (name.length !== 0) {
      await denops.call(
        "dpp#util#_error",
        `Not found ext: "${name}"`,
      );
    }
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
    BaseProtocol<BaseProtocolParams> | undefined,
    ProtocolOptions,
    BaseProtocolParams,
  ]
> {
  if (!loader.getProtocol(name)) {
    await loader.autoload(denops, "protocol", name);
  }

  const protocol = loader.getProtocol(name);
  if (!protocol) {
    if (name.length !== 0) {
      await denops.call(
        "dpp#util#_error",
        `Not found protocol: "${name}"`,
      );
    }
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

async function checkProtocolOnInit(
  protocol: BaseProtocol<BaseProtocolParams>,
  denops: Denops,
  protocolOptions: ProtocolOptions,
  protocolParams: BaseProtocolParams,
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
    await errorException(
      denops,
      e,
      `protocol: ${protocol.name} "onInit()" failed`,
    );
  }
}

function protocolArgs<
  Params extends BaseProtocolParams,
>(
  options: DppOptions,
  protocol: BaseProtocol<Params>,
): [ExtOptions, BaseExtParams] {
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
