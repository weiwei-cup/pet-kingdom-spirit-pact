import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the playable Pet Kingdom title screen", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>宠物王国：灵契｜可玩序章<\/title>/i);
  assert.match(html, /class="game-shell phase-title"/);
  assert.match(html, /新的旅程/);
  assert.match(html, /没有登记的伙伴/);
  assert.match(html, /pixel\/title-landscape\.webp/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});

test("wires the cinematic prologue into the finished site", async () => {
  const [css, page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /function CinematicScene/);
  assert.match(page, /const PROLOGUE_SHOTS/);
  assert.match(page, /prologue-rain-academy\.webp/);
  assert.match(page, /prologue-pact-break\.webp/);
  assert.match(page, /shelter-black-bell\.webp/);
  assert.match(page, /go\("prologue"\)/);
  assert.match(css, /\.cinematic-scene/);
  assert.match(css, /@keyframes cinematicRain/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(layout, /宠物王国：灵契/);
  assert.doesNotMatch(`${page}\n${layout}\n${packageJson}`, /codex-preview|_sites-preview|react-loading-skeleton/);

  await assert.rejects(
    access(new URL("app/_sites-preview", templateRoot)),
  );
});
