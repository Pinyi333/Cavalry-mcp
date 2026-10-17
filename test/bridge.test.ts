import { beforeEach, describe, expect, it } from "vitest";
import { FakeCavalryApi, loadBridge, type BridgeHandle } from "./helpers/fake-cavalry.js";

describe("bridge script", () => {
  let api: FakeCavalryApi;
  let bridge: BridgeHandle;

  beforeEach(() => {
    api = new FakeCavalryApi();
    bridge = loadBridge(api);
  });

  const post = (op: string, args: Record<string, unknown> = {}, id = "req-1") =>
    bridge.handlePost(JSON.stringify({ id, op, args }))!;

  it("answers ping with versions", () => {
    expect(post("ping")).toEqual({
      ok: true,
      result: expect.objectContaining({
        bridge: "cavalry-mcp",
        protocol: 1,
        cavalryVersion: "2.7.0",
        allowScript: false,
      }),
    });
  });

  it("stores results in the /get snapshot by request id", () => {
    post("ping", {}, "abc");
    const snapshot = JSON.parse(bridge.snapshot());
    expect(snapshot.bridge).toBe("cavalry-mcp");
    expect(snapshot.results.abc.ok).toBe(true);
  });

  it("evicts old results beyond maxResults", () => {
    bridge = loadBridge(api, { maxResults: 2 });
    post("ping", {}, "a");
    post("ping", {}, "b");
    post("ping", {}, "c");
    expect(Object.keys(JSON.parse(bridge.snapshot()).results)).toEqual(["b", "c"]);
  });

  it("ignores malformed requests", () => {
    expect(bridge.handlePost("not json")).toBeNull();
    expect(bridge.handlePost(JSON.stringify({ op: "ping" }))).toBeNull();
  });

  it("reports unknown operations as errors", () => {
    expect(post("format_disk")).toEqual({ ok: false, error: "Unknown operation 'format_disk'." });
  });

  it("does not treat Object.prototype keys as operations", () => {
    expect(post("toString").ok).toBe(false);
  });

  it("describes the scene and active comp settings", () => {
    const info = post("scene_info").result as Record<string, unknown>;
    expect(info.activeComp).toBe("composition#1");
    expect(info.activeCompSettings).toEqual({ resolution: [1920, 1080], startFrame: 0, endFrame: 120, fps: 30 });
    expect(info.sceneFilePath).toBeNull();
  });

  it("creates a primitive with attributes and lists it", () => {
    const created = post("create_primitive", {
      shape: "rectangle",
      name: "Box",
      attributes: { rotation: 45 },
    }).result as { id: string };
    expect(created).toEqual({ id: "basicShape#1", name: "Box", type: "basicShape", parent: null });
    expect(api.get("basicShape#1", "rotation")).toBe(45);
    expect((post("list_layers").result as { layers: unknown[] }).layers).toHaveLength(1);
  });

  it("fails clearly when Cavalry cannot create a layer type", () => {
    expect(post("create_layer", { type: "bogus" })).toEqual({
      ok: false,
      error: "Cavalry could not create a layer of type 'bogus'.",
    });
  });

  it("validates arguments", () => {
    expect(post("create_primitive", {}).error).toBe("'shape' must be a non-empty string.");
    expect(post("set_attributes", { layerId: "nope#1", attributes: {} }).error).toBe("Layer 'nope#1' does not exist.");
  });

  it("reports which ids it deleted and which were missing", () => {
    post("create_primitive", { shape: "ellipse" });
    expect(post("delete_layers", { layerIds: ["basicShape#1", "ghost#9"] }).result).toEqual({
      deleted: ["basicShape#1"],
      missing: ["ghost#9"],
    });
  });

  it("returns the layers created by duplicate", () => {
    post("create_primitive", { shape: "star", name: "Star" });
    const result = post("duplicate_layer", { layerId: "basicShape#1" }).result as { created: Array<{ id: string }> };
    expect(result.created.map((l) => l.id)).toEqual(["basicShape#2"]);
  });

  it("parents and un-parents", () => {
    post("create_layer", { type: "group" });
    post("create_primitive", { shape: "ellipse" });
    expect(post("set_parent", { layerId: "basicShape#1", parentId: "group#1" }).result).toMatchObject({
      parent: "group#1",
    });
    expect(post("set_parent", { layerId: "basicShape#1", parentId: null }).result).toMatchObject({ parent: null });
  });

  it("sets keyframes and applies magic easing to every keyed attribute", () => {
    post("create_primitive", { shape: "ellipse" });
    const res = post("set_keyframes", {
      layerId: "basicShape#1",
      keyframes: [
        { frame: 0, values: { "position.x": -300, "scale.x": 1 }, easing: "SlowOut" },
        { frame: 30, values: { "position.x": 300 } },
      ],
    });
    expect(res.ok).toBe(true);
    const layer = api.layers.get("basicShape#1")!;
    expect(layer.keyframes["position.x"]).toEqual([0, 30]);
    expect(layer.easings).toEqual({ "position.x@0": "SlowOut", "scale.x@0": "SlowOut" });
  });

  it("deletes specific keyframes or all animation", () => {
    post("create_primitive", { shape: "ellipse" });
    post("set_keyframes", {
      layerId: "basicShape#1",
      keyframes: [
        { frame: 0, values: { rotation: 0 } },
        { frame: 10, values: { rotation: 90 } },
      ],
    });
    post("delete_keyframes", { layerId: "basicShape#1", attrId: "rotation", frames: [10] });
    expect(api.layers.get("basicShape#1")!.keyframes.rotation).toEqual([0]);
    post("delete_keyframes", { layerId: "basicShape#1", attrId: "rotation" });
    expect(api.layers.get("basicShape#1")!.keyframes.rotation).toBeUndefined();
  });

  it("strips a trailing .png before rendering", () => {
    const res = post("render_png", { filePath: "/tmp/out/frame.PNG", frame: 12 }).result;
    expect(res).toEqual({ filePath: "/tmp/out/frame.png", frame: 12, scalePercent: 100 });
    expect(api.renders).toEqual([{ filePath: "/tmp/out/frame", scale: 100 }]);
  });

  it("refuses to save an untitled scene in place", () => {
    expect(post("save_scene").error).toMatch(/never been saved/);
    expect(post("save_scene", { filePath: "/tmp/a.cv" }).result).toEqual({ sceneFilePath: "/tmp/a.cv" });
  });

  it("keeps run_script disabled by default", () => {
    expect(post("run_script", { code: "return 1" }).error).toMatch(/disabled/);
  });

  it("runs scripts when allowed", () => {
    bridge = loadBridge(api, { allowScript: true });
    expect(post("run_script", { code: "return api.getComps();" }).result).toEqual({ value: ["composition#1"] });
  });

  it("runs batches in order and stops at the first failure", () => {
    const ok = post("batch", {
      operations: [
        { op: "create_primitive", args: { shape: "ellipse" } },
        { op: "set_attributes", args: { layerId: "basicShape#1", attributes: { rotation: 10 } } },
      ],
    });
    expect(ok.ok).toBe(true);
    expect(api.get("basicShape#1", "rotation")).toBe(10);

    const failed = post("batch", {
      operations: [
        { op: "create_primitive", args: { shape: "star" } },
        { op: "rename_layer", args: { layerId: "x#1", name: "y" } },
      ],
    });
    expect(failed.error).toBe("Operation 1 (rename_layer) failed: Layer 'x#1' does not exist.");
    expect(api.layerExists("basicShape#2")).toBe(true);
  });

  it("rejects nested batches", () => {
    expect(post("batch", { operations: [{ op: "batch", args: {} }] }).error).toMatch(/Nested batch/);
  });

  it("rejects unknown attribute paths instead of failing silently", () => {
    post("create_primitive", { shape: "ellipse" });
    expect(post("set_attributes", { layerId: "basicShape#1", attributes: { "positon.x": 1 } }).error).toMatch(
      /has no attribute 'positon.x'.*list_attributes/,
    );
    expect(post("set_attributes", { layerId: "basicShape#1", attributes: { "position.x": 1 } }).ok).toBe(true);
    expect(
      post("set_attributes", { layerId: "basicShape#1", attributes: { "special.path": 1 }, skipValidation: true }).ok,
    ).toBe(true);
    expect(post("create_primitive", { shape: "star", attributes: { bogus: 1 } }).ok).toBe(false);
    expect(post("set_keyframes", { layerId: "basicShape#1", keyframes: [{ frame: 0, values: { nope: 1 } }] }).ok).toBe(
      false,
    );
  });

  it("lists attributes with values", () => {
    post("create_primitive", { shape: "ellipse" });
    const res = post("list_attributes", { layerId: "basicShape#1", includeValues: true }).result as {
      attributes: Array<{ id: string; value: unknown }>;
    };
    expect(res.attributes).toContainEqual({ id: "opacity", value: 100 });
  });

  it("returns bounding boxes and connections", () => {
    post("create_primitive", { shape: "ellipse" });
    post("create_layer", { type: "duplicator" });
    post("connect", { fromLayerId: "basicShape#1", toLayerId: "duplicator#1", toAttrId: "shapes" });
    expect(post("get_bounding_box", { layerId: "basicShape#1" }).result).toMatchObject({
      boundingBox: { width: 100, height: 100 },
    });
    expect(post("inspect_connections", { layerId: "duplicator#1" }).result).toEqual({
      layerId: "duplicator#1",
      inputs: [{ attrId: "shapes", from: "basicShape#1.id" }],
      outputs: [],
    });
  });

  it("adds dynamic attributes", () => {
    post("create_layer", { type: "javaScript" });
    expect(post("add_dynamic_attribute", { layerId: "javaScript#1", type: "double" }).result).toMatchObject({
      arrayCount: 1,
    });
  });

  it("resolves $-references to earlier batch results", () => {
    const res = post("batch", {
      operations: [
        { op: "create_primitive", args: { shape: "ellipse", name: "Dot" } },
        { op: "create_layer", args: { type: "duplicator" } },
        { op: "connect", args: { fromLayerId: "$0", toLayerId: "$1.id", toAttrId: "shapes" } },
        { op: "rename_layer", args: { layerId: "$0", name: "Dot source" } },
      ],
    });
    expect(res.ok).toBe(true);
    expect(api.connections).toEqual([{ from: "basicShape#1", fromAttr: "id", to: "duplicator#1", toAttr: "shapes" }]);
    expect(api.getNiceName("basicShape#1")).toBe("Dot source");
  });

  it("rejects forward or unresolvable batch references", () => {
    expect(post("batch", { operations: [{ op: "rename_layer", args: { layerId: "$1", name: "x" } }] }).error).toMatch(
      /has not run yet/,
    );
    expect(
      post("batch", {
        operations: [
          { op: "create_primitive", args: { shape: "ellipse" } },
          { op: "rename_layer", args: { layerId: "$0.nope", name: "x" } },
        ],
      }).error,
    ).toMatch(/could not be resolved/);
  });

  it("treats hostile strings as plain data, never as code", () => {
    const payloads = ["`${api.deleteLayer('x')}`", '"); api.newScene(); ("', "</script><script>", "a\u2028b\u2029c"];
    for (const name of payloads) {
      const res = post("create_primitive", { shape: "ellipse", name });
      expect(res.ok).toBe(true);
      expect((res.result as { name: string }).name).toBe(name);
    }
  });

  it("counts processed requests in the snapshot", () => {
    post("ping", {}, "a");
    post("nope", {}, "b");
    expect(JSON.parse(bridge.snapshot()).processed).toBe(2);
  });
});
