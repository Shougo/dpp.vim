import { Denops } from "./deps.ts";
import {
  BaseExtParams,
  BaseProtocolParams,
  Context,
  DppOptions,
  ExtOptions,
  ProtocolOptions,
} from "./types.ts";

// where
// T: Object
// partialMerge: PartialMerge
// partialMerge(partialMerge(a, b), c) === partialMerge(a, partialMerge(b, c))
type PartialMerge<T> = (a: Partial<T>, b: Partial<T>) => Partial<T>;
type Merge<T> = (a: T, b: Partial<T>) => T;
type Default<T> = () => T;

function partialOverwrite<T>(a: Partial<T>, b: Partial<T>): Partial<T> {
  return { ...a, ...b };
}

function overwrite<T>(a: T, b: Partial<T>): T {
  return { ...a, ...b };
}

export const mergeExtOptions: Merge<ExtOptions> = overwrite;
export const mergeProtocolOptions: Merge<ProtocolOptions> = overwrite;

export const mergeExtParams: Merge<BaseExtParams> = overwrite;
export const mergeProtocolParams: Merge<BaseProtocolParams> = overwrite;

export function foldMerge<T>(
  merge: Merge<T>,
  def: Default<T>,
  partials: (null | undefined | Partial<T>)[],
): T {
  return partials.map((x) => x || {}).reduce(merge, def());
}

export function defaultContext(): Context {
  return {};
}

export function defaultDppOptions(): DppOptions {
  return {
    extOptions: {},
    extParams: {},
    hooksFileMarker: "{{{,}}}",
    inlineVimrcs: [],
    protocolOptions: {},
    protocolParams: {},
    protocols: [],
  };
}

export function defaultDummy(): Record<string, unknown> {
  return {};
}

function migrateEachKeys<T>(
  merge: PartialMerge<T>,
  a: null | undefined | Record<string, Partial<T>>,
  b: null | undefined | Record<string, Partial<T>>,
): null | Record<string, Partial<T>> {
  if (!a && !b) return null;
  const ret: Record<string, Partial<T>> = {};
  if (a) {
    for (const key in a) {
      ret[key] = a[key];
    }
  }
  if (b) {
    for (const key in b) {
      if (key in ret) {
        ret[key] = merge(ret[key], b[key]);
      } else {
        ret[key] = b[key];
      }
    }
  }
  return ret;
}

export function mergeDppOptions(
  a: DppOptions,
  b: Partial<DppOptions>,
): DppOptions {
  const overwritten: DppOptions = overwrite(a, b);
  const partialMergeExtOptions = partialOverwrite;
  const partialMergeExtParams = partialOverwrite;
  const partialMergeProtocolOptions = partialOverwrite;
  const partialMergeProtocolParams = partialOverwrite;

  return Object.assign(overwritten, {
    extOptions: migrateEachKeys(
      partialMergeExtOptions,
      a.extOptions,
      b.extOptions,
    ) || {},
    extParams: migrateEachKeys(
      partialMergeExtParams,
      a.extParams,
      b.extParams,
    ) || {},
    protocolOptions: migrateEachKeys(
      partialMergeProtocolOptions,
      a.protocolOptions,
      b.protocolOptions,
    ) || {},
    protocolParams: migrateEachKeys(
      partialMergeProtocolParams,
      a.protocolParams,
      b.protocolParams,
    ) || {},
  });
}

function patchDppOptions(
  a: Partial<DppOptions>,
  b: Partial<DppOptions>,
): Partial<DppOptions> {
  const overwritten: Partial<DppOptions> = { ...a, ...b };

  const eo = migrateEachKeys(
    partialOverwrite,
    a.extOptions,
    b.extOptions,
  );
  if (eo) overwritten.extOptions = eo;

  const po = migrateEachKeys(
    partialOverwrite,
    a.protocolOptions,
    b.protocolOptions,
  );
  if (po) overwritten.protocolOptions = po;

  const ep = migrateEachKeys(partialOverwrite, a.extParams, b.extParams);
  if (ep) overwritten.extParams = ep;
  const pp = migrateEachKeys(
    partialOverwrite,
    a.protocolParams,
    b.protocolParams,
  );
  if (pp) overwritten.protocolParams = pp;

  return overwritten;
}

// Customization by end users
class Custom {
  global: Partial<DppOptions> = {};

  get(): DppOptions {
    return foldMerge(mergeDppOptions, defaultDppOptions, [
      this.global,
    ]);
  }

  setGlobal(options: Partial<DppOptions>): Custom {
    this.global = options;
    return this;
  }
  patchGlobal(options: Partial<DppOptions>): Custom {
    this.global = patchDppOptions(this.global, options);
    return this;
  }
}

export class ContextBuilder {
  #custom: Custom = new Custom();

  async get(
    denops: Denops,
  ): Promise<[Context, DppOptions]> {
    const userOptions = this.#custom.get();

    await this.validate(denops, "options", userOptions, defaultDppOptions());

    return [
      {
        ...defaultContext(),
      },
      userOptions,
    ];
  }

  async validate(
    denops: Denops,
    name: string,
    options: Record<string, unknown>,
    defaults: Record<string, unknown>,
  ) {
    for (const key in options) {
      if (!(key in defaults)) {
        await denops.call(
          "dpp#util#_error",
          `Invalid ${name}: "${key}"`,
        );
      }
    }
  }

  getGlobal(): Partial<DppOptions> {
    return this.#custom.global;
  }

  setGlobal(options: Partial<DppOptions>) {
    this.#custom.setGlobal(options);
  }

  patchGlobal(options: Partial<DppOptions>) {
    this.#custom.patchGlobal(options);
  }
}
