import type {
  ActionName,
  BaseParams,
  Context,
  DppOptions,
  ExtName,
  ExtOptions,
  Plugin,
  ProtocolName,
} from "./types.ts";
import type { Loader } from "./loader.ts";
import type { ConfigReturn } from "./base/config.ts";
import type { BaseExt } from "./base/ext.ts";
import type { Protocol } from "./base/protocol.ts";
import type { Dpp } from "./base/dpp.ts";
import { extAction, getExt, getProtocols } from "./ext.ts";
import {
  convert2List,
  isDirectory,
  linkPath,
  mergeFtplugins,
  parseHooksFile,
  printError,
  safeStat,
} from "./utils.ts";

import type { Denops } from "jsr:@denops/std@~7.6.0";
import * as fn from "jsr:@denops/std@~7.6.0/function";
import * as vars from "jsr:@denops/std@~7.6.0/variable";

import { dirname } from "jsr:@std/path@~1.1.0/dirname";
import { extname } from "jsr:@std/path@~1.1.0/extname";
import { join } from "jsr:@std/path@~1.1.0/join";
import { assertEquals } from "jsr:@std/assert@~1.0.2/equals";
import { is } from "jsr:@core/unknownutil@~4.3.0/is";

export class DppImpl implements Dpp {
  #loader: Loader;

  constructor(loader: Loader) {
    this.#loader = loader;
  }

  async extAction(
    denops: Denops,
    context: Context,
    options: DppOptions,
    extName: ExtName,
    actionName: ActionName,
    actionParams: BaseParams = {},
  ): Promise<unknown | undefined> {
    return await extAction(
      denops,
      this.#loader,
      context,
      options,
      extName,
      actionName,
      actionParams,
    );
  }

  async getExt(
    denops: Denops,
    options: DppOptions,
    extName: ExtName,
  ): Promise<
    [
      BaseExt<BaseParams> | undefined,
      ExtOptions,
      BaseParams,
    ]
  > {
    return await getExt(
      denops,
      this.#loader,
      options,
      extName,
    );
  }

