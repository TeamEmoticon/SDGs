import assert from "node:assert/strict";
import test from "node:test";
import manifest from "../src/app/manifest.ts";

test("PWA manifest enables standalone installation with a maskable icon", () => {
  const appManifest = manifest();

  assert.equal(appManifest.display, "standalone");
  assert.equal(appManifest.start_url, "/");
  assert.equal(appManifest.theme_color, "#fffdf7");
  assert.ok(
    appManifest.icons?.some(
      (icon) => icon.src === "/icons/ansimgle-icon-192.png" && icon.sizes === "192x192",
    ),
  );
  assert.ok(
    appManifest.icons?.some(
      (icon) =>
        icon.src === "/icons/ansimgle-icon-512.png" &&
        icon.sizes === "512x512" &&
        icon.purpose === "maskable",
    ),
  );
});
