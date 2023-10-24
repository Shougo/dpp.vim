import { assertEquals, Denops, is } from "./deps.ts";

export async function errorException(
  denops: Denops,
  e: unknown,
  message: string,
) {
  await denops.call(
    "dpp#util#_error",
    message,
  );
  if (e instanceof Error) {
    await denops.call(
      "dpp#util#_error",
      e.message,
    );
    if (e.stack) {
      await denops.call(
        "dpp#util#_error",
        e.stack,
      );
    }
  } else {
    await denops.call(
      "dpp#util#_error",
      "unknown error object",
    );
    console.error(e);
  }
}

export function convert2List<T>(expr: T | T[]): T[] {
  return is.Array(expr) ? expr : [expr];
}

export async function isDirectory(path: string) {
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

      hookName = match.groups.hookName;
      if (hookName.startsWith("hook_") || hookName.startsWith("lua_")) {
        dest = options;
      } else {
        // Use ftplugin
        dest = ftplugin;
      }
    } else {
      if (line.endsWith(endMarker)) {
        hookName = "";
        continue;
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
});