  async getProtocols(
    denops: Denops,
    options: DppOptions,
  ): Promise<Record<ProtocolName, Protocol>> {
    return await getProtocols(denops, this.#loader, options);
  }

  async makeState(
    denops: Denops,
    options: DppOptions,
    basePath: string,
    configPath: string,
    name: string,
    configReturn: ConfigReturn,
    extraArgs: Record<string, unknown>,
  ) {
    const hasWindows = await fn.has(denops, "win32");
    const hasLua = denops.meta.host === "nvim" || await fn.has(denops, "lua");

    const multipleHooks = configReturn.multipleHooks ?? [];
    // Convert head backslashes
    for (const hooks of multipleHooks) {
      if (hooks.hook_add) {
        hooks.hook_add = hooks.hook_add.replaceAll(
          /\n\s*\\/g,
          "",
        );
      }
      if (hooks.hook_source) {
        hooks.hook_source = hooks.hook_source.replaceAll(
          /\n\s*\\/g,
          "",
        );
      }
    }

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

    // Initialize plugins
    const protocols = await getProtocols(denops, this.#loader, options);
    const recordPlugins: Record<string, Plugin> = {};
    const availablePlugins: Record<string, Plugin> = {};
    for (let basePlugin of configReturn.plugins) {
      // NOTE: detectPlugin changes "plugin" value
      await detectPlugin(
        denops,
        options,
        protocols,
        basePlugin,
      );

      if (configReturn.groups && basePlugin.group) {
        for (const group of convert2List(basePlugin.group)) {
          if (!configReturn.groups[group]) {
            await printError(
              denops,
              `Not available group: "${group}" in ${basePlugin.name}`,
            );

            continue;
          }

          basePlugin = {
            ...configReturn.groups[group],
            ...basePlugin,
          };
        }
      }

      if (basePlugin.hooks_file) {
        for (const hooksFile of convert2List(basePlugin.hooks_file)) {
          const hooksFilePath = await denops.call(
            "dpp#util#_expand",
            hooksFile,
          ) as string;
          const hooksFileLines = (await Deno.readTextFile(hooksFilePath)).split(
            /\r?\n/,
          );

          basePlugin = {
            ...basePlugin,
            ...parseHooksFile(
              options.hooksFileMarker,
              hooksFileLines,
            ),
          };
        }
      }

      const plugin = initPlugin(
        basePlugin,
        basePath,
        hasLua,
      );

      if (recordPlugins[plugin.name]) {
        await printError(
          denops,
          `Duplicated plugin is detected: "${plugin.name}"`,
        );
      }

      recordPlugins[plugin.name] = plugin;

      if (
        await isDirectory(plugin.path) &&
        await checkIf(plugin)
      ) {
        availablePlugins[plugin.name] = plugin;
      }
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
      if (!plugin.rtp || plugin.rtp === "") {
        return;
      }

      if (!plugin.merged) {
        rtps.splice(runtimeIndex, 0, plugin.rtp);

        const afterDir = `${plugin.rtp}/after`;
        if (await isDirectory(afterDir)) {
          rtps.splice(rtps.indexOf(runtimePath) + 1, 0, afterDir);
        }
      }

      plugin.sourced = true;
    };

    // Add plugins runtimepath
    const depends = new Set<string>();
    const nonLazyPlugins = Object.values(availablePlugins).filter((plugin) =>
      plugin.rtp !== "" && !plugin.lazy
    );
    const hookSources = [];
    for (const plugin of nonLazyPlugins) {
      for (const depend of convert2List(plugin.depends)) {
        if (!availablePlugins[depend]) {
          await printError(
            denops,
            `Not available dependency: "${depend}" in ${plugin.name}`,
          );
          continue;
        } else {
          depends.add(depend);
        }
      }

      if (plugin.hook_source) {
        hookSources.push(plugin.hook_source);
      }

      await addRtp(plugin);
    }

    // Load dependencies
    for (const depend of depends) {
      const plugin = availablePlugins[depend];

      await addRtp(plugin);

      if (plugin.rtp !== "" && plugin.hook_source) {
        hookSources.push(plugin.hook_source);
      }
    }

    rtps.splice(rtps.indexOf(runtimePath), 0, dppRuntimepath);
    rtps.push(`${dppRuntimepath}/after`);

    const newRuntimepath = await denops.call(
      "dpp#util#_join_rtp",
      rtps,
      currentRuntimepath,
      dppRuntimepath,
    );

    const stateVersion = await vars.g.get(denops, "dpp#_state_version");
    let startupLines = [
      `if g:dpp#_state_version !=# ${stateVersion}` +
      `| throw "State version error" | endif`,
      "let [" +
      "g:dpp#_plugins," +
      "g:dpp#ftplugin," +
      "g:dpp#_options," +
      "g:dpp#_check_files," +
      "g:dpp#_multiple_hooks," +
      "g:dpp#_extra_args" +
      "] = g:dpp#_state",
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
      startupLines.push("filetype off");
    }
    if (await vars.g.get(denops, "dpp#_did_load_ftplugin", false)) {
      startupLines.push("filetype plugin indent off");
    }
    if (configReturn.stateLines) {
      startupLines = startupLines.concat(configReturn.stateLines);
    }

    // NOTE: inlineVimrcs must be before plugins hook_add.
    const inlineVimrcs = await Promise.all(options.inlineVimrcs.map(
      async (vimrc) => await denops.call("dpp#util#_expand", vimrc) as string,
    ));
    for await (const vimrc of inlineVimrcs) {
      const vimrcLines = (await Deno.readTextFile(vimrc)).split(/\r?\n/);
      if (extname(vimrc) == ".lua") {
        if (hasLua) {
          startupLines = startupLines.concat(
            ["lua <<EOF"],
            vimrcLines.filter((line) => !line.match(/^\s*$|^\s*--/)),
            ["EOF"],
          );
        }
      } else {
        startupLines = startupLines.concat(
          vimrcLines.filter((line) => !line.match(/^\s*$|^\s*"/)),
        );
      }
    }

    for (const plugin of Object.values(availablePlugins)) {
      if (plugin.hooks_file) {
        for (const hooksFile of convert2List(plugin.hooks_file)) {
          checkFiles.push(hooksFile);
        }
      }

      if (plugin.hook_add) {
        startupLines.push(plugin.hook_add);
      }

      if (plugin.ftplugin) {
        mergeFtplugins(configReturn.ftplugins, plugin.ftplugin);
      }
    }

    // Check hook_add for multipleHooks
    const availablePluginNames = Object.values(availablePlugins).map((plugin) =>
      plugin.name
    );
    const nonLazyPluginNames = nonLazyPlugins.map((plugin) => plugin.name);
    for (const hooks of multipleHooks) {
      if (
        hooks.hook_add &&
        hooks.plugins.every((pluginName) =>
          availablePluginNames.includes(pluginName)
        )
      ) {
        startupLines.push(hooks.hook_add);
        hooks.hook_add = "";
      }

      if (
        hooks.hook_source &&
        hooks.plugins.every((pluginName) =>
          nonLazyPluginNames.includes(pluginName)
        )
      ) {
        hookSources.push(hooks.hook_source);
        hooks.hook_source = "";
      }
    }

    // Merge non lazy plugins hook_source
    startupLines = startupLines.concat(hookSources);

    // Write startup script
    const startupFile = `${basePath}/${name}/startup.vim`;
    await Deno.writeTextFile(startupFile, startupLines.join("\n"));
    if (hasWindows) {
      await denops.call("dpp#util#_dos2unix", startupFile);
    }

    // checkFiles must be unique
    checkFiles = [...new Set(checkFiles)];

    // Write state file
    const stateFile = `${basePath}/${name}/state.vim`;
    const stateLines = [
      JSON.stringify([
        recordPlugins,
        {},
        options,
        checkFiles,
        multipleHooks,
        extraArgs,
      ]),
    ];
    await Deno.writeTextFile(stateFile, stateLines.join("\n"));
    if (hasWindows) {
      await denops.call("dpp#util#_dos2unix", stateFile);
    }

    //console.log(startupLines);
    //console.log(stateLines);

    await this.#mergePlugins(
      denops,
      dppRuntimepath,
      options.skipMergeFilenamePattern,
      recordPlugins,
    );

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
    skipMergeFilenamePattern: string,
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
          if (entry.name.match(skipMergeFilenamePattern)) {
            // Skip exists tag file to avoid overwrite
            continue;
          }
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
        await printError(
          denops,
          e,
          `:helptags failed`,
        );
      }
      break;
    }

    const tagLines = await generateTaglines(Object.values(recordPlugins));
    await Deno.writeTextFile(
      `${dppRuntimepath}/doc/tags`,
      tagLines.join("\n"),
      { append: true },
    );

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
        if (
          ["doc", "ftdetect", ".git"].indexOf(entry.name) >= 0 ||
          entry.name.match(skipMergeFilenamePattern)
        ) {
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
  // NOTE: !plugin.rtp === true if empty string
  if (plugin.rtp === undefined || plugin.rtp !== "") {
    plugin.rtp = !plugin.rtp ? plugin.path : `${plugin.path}/${plugin.rtp}`;
  }
  // Chomp
  plugin.rtp = plugin.rtp.replace(/\/$/, "");

  if (plugin.depends && is.String(plugin.depends)) {
    plugin.depends = [plugin.depends];
  }

  if (plugin.lazy === undefined) {
    // Default lazy set
    plugin.lazy = Object.keys(plugin).filter((key) =>
      key.startsWith("on_")
    ).length > 0;
  }

  if (plugin.merged === undefined) {
    // Default merged set
    plugin.merged = !plugin.lazy && [
          "local",
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

type Tag = {
  title: string;
  pattern: string;
};

// Function to detect tags in a Markdown file
async function detectTagsInMarkdown(filePath: string): Promise<Tag[]> {
  const tags: Tag[] = [];
  const lines = await Deno.readTextFile(filePath).then((content) =>
    content.split("\n")
  );

  for (const line of lines) {
    // Match to markdown's (# title) or html's (<h1>title</h1>) pattern.
    const matches = line.match(
      /^\s*(#+\s*(.+)\s*$|<h[1-6][^>]*>\s*(.+)\s*<\/h[1-6]>)/,
    );

    if (!matches || matches.length <= 3) {
      continue;
    }

    // matches[2]: markdown subpattern
    // matches[3]: html subpattern
    const title = matches[2] !== undefined ? matches[2] : matches[3];
    const pattern = matches[1];

    tags.push({
      title: title.replace(/\s+/g, "-"),
      pattern: `/${
        pattern
          .replace(/\s+/g, "\\s\\+")
          .replace(/\//g, "\\/")
          .replace(/\./g, "\\.")
      }`,
    });
  }

  return tags;
}

async function generateTaglines(plugins: Plugin[]): Promise<string[]> {
  const taglines: string[] = [];

  const filteredPlugins = [];
  for (const plugin of plugins) {
    if (!(await isDirectory(`${plugin.rtp}/doc`))) {
      filteredPlugins.push(plugin);
    }
  }

  for (const plugin of filteredPlugins) {
    const markdownFiles = [];
    for (const file of ["README.md", "README.mkd"]) {
      const filePath = `${plugin.rtp}/${file}`;
      if (await safeStat(filePath)) {
        markdownFiles.push(filePath);
      }
    }

    for (const filePath of markdownFiles) {
      const tags = await detectTagsInMarkdown(filePath);

      for (const tag of tags) {
        const title = plugin.name.toLowerCase() === tag.title.toLowerCase()
          ? plugin.name
          : `${plugin.name}-${tag.title}`;
        taglines.push(`${title}\t${filePath}\t${tag.pattern}`);
      }
    }
  }

  return taglines;
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
