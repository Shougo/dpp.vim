import { assertEquals } from "@std/assert/equals";
import { join } from "@std/path/join";
import { linkPath } from "../utils.ts";

Deno.test(
  "linkPath: symlinks a file on non-Windows",
  { ignore: Deno.build.os === "windows" },
  async () => {
    const tmpDir = await Deno.makeTempDir();
    try {
      const srcFile = join(tmpDir, "src.txt");
      const destFile = join(tmpDir, "dest.txt");
      await Deno.writeTextFile(srcFile, "hello");

      await linkPath(false, srcFile, destFile);

      const stat = await Deno.stat(destFile);
      assertEquals(stat.isFile, true);
    } finally {
      await Deno.remove(tmpDir, { recursive: true });
    }
  },
);

Deno.test(
  "linkPath: skips existing dest file",
  { ignore: Deno.build.os === "windows" },
  async () => {
    const tmpDir = await Deno.makeTempDir();
    try {
      const srcFile = join(tmpDir, "src.txt");
      const destFile = join(tmpDir, "dest.txt");
      await Deno.writeTextFile(srcFile, "hello");
      await Deno.writeTextFile(destFile, "existing");

      // Should not throw even though dest already exists.
      await linkPath(false, srcFile, destFile);

      const content = await Deno.readTextFile(destFile);
      assertEquals(content, "existing");
    } finally {
      await Deno.remove(tmpDir, { recursive: true });
    }
  },
);

Deno.test(
  "linkPath: recursively symlinks directory contents",
  { ignore: Deno.build.os === "windows" },
  async () => {
    const tmpDir = await Deno.makeTempDir();
    try {
      const srcDir = join(tmpDir, "src");
      const destDir = join(tmpDir, "dest");
      await Deno.mkdir(srcDir);
      await Deno.writeTextFile(join(srcDir, "a.txt"), "a");
      await Deno.writeTextFile(join(srcDir, "b.txt"), "b");

      await linkPath(false, srcDir, destDir);

      const aStat = await Deno.stat(join(destDir, "a.txt"));
      const bStat = await Deno.stat(join(destDir, "b.txt"));
      assertEquals(aStat.isFile, true);
      assertEquals(bStat.isFile, true);
    } finally {
      await Deno.remove(tmpDir, { recursive: true });
    }
  },
);

Deno.test(
  "linkPath: recursively symlinks nested subdirectories",
  { ignore: Deno.build.os === "windows" },
  async () => {
    const tmpDir = await Deno.makeTempDir();
    try {
      const srcDir = join(tmpDir, "src");
      const subDir = join(srcDir, "sub");
      const destDir = join(tmpDir, "dest");
      await Deno.mkdir(subDir, { recursive: true });
      await Deno.writeTextFile(join(subDir, "c.txt"), "c");

      await linkPath(false, srcDir, destDir);

      const cStat = await Deno.stat(join(destDir, "sub", "c.txt"));
      assertEquals(cStat.isFile, true);
    } finally {
      await Deno.remove(tmpDir, { recursive: true });
    }
  },
);

Deno.test(
  "linkPath: no-ops when src does not exist",
  { ignore: Deno.build.os === "windows" },
  async () => {
    const tmpDir = await Deno.makeTempDir();
    try {
      const nonExistent = join(tmpDir, "nonexistent.txt");
      const destFile = join(tmpDir, "dest.txt");

      // Should not throw even when src is missing.
      await linkPath(false, nonExistent, destFile);

      // dest must not have been created.
      let created = false;
      try {
        await Deno.stat(destFile);
        created = true;
      } catch (_) {
        // expected
      }
      assertEquals(created, false);
    } finally {
      await Deno.remove(tmpDir, { recursive: true });
    }
  },
);
