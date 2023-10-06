import { Denops } from "./deps.ts";

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
