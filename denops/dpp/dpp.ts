import {
  assertEquals,
  Denops,
  dirname,
  extname,
  fn,
  is,
  join,
  vars,
} from "./deps.ts";
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
  Plugin,
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
import { ConfigReturn } from "./base/config.ts";
import {
  convert2List,
  errorException,
  isDirectory,
  linkPath,
  parseHooksFile,
} from "./utils.ts";

export class Dpp {
  #loader: Loader;

  constructor(loader: Loader) {
    this.#loader = loader;
  }

  async getProtocols(denops: Denops, options: DppOptions) {
    const protocols: Record<ProtocolName, Protocol> = {};

    for (const procotolName of options.protocols) {
      const [protocol, protocolOptions, protocolParams] = await this
        .#getProtocol(denops, options, procotolName);
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

  async extAction(
    denops: Denops,
    context: Context,
    options: DppOptions,
    extName: ExtName,
    actionName: ActionName,
    actionParams: unknown = {},
  ): Promise<unknown | undefined> {
    const [ext, extOptions, extParams] = await this.#getExt(
      denops,
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
      protocols: await this.getProtocols(denops, options),
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

  async makeState(
    denops: Denops,
    options: DppOptions,
    basePath: string,
    configPath: string,
    name: string,
    configReturn: ConfigReturn,
  ) {
    const hasWindows = await fn.has(denops, "win32");
    const hasLua = denops.meta.host === "nvim" || await fn.has(denops, "lua");

    // Initialize plugins
    const protocols = await this.getProtocols(denops, options);
    const recordPlugins: Record<string, Plugin> = {};
    for (const plugin of configReturn.plugins) {
      // NOTE: detectPlugin changes "plugin" value
      await detectPlugin(
        denops,
        options,
        protocols,
        plugin,
      );

      if (plugin.hooks_file) {
        for (const hooksFile of convert2List(plugin.hooks_file)) {
          const hooksFilePath = await denops.call(
            "dpp#util#_expand",
            hooksFile,
          ) as string;
          const hooksFileLines = (await Deno.readTextFile(hooksFilePath)).split(
            /\r?\n/,
          );

          Object.assign(
            plugin,
            parseHooksFile(
              options.hooksFileMarker,
              hooksFileLines,
            ),
          );
        }
      }

      recordPlugins[plugin.name] = initPlugin(
        plugin,
        basePath,
        hasLua,
      );
    }

    const dppRuntimepath = `${basePath}/${name}/.dpp`;
    if (await isDirectory(dppRuntimepath)) {
      // Remove old runtime files
      await Deno.remove(dppRuntimepath, { recursive: true });
    }
    await Deno.mkdir(dppRuntimepath, { recursive: true });

    // Get runtimepath
    // NOTE: Use init_runtimepath.
    // Because "makeState" may be called after VimEnter.
    const currentRuntimepath = await vars.g.get(
      denops,
      "dpp#_init_runtimepath",
    );

    const rtps = await denops.call(
      "dpp#util#_split_rtp",
      currentRuntimepath,
    ) as string[];

    const runtimeIndex = rtps.indexOf(
      await denops.call("dpp#util#_get_runtime_path") as string,
    );

    const runtimePath = await denops.call(
      "dpp#util#_get_runtime_path",
    ) as string;
    const addRtp = async (plugin: Plugin) => {
      if (!plugin.rtp) {
        return;
      }

      plugin.sourced = true;
      rtps.splice(runtimeIndex, 0, plugin.rtp);

      const afterDir = `${plugin.rtp}/after`;
      if (await isDirectory(afterDir)) {
        rtps.splice(rtps.indexOf(runtimePath) + 1, 0, afterDir);
      }
    };

    // Check plugin-option-if is enabled
    const checkIf = async (plugin: Plugin) => {
      if (!("if" in plugin)) {
        return true;
      }

      if (is.Boolean(plugin.if)) {
        return plugin.if;
      }

      // Eval plugin-option-if string.
      return await denops.call("eval", plugin.if) as boolean;
    };

    // Add plugins runtimepath
    const depends = new Set<string>();
    for (
      const plugin of Object.values(recordPlugins).filter((plugin) =>
        !plugin.lazy
      )
    ) {
      if (
        !plugin.rtp || !await isDirectory(plugin.rtp) || !await checkIf(plugin)
      ) {
        continue;
      }

      for (const depend of convert2List(plugin.depends)) {
        depends.add(depend);
      }

      await addRtp(plugin);
    }

    // Load dependencies
    for (const depend of depends) {
      const plugin = recordPlugins[depend];
      if (!plugin) {
        await denops.call(
          "dpp#util#_error",
          `Not found dependency: "${depend}"`,
        );
        continue;
      }

      if (
        plugin.rtp || plugin.sourced ||
        !await isDirectory(plugin.rtp) ||
        !await checkIf(plugin)
      ) {
        continue;
      }

      await addRtp(plugin);
    }

    rtps.splice(rtps.indexOf(runtimePath), 0, dppRuntimepath);
    rtps.push(`${dppRuntimepath}/after`);

    const newRuntimepath = await denops.call(
      "dpp#util#_join_rtp",
      rtps,
      currentRuntimepath,
      dppRuntimepath,
    );

    const cacheVersion = await vars.g.get(denops, "dpp#_cache_version");
    let stateLines = [
      `if g:dpp#_cache_version !=# ${cacheVersion}` +
      `| throw "Cache version error" | endif`,
      "let [g:dpp#_plugins, g:dpp#ftplugin, g:dpp#_options, g:dpp#_check_files] = g:dpp#_cache",
      `let g:dpp#_config_path = '${configPath}'`,
      `let &runtimepath = '${newRuntimepath}'`,
    ];

    if (!configReturn.ftplugins) {
      configReturn.ftplugins = {};
    }

    // hooksFiles
    if (configReturn.hooksFiles) {
      for (
        const hooksFile of await Promise.all(configReturn.hooksFiles.map(
          async (hooksFile) =>
            await denops.call("dpp#util#_expand", hooksFile) as string,
        ))
      ) {
        const hooksFileLines = (await Deno.readTextFile(hooksFile)).split(
          /\r?\n/,
        );

        const parsedHooksFile = parseHooksFile(
          options.hooksFileMarker,
          hooksFileLines,
        );

        // Use ftplugin only
        if (parsedHooksFile.ftplugin && is.Record(parsedHooksFile.ftplugin)) {
          mergeFtplugins(configReturn.ftplugins, parsedHooksFile.ftplugin);
        }
      }
    }

    let checkFiles = configReturn.checkFiles ?? [];
    if (configReturn.hooksFiles) {
      checkFiles = checkFiles.concat(configReturn.hooksFiles);
    }

    if (await vars.g.get(denops, "dpp#_did_load_filetypes", false)) {
      stateLines.push("filetype off");
    }
    if (await vars.g.get(denops, "dpp#_did_load_ftplugin", false)) {
      stateLines.push("filetype plugin indent off");
    }
    if (configReturn.stateLines) {
      stateLines = stateLines.concat(configReturn.stateLines);
    }

    // NOTE: inlineVimrcs must be before plugins hook_add.
    const inlineVimrcs = await Promise.all(options.inlineVimrcs.map(
      async (vimrc) => await denops.call("dpp#util#_expand", vimrc) as string,
    ));
    for await (const vimrc of inlineVimrcs) {
      const vimrcLines = (await Deno.readTextFile(vimrc)).split(/\r?\n/);
      if (extname(vimrc) == ".lua") {
        if (hasLua) {
          stateLines = stateLines.concat(
            ["lua <<EOF"],
            vimrcLines.filter((line) => !line.match(/^\s*$|^\s*--/)),
            ["EOF"],
          );
        }
      } else {
        stateLines = stateLines.concat(
          vimrcLines.filter((line) => !line.match(/^\s*$|^\s*"/)),
        );
      }
    }

    for (const plugin of Object.values(recordPlugins)) {
      if (!plugin.path || !await isDirectory(plugin.path)) {
        continue;
      }

      if (plugin.hooks_file) {
        for (const hooksFile of convert2List(plugin.hooks_file)) {
          checkFiles.push(hooksFile);
        }
      }

      if (plugin.hook_add) {
        stateLines.push(plugin.hook_add);
      }

      if (plugin.ftplugin) {
        mergeFtplugins(configReturn.ftplugins, plugin.ftplugin);
      }
    }

    // Write state file
    const stateFile = `${basePath}/${name}/state.vim`;
    await Deno.writeTextFile(stateFile, stateLines.join("\n"));
    if (hasWindows) {
      await denops.call("dpp#util#_dos2unix", stateFile);
    }

    const cacheFile = `${basePath}/${name}/cache.vim`;
    const cacheLines = [
      JSON.stringify([
        recordPlugins,
        {},
        options,
        checkFiles,
      ]),
    ];
    await Deno.writeTextFile(cacheFile, cacheLines.join("\n"));
    if (hasWindows) {
      await denops.call("dpp#util#_dos2unix", cacheFile);
    }

    //console.log(stateLines);
    //console.log(cacheLines);

    await this.#mergePlugins(denops, dppRuntimepath, recordPlugins);

    // Generate ftplugin files
    if (configReturn.ftplugins) {
      const generatedFtplugins = await denops.call(
        "dpp#util#_generate_ftplugin",
        dppRuntimepath,
        configReturn.ftplugins,
      ) as Record<string, string[]>;

      for (const path of Object.keys(generatedFtplugins)) {
        const parent = dirname(path);
        if (!await isDirectory(parent)) {
          await Deno.mkdir(parent, { recursive: true });
        }

        await Deno.writeTextFile(path, generatedFtplugins[path].join("\n"));
        if (hasWindows) {
          await denops.call("dpp#util#_dos2unix", path);
        }
      }
    }

    // Reset loader cache.
    if (denops.meta.host === "nvim") {
      await denops.cmd("lua vim.loader.reset()");
    }

    await denops.cmd("doautocmd <nomodeline> User Dpp:makeStatePost");
  }

  async #mergePlugins(
    denops: Denops,
    dppRuntimepath: string,
    recordPlugins: Record<string, Plugin>,
  ) {
    const hasWindows = await fn.has(denops, "win32");
    const ftdetectDir = `${dppRuntimepath}/ftdetect`;
    if (!await isDirectory(ftdetectDir)) {
      await Deno.mkdir(ftdetectDir, { recursive: true });
    }
    const docDir = `${dppRuntimepath}/doc`;
    if (!await isDirectory(docDir)) {
      await Deno.mkdir(docDir, { recursive: true });
    }

    // Merge both ftdetect and help files
    for (const plugin of Object.values(recordPlugins)) {
      for (const src of ["doc", "ftdetect"]) {
        const srcDir = `${plugin.path}/${src}`;
        if (!plugin.path || !await isDirectory(srcDir)) {
          continue;
        }

        for await (const entry of Deno.readDir(srcDir)) {
          await linkPath(
            hasWindows,
            join(srcDir, entry.name),
            join(src == "doc" ? docDir : ftdetectDir, entry.name),
          );
        }
      }
    }

    // Execute :helptags when docDir is not empty
    for await (const _ of Deno.readDir(docDir)) {
      try {
        await denops.cmd(`silent helptags ${docDir}`);
      } catch (e: unknown) {
        await errorException(
          denops,
          e,
          `:helptags failed`,
        );
      }
      break;
    }

    // Merge plugin files
    for (
      const plugin of Object.values(recordPlugins).filter((plugin) =>
        plugin.merged
      )
    ) {
      if (!plugin.path || !await isDirectory(plugin.path)) {
        continue;
      }

      for await (const entry of Deno.readDir(plugin.path)) {
        if (["doc", "ftdetect", ".git"].indexOf(entry.name) >= 0) {
          // Skip
          continue;
        }

        await linkPath(
          hasWindows,
          join(plugin.path, entry.name),
          join(dppRuntimepath, entry.name),
        );
      }
    }
  }

  async #getExt(
    denops: Denops,
    options: DppOptions,
    name: ExtName,
  ): Promise<
    [
      BaseExt<BaseExtParams> | undefined,
      ExtOptions,
      BaseExtParams,
    ]
  > {
    if (!this.#loader.getExt(name)) {
      await this.#loader.autoload(denops, "ext", name);
    }

    const ext = this.#loader.getExt(name);
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

  async #getProtocol(
    denops: Denops,
    options: DppOptions,
    name: ProtocolName,
  ): Promise<
    [
      BaseProtocol<BaseProtocolParams> | undefined,
      ProtocolOptions,
      BaseProtocolParams,
    ]
  > {
    if (!this.#loader.getProtocol(name)) {
      await this.#loader.autoload(denops, "protocol", name);
    }

    const protocol = this.#loader.getProtocol(name);
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

function initPlugin(plugin: Plugin, basePath: string, hasLua: boolean): Plugin {
  plugin.sourced = false;

  if (!plugin.path) {
    // Set default path from basePath
    plugin.path = `${basePath}/repos/${plugin.repo ?? plugin.name}`;
  }

  if (plugin.rev && plugin.rev.length > 0) {
    // Add revision path
    plugin.path += `_${plugin.rev.replaceAll(/[^\w.-]/g, "_")}`;
  }

  if (plugin.script_type && plugin.script_type.length > 0) {
    // Add script_type path
    plugin.path += `/${plugin.script_type}`;
  }

  // Set rtp
  if (!plugin.rtp || plugin.rtp.length != 0) {
    plugin.rtp = !plugin.rtp ? plugin.path : `${plugin.path}/${plugin.rtp}`;
  }
  // Chomp
  plugin.rtp = plugin.rtp.replace(/\/$/, "");

  if (plugin.depends && is.String(plugin.depends)) {
    plugin.depends = [plugin.depends];
  }

  if (!("lazy" in plugin)) {
    // Default lazy set
    plugin.lazy = Object.keys(plugin).filter((key) =>
      key.startsWith("on_")
    ).length > 0;
  }

  if (!plugin.merged) {
    plugin.merged = !plugin.lazy && [
          "local",
          "build",
          "if",
          "hook_post_update",
        ].filter((key) => key in plugin).length <= 0;
  }

  // hooks
  const hooks: Record<string, string> = {};
  // Convert head backslashes
  for (
    const key of Object.keys(plugin).filter((key) => key.startsWith("hook_"))
  ) {
    hooks[key] = (plugin[key as keyof typeof plugin] as string).replaceAll(
      /\n\s*\\/g,
      "",
    );
  }

  // Convert lua_xxx keys
  if (hasLua) {
    for (
      const key of Object.keys(plugin).filter((key) => key.startsWith("lua_"))
    ) {
      const hook = key.replace(/^lua_/, "hook_");
      const lua = `lua <<EOF\n${plugin[key as keyof typeof plugin]}\nEOF\n`;
      if (hooks[hook]) {
        hooks[hook] += "\n" + lua;
      } else {
        hooks[hook] = lua;
      }
    }
  }

  Object.assign(plugin, hooks);

  return plugin;
}

function mergeFtplugins(
  ftplugins: Record<string, string>,
  ftplugin: Record<string, string>,
) {
  for (const [filetype, srcFtplugin] of Object.entries(ftplugin)) {
    const plugin = filetype.startsWith("lua_")
      ? `lua <<EOF\n${srcFtplugin}\nEOF\n`
      : srcFtplugin;
    const destFiletype = filetype.replace(/^lua_/, "");
    if (ftplugins[destFiletype]) {
      ftplugins[destFiletype] += `\n${plugin}`;
    } else {
      ftplugins[destFiletype] = plugin;
    }
  }
}

async function detectPlugin(
  denops: Denops,
  options: DppOptions,
  protocols: Record<ProtocolName, Protocol>,
  plugin: Plugin,
) {
  // Detect protocol
  if ("protocol" in plugin) {
    return plugin;
  }

  for (
    const protocol of options.protocols.filter((protocolName) =>
      protocols[protocolName]
    ).map((protocolName) => protocols[protocolName])
  ) {
    const detect = await protocol.protocol.detect({
      denops: denops,
      plugin,
      protocolOptions: protocol.options,
      protocolParams: protocol.params,
    });

    if (detect) {
      // Overwrite by detect()
      Object.assign(plugin, {
        ...detect,
        protocol: protocol.protocol.name,
      });
    }
  }

  return plugin;
}

Deno.test("initPlugin", () => {
  assertEquals(
    initPlugin(
      {
        name: "foo",
        rev: "[hoge]",
        script_type: "foo",
        rtp: "autoload",
      },
      "base",
      false,
    ),
    {
      name: "foo",
      path: "base/repos/foo__hoge_/foo",
      rtp: "base/repos/foo__hoge_/foo/autoload",
      rev: "[hoge]",
      script_type: "foo",
      lazy: false,
      merged: true,
      sourced: false,
    },
  );

  // lazy
  assertEquals(
    initPlugin(
      {
        name: "foo",
        on_ft: "foo",
      },
      "base",
      false,
    ),
    {
      name: "foo",
      path: "base/repos/foo",
      rtp: "base/repos/foo",
      lazy: true,
      merged: false,
      on_ft: "foo",
      sourced: false,
    },
  );

  // hooks
  assertEquals(
    initPlugin(
      {
        name: "foo",
        lua_add: "foo",
      },
      "base",
      true,
    ),
    {
      name: "foo",
      path: "base/repos/foo",
      rtp: "base/repos/foo",
      lazy: false,
      merged: true,
      sourced: false,
      hook_add: "lua <<EOF\nfoo\nEOF\n",
      lua_add: "foo",
    },
  );
});
