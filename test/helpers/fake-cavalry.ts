import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const BRIDGE_PATH = fileURLToPath(new URL("../../bridge/cavalry-mcp-bridge.js", import.meta.url));

interface FakeLayer {
  id: string;
  name: string;
  type: string;
  parent: string;
  attributes: Record<string, unknown>;
  keyframes: Record<string, number[]>;
  easings: Record<string, string>;
}

/** A tiny in-memory stand-in for Cavalry's `api` namespace, covering what the bridge uses. */
export class FakeCavalryApi {
  layers = new Map<string, FakeLayer>();
  selection: string[] = [];
  frame = 0;
  playing = false;
  sceneFilePath = "";
  renders: Array<{ filePath: string; scale: number }> = [];
  private counters: Record<string, number> = {};
  readonly comp = "composition#1";

  constructor() {
    this.addLayer(
      "composition",
      "Composition 1",
      { resolution: [1920, 1080], fps: 30, frameRange: [0, 120] },
      this.comp,
    );
  }

  private addLayer(type: string, name: string, attributes: Record<string, unknown> = {}, forcedId?: string): string {
    this.counters[type] = (this.counters[type] ?? 0) + 1;
    const id = forcedId ?? `${type}#${this.counters[type]}`;
    this.layers.set(id, {
      id,
      name: name || id,
      type,
      parent: "",
      attributes: { position: [0, 0], rotation: 0, ...attributes },
      keyframes: {},
      easings: {},
    });
    return id;
  }

  private layer(id: string): FakeLayer {
    const layer = this.layers.get(id);
    if (!layer) throw new Error(`no layer ${id}`);
    return layer;
  }

  private sceneLayers(): FakeLayer[] {
    return [...this.layers.values()].filter((l) => l.type !== "composition");
  }

  // --- api surface -------------------------------------------------------
  getCavalryVersion = () => "2.7.0";
  getPlatform = () => "test";
  getActiveComp = () => this.comp;
  getComps = () => [this.comp];
  getNiceName = (id: string) => this.layer(id).name;
  getLayerType = (id: string) => this.layer(id).type;
  getParent = (id: string) => this.layer(id).parent;
  layerExists = (id: string) => this.layers.has(id);
  hasAttribute = (id: string, attr: string) => attr in this.layer(id).attributes;
  get = (id: string, attr: string) => this.layer(id).attributes[attr];
  getAttributes = (id: string) => Object.keys(this.layer(id).attributes);
  getAttrType = (id: string, attr: string) => typeof this.layer(id).attributes[attr];
  getSceneFilePath = () => this.sceneFilePath;
  sceneHasUnsavedChanges = () => true;
  getFrame = () => this.frame;
  setFrame = (frame: number) => {
    this.frame = frame;
  };
  play = () => {
    this.playing = true;
  };
  stop = () => {
    this.playing = false;
  };
  getCompLayers = (topLevel: boolean) =>
    this.sceneLayers()
      .filter((l) => !topLevel || l.parent === "")
      .map((l) => l.id);
  getCompLayersOfType = (topLevel: boolean, type: string) =>
    this.sceneLayers()
      .filter((l) => (!topLevel || l.parent === "") && l.type === type)
      .map((l) => l.id);
  getSelection = () => [...this.selection];
  select = (ids: string[]) => {
    this.selection = [...ids];
  };
  create = (type: string, name: string) => (type === "bogus" ? "" : this.addLayer(type, name));
  primitive = (shape: string, name: string) => this.addLayer("basicShape", name, { shape });
  deleteLayer = (id: string) => {
    this.layers.delete(id);
  };
  duplicate = (id: string) => {
    const src = this.layer(id);
    this.addLayer(src.type, `${src.name} copy`, { ...src.attributes });
  };
  rename = (id: string, name: string) => {
    this.layer(id).name = name;
  };
  parent = (id: string, parentId: string) => {
    this.layer(id).parent = parentId;
  };
  unParent = (id: string) => {
    this.layer(id).parent = "";
  };
  set = (id: string, values: Record<string, unknown>) => {
    Object.assign(this.layer(id).attributes, values);
  };
  setGenerator = (id: string, attr: string, type: string) => {
    this.layer(id).attributes[attr] = type;
  };
  connect = (from: string, fromAttr: string, to: string, toAttr: string) => {
    this.layer(to).attributes[toAttr] = `${from}.${fromAttr}`;
  };
  disconnect = (_from: string, _fromAttr: string, to: string, toAttr: string) => {
    delete this.layer(to).attributes[toAttr];
  };
  keyframe = (id: string, frame: number, values: Record<string, unknown>) => {
    const layer = this.layer(id);
    for (const attr of Object.keys(values)) {
      (layer.keyframes[attr] ??= []).push(frame);
    }
    return `keyframe#${frame}`;
  };
  magicEasing = (id: string, attr: string, frame: number, easing: string) => {
    this.layer(id).easings[`${attr}@${frame}`] = easing;
  };
  deleteKeyframe = (id: string, attr: string, frame: number) => {
    const layer = this.layer(id);
    layer.keyframes[attr] = (layer.keyframes[attr] ?? []).filter((f) => f !== frame);
  };
  deleteAnimation = (id: string, attr: string) => {
    delete this.layer(id).keyframes[attr];
  };
  setAttributeExpression = (id: string, attr: string, expression: string) => {
    this.layer(id).attributes[`${attr}:expression`] = expression;
  };
  renderPNGFrame = (filePath: string, scale: number) => {
    this.renders.push({ filePath, scale });
  };
  saveSceneAs = (filePath: string) => {
    this.sceneFilePath = filePath;
    return true;
  };
  saveScene = () => true;
  filePathExists = (filePath: string) => filePath.endsWith(".cv");
  openScene = (filePath: string) => {
    this.sceneFilePath = filePath;
  };
}

