import type { Plugin } from "./types.ts";

import type { Denops } from "jsr:@denops/std@~7.2.0";

import { join } from "jsr:@std/path@~1.0.2/join";
import { assertEquals } from "jsr:@std/assert@~1.0.2/equals";

export async function printError(
  denops: Denops,
  ...messages: unknown[]
) {
  const message = messages.map((v) => {
    if (v instanceof Error) {
      // NOTE: In Deno, Prefer `Error.stack` because it contains `Error.message`.
      return `${v.stack ?? v}`;
    } else if (typeof v === "object") {
      return JSON.stringify(v);
    } else {
      return `${v}`;
    }
  }).join("\n");
  await denops.call("dpp#util#_error", message);
}

// See https://github.com/vim-denops/denops.vim/issues/358 for details
export function isDenoCacheIssueError(e: unknown): boolean {
  const expects = [
    "Could not find constraint in the list of versions: ", // Deno 1.40?
    "Could not find version of ", // Deno 1.38
  ] as const;
  if (e instanceof TypeError) {
    return expects.some((expect) => e.message.startsWith(expect));
  }
  return false;
}

export function convert2List<T>(expr: T | T[] | undefined): T[] {
  return !expr ? [] : Array.isArray(expr) ? expr : [expr];
}

export async function isDirectory(path: string | undefined): Promise<boolean> {
  if (!path) {
    return false;
  }

  // NOTE: Deno.stat() may be failed
  try {
    if ((await Deno.stat(path)).isDirectory) {
      return true;
    }
  } catch (_e: unknown) {
    // Ignore
  }

  return false;
}

export async function safeStat(path: string): Promise<Deno.FileInfo | null> {
  // NOTE: Deno.stat() may be failed
  try {
    const stat = await Deno.lstat(path);
    if (stat.isSymlink) {
      try {
        const stat = await Deno.stat(path);
        stat.isSymlink = true;
        return stat;
      } catch (_: unknown) {
        // Ignore stat exception
      }
    }
    return stat;
  } catch (_: unknown) {
    // Ignore stat exception
  }
  return null;
}

export async function linkPath(hasWindows: boolean, src: string, dest: string) {
  if (await isDirectory(src)) {
    if (!await safeStat(dest)) {
      // Not exists directory
      await Deno.mkdir(dest, { recursive: true });
    }

    if (!await isDirectory(dest)) {
      // NOTE: dest must be directory
      return;
    }

    // Recursive
    for await (const entry of Deno.readDir(src)) {
      await linkPath(hasWindows, join(src, entry.name), join(dest, entry.name));
    }
  } else {
    if (await safeStat(dest)) {
      // Exists file
      return;
    }

    if (hasWindows) {
      // NOTE: Use hard link for Windows.
      await Deno.link(src, dest);
    } else {
      await Deno.symlink(src, dest);
    }
  }
}

export function parseHooksFile(
  marker: string,
  hooksFile: string[],
): Record<string, string | Record<string, string>> {
  const startMarker = marker.split(",")[0];
  const endMarker = marker.split(",")[1];
  const options: Record<string, string | Record<string, string>> = {};
  const ftplugin: Record<string, string> = {};
  let dest:
    | Record<string, string | Record<string, string>>
    | Record<string, string>
    | null = null;
  let hookName = "";
  let nestedCount = 0;

  for (const line of hooksFile) {
    if (hookName.length === 0) {
      const markerPos = line.lastIndexOf(startMarker);
      if (markerPos < 0) {
        continue;
      }

      dest = null;

      // Get hookName
      const match = line.slice(0, markerPos).match(
        /\s+(?<hookName>[0-9a-zA-Z_-]+)\s*/,
      );
      if (!match || !match.groups) {
        // Invalid marker
        continue;
      }

      nestedCount++;

      hookName = match.groups.hookName;
      if (
        hookName.startsWith("hook_") ||
        hookName === "lua_add" ||
        hookName === "lua_source" ||
        hookName === "lua_depends_update" ||
        hookName.startsWith("lua_done_") ||
        hookName.startsWith("lua_post_")
      ) {
        dest = options;
      } else {
        // Use ftplugin
        dest = ftplugin;
      }
    } else {
      if (line.endsWith(startMarker)) {
        // Nested start
        nestedCount++;
      }

      if (line.endsWith(endMarker)) {
        // End marker
        nestedCount--;

        if (nestedCount <= 0) {
          // Nested end
          hookName = "";
          continue;
        }
      }

      if (!dest) {
        continue;
      }

      if (dest[hookName]) {
        dest[hookName] += "\n" + line;
      } else {
        dest[hookName] = line;
      }
    }
  }

  options["ftplugin"] = ftplugin;

  return options;
}

export function getLazyPlugins(plugins: Plugin[]): Plugin[] {
  return plugins.filter((plugin) =>
    plugin.lazy ||
    Object.keys(plugin).filter((key) => key.startsWith("on_")).length > 0
  );
}

export function mergeFtplugins(
  dest: Record<string, string>,
  src: Record<string, string>,
) {
  for (const [filetype, srcFtplugin] of Object.entries(src)) {
    const plugin = filetype.startsWith("lua_")
      ? `lua <<EOF\n${srcFtplugin}\nEOF\n`
      : srcFtplugin;
    if (filetype == "_") {
      dest[filetype] = plugin;
    } else {
      for (const destFiletype of filetype.replace(/^lua_/, "").split("_")) {
        if (dest[destFiletype]) {
          dest[destFiletype] += `\n${plugin}`;
        } else {
          dest[destFiletype] = plugin;
        }
      }
    }
  }
}

Deno.test("parseHooksFile", () => {
  assertEquals(
    parseHooksFile("{{{,}}}", [
      '" c {{{',
      "hogera",
      "}}}",
      '" hook_source {{{',
      "piyo",
      "}}}",
    ]),
    {
      hook_source: "piyo",
      ftplugin: {
        c: "hogera",
      },
    },
  );

  // Invalid line
  assertEquals(
    parseHooksFile("{{{,}}}", [
      '" {{{',
      "hogera",
      "}}}",
      '" hook_source {{{',
      "piyo",
      "}}}",
    ]),
    {
      hook_source: "piyo",
      ftplugin: {},
    },
  );

  // Nested line
  assertEquals(
    parseHooksFile("{{{,}}}", [
      '" hook_source {{{',
      "piyo",
      '" {{{',
      "hogera",
      '" }}}',
      '" }}}',
    ]),
    {
      hook_source: 'piyo\n" {{{\nhogera\n" }}}',
      ftplugin: {},
    },
  );

  assertEquals(
    parseHooksFile("{{{,}}}", [
      '" hook_source {{{',
      '" }}}',
      "",
      '" hook_add {{{',
      " comment1 {{{",
      "hoge",
      '" }}}',
      "",
      " comment2 {{{",
      "fuga",
      '" }}}',
      '" }}}',
    ]),
    {
      hook_add: ' comment1 {{{\nhoge\n" }}}\n\n comment2 {{{\nfuga\n" }}}',
      ftplugin: {},
    },
  );

  // Lua
  assertEquals(
    parseHooksFile("{{{,}}}", [
      "-- lua_source {{{",
      "piyo",
      "-- }}}",
    ]),
    {
      lua_source: "piyo",
      ftplugin: {},
    },
  );
  assertEquals(
    parseHooksFile("{{{,}}}", [
      "-- lua_hoge {{{",
      "piyo",
      "-- }}}",
    ]),
    {
      ftplugin: {
        lua_hoge: "piyo",
      },
    },
  );
});
