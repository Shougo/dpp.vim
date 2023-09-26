import { assertEquals, Denops, extname, is, op, vars } from "./deps.ts";
import {
  ActionName,
  BaseExt,
  BaseExtParams,
  Context,
  DppOptions,
  ExtName,
  ExtOptions,
  Plugin,
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
import { ConfigReturn } from "./base/config.ts";
import { errorException, isDirectory } from "./utils.ts";

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
        "dpp#util#_error",
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

  async makeState(
    denops: Denops,
    options: DppOptions,
    basePath: string,
    configReturn: ConfigReturn,
  ) {
    // Initialize plugins
    const recordPlugins: Record<string, Plugin> = {};
    for (const plugin of configReturn.plugins) {
      recordPlugins[plugin.name] = initPlugin(plugin, basePath);
    }

    if (!await isDirectory(basePath)) {
      await Deno.mkdir(basePath, { recursive: true });
    }

    // Write state file
    const progname = await vars.g.get(denops, "dpp#_progname");

    // Get runtimepath
    const dppRuntimepath = `${basePath}/.dpp`;
    if (!await isDirectory(dppRuntimepath)) {
      await Deno.mkdir(dppRuntimepath, { recursive: true });
    }
    const currentRuntimepath = await op.runtimepath.getGlobal(denops);

    const rtps = await denops.call(
      "dpp#util#_split_rtp",
      currentRuntimepath,
    ) as string[];

    const runtimeIndex = rtps.indexOf(
      await denops.call("dpp#util#_get_runtime_path") as string,
    );

    // Add plugins runtimepath
    for (
      const plugin of Object.values(recordPlugins).filter((plugin) =>
        !plugin.lazy
      )
    ) {
      if (plugin.rtp && await isDirectory(plugin.rtp)) {
        plugin.sourced = true;
        rtps.splice(runtimeIndex, 0, plugin.rtp);

        // TODO: Load dependencies

        const afterDir = `${plugin.rtp}/after`;
        if (await isDirectory(afterDir)) {
          rtps.splice(
            rtps.indexOf(
              await denops.call("dpp#util#_get_runtime_path") as string,
            ) + 1,
            0,
            afterDir,
          );
        }
      }
    }
    rtps.splice(
      rtps.indexOf(
        await denops.call("dpp#util#_get_runtime_path") as string,
      ),
      0,
      dppRuntimepath,
    );
    rtps.push(`${dppRuntimepath}/after`);

    const newRuntimepath = await denops.call(
      "dpp#util#_join_rtp",
      rtps,
      currentRuntimepath,
      dppRuntimepath,
    );

    const cacheVersion = await vars.g.get(denops, "dpp#_cache_version");
    const initRuntimepath = await vars.g.get(denops, "dpp#_init_runtimepath");
    let stateLines = [
      `if g:dpp#_cache_version !=# ${cacheVersion} ` +
      `|| g:dpp#_init_runtimepath !=# '${initRuntimepath}' | ` +
      "throw 'Cache loading error' | endif",
      "let [s:plugins, s:ftplugin] = dpp#min#_load_cache_raw()",
      "if s:plugins->empty() | throw 'Cache loading error' | endif",
      "let g:dpp#_plugins = s:plugins",
      "let g:dpp#ftplugin = s:ftplugin",
      `let g:dpp#_base_path = '${basePath}'`,
      `let &runtimepath = '${newRuntimepath}'`,
    ];

    if (await vars.g.get(denops, "did_load_filetypes", false)) {
      stateLines.push("filetype off");
    }
    if (
      await vars.b.get(denops, "did_indent", false) ||
      await vars.b.get(denops, "did_ftplugin", false)
    ) {
      stateLines.push("filetype plugin indent off");
    }

    for await (
      const vimrc of options.inlineVimrcs.map(async (vimrc) =>
        await denops.call("dpp#util#_expand", vimrc) as string
      )
    ) {
      const vimrcLines = (await Deno.readTextFile(vimrc)).split("\n");
      if (extname(vimrc) == "lua") {
        stateLines = ["lua <<EOF"].concat(
          vimrcLines.filter((line) => !line.match(/^\s*$|^\s*--/)),
        ).concat(["EOF"]);
      } else {
        stateLines = stateLines.concat(
          vimrcLines.filter((line) => !line.match(/^\s*$|^\s*"/)),
        );
      }
    }

    const stateFile = `${basePath}/state_${progname}.vim`;
    console.log(stateFile);
    await Deno.writeTextFile(stateFile, stateLines.join("\n"));

    const cacheFile = `${basePath}/cache_${progname}.vim`;
    const cacheLines = [
      JSON.stringify([configReturn.plugins, {}]),
    ];
    console.log(cacheFile);
    await Deno.writeTextFile(cacheFile, cacheLines.join("\n"));

    console.log(stateLines);
    //console.log(cacheLines);
    //console.log(rtps);
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
          "dpp#util#_error",
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

function initPlugin(plugin: Plugin, basePath: string): Plugin {
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

  if (!plugin.lazy) {
    plugin.lazy = [
      "on_ft",
      "on_cmd",
      "on_func",
      "on_lua",
      "on_map",
      "on_path",
      "on_if",
      "on_event",
      "on_source",
    ].filter((key) => key in plugin).length > 0;
  }

  if (!plugin.merged) {
    plugin.merged = !plugin.lazy && [
          "local",
          "build",
          "if",
          "hook_post_update",
        ].filter((key) => key in plugin).length <= 0;
  }

  return plugin;
}

Deno.test("initPlugin", () => {
  assertEquals(
    initPlugin({
      name: "foo",
      rev: "[hoge]",
      script_type: "foo",
      rtp: "autoload",
    }, "base"),
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
    initPlugin({
      name: "foo",
      on_ft: "foo",
    }, "base"),
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
});