export interface BridgeHandle {
  handlePost(raw: string): { ok: boolean; result?: unknown; error?: string } | null;
  snapshot(): string;
  execute(op: string, args: Record<string, unknown>): unknown;
  version: string;
  protocol: number;
}

/** Load the real bridge script into a sandbox with the given fake api. */
export function loadBridge(api: FakeCavalryApi, config: { allowScript?: boolean; maxResults?: number } = {}) {
  const source = readFileSync(BRIDGE_PATH, "utf8");
  const context = vm.createContext({ api, console: { log: () => {} } });
  vm.runInContext(source, context, { filename: "cavalry-mcp-bridge.js" });
  Object.assign(context.CONFIG as Record<string, unknown>, config);
  return context.CavalryMcpBridge as BridgeHandle;
}

/**
 * Emulates Cavalry's api.WebServer around the real bridge: POST /post bodies are
 * queued and drained on a polling tick; GET /get returns the latest snapshot.
 */
export async function startFakeCavalry(options: { allowScript?: boolean; tickMs?: number } = {}) {
  const api = new FakeCavalryApi();
  const bridge = loadBridge(api, { allowScript: options.allowScript ?? false });
  const queue: string[] = [];
  let getResult = bridge.snapshot();

  const timer = setInterval(() => {
    while (queue.length > 0) bridge.handlePost(queue.shift()!);
    getResult = bridge.snapshot();
  }, options.tickMs ?? 5);

  const server: Server = createServer((req, res) => {
    if (req.method === "POST" && req.url === "/post") {
      let body = "";
      req.on("data", (chunk: Buffer) => (body += chunk.toString("utf8")));
      req.on("end", () => {
        queue.push(body);
        res.writeHead(200, { "Content-Type": "text/plain" }).end("ok");
      });
      return;
    }
    if (req.method === "GET" && req.url === "/get") {
      res.writeHead(200, { "Content-Type": "text/plain" }).end(getResult);
      return;
    }
    res.writeHead(404).end();
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  return {
    api,
    port,
    async close() {
      clearInterval(timer);
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
