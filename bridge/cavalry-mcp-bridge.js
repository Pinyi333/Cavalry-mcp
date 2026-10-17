/**
 * Cavalry MCP Bridge
 * ------------------
 * Runs inside Cavalry (Window > Scripts) and exposes a small, typed command
 * set over Cavalry's built-in api.WebServer so that the cavalry-mcp server
 * (and therefore an AI assistant such as Claude) can drive the app.
 *
 * Protocol (v1)
 *   POST /post   body: {"id": "<uuid>", "op": "<operation>", "args": {...}}
 *   GET  /get    body: {"bridge": "cavalry-mcp", "protocol": 1, "results": {"<uuid>": {...}}}
 *
 * Cavalry's WebServer cannot answer a POST directly, so the caller posts a
 * request and then polls /get until its request id appears in `results`.
 *
 * https://github.com/Pinyi333/cavalry-mcp — MIT License
 */

// ---------------------------------------------------------------------------
// Configuration — edit these values if needed, then re-run the script.
// ---------------------------------------------------------------------------
var CONFIG = {
  // Keep this on the loopback interface. Never expose the bridge to a network.
  host: "127.0.0.1",
  // Must match CAVALRY_MCP_PORT on the MCP server side.
  port: 37650,
  // Allow the `run_script` operation (arbitrary JavaScript inside Cavalry).
  // Off by default: any local process that can reach the port could use it.
  allowScript: false,
  // How many recent results are kept for callers to collect.
  maxResults: 64,
};

var CavalryMcpBridge = (function () {
  var BRIDGE_NAME = "cavalry-mcp";
  var BRIDGE_VERSION = "0.1.0";
  var PROTOCOL_VERSION = 1;
  var COMP_SETTING_CANDIDATES = ["resolution", "startFrame", "endFrame", "fps", "backgroundColor"];
  var BATCH_REFERENCE = /^\$(\d+)((?:\.[A-Za-z0-9_]+)*)$/;

  var results = {};
  var processed = 0;
  var resultOrder = [];

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  function fail(message) {
    throw new Error(message);
  }

  function requireString(args, key) {
    var value = args[key];
    if (typeof value !== "string" || value.length === 0) {
      fail("'" + key + "' must be a non-empty string.");
    }
    return value;
  }

  function requireNumber(args, key) {
    var value = args[key];
    if (typeof value !== "number" || !isFinite(value)) {
      fail("'" + key + "' must be a number.");
    }
    return value;
  }

  function requireObject(args, key) {
    var value = args[key];
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      fail("'" + key + "' must be an object.");
    }
    return value;
  }

  function requireStringArray(args, key) {
    var value = args[key];
    if (!Array.isArray(value)) {
      fail("'" + key + "' must be an array of strings.");
    }
    for (var i = 0; i < value.length; i++) {
      if (typeof value[i] !== "string") {
        fail("'" + key + "' must be an array of strings.");
      }
    }
    return value;
  }

  function requireLayer(layerId) {
    if (!api.layerExists(layerId)) {
      fail("Layer '" + layerId + "' does not exist.");
    }
    return layerId;
  }

  function describeLayer(layerId) {
    var parent = api.getParent(layerId);
    return {
      id: layerId,
      name: api.getNiceName(layerId),
      type: api.getLayerType(layerId),
      parent: parent ? parent : null,
    };
  }

  /**
   * Cavalry silently ignores writes to attribute paths that do not exist, so
   * check every path first. Child paths such as "position.x" are accepted when
   * either the full path or its root attribute exists.
   */
  function requireAttributes(layerId, attributes) {
    Object.keys(attributes).forEach(function (attrId) {
      var root = attrId.split(".")[0];
      if (!api.hasAttribute(layerId, attrId) && !api.hasAttribute(layerId, root)) {
        fail(
          "Layer '" +
            layerId +
            "' has no attribute '" +
            attrId +
            "'. Call list_attributes to see valid attribute paths.",
        );
      }
    });
    return attributes;
  }

  function applyAttributes(layerId, args) {
    if (args.attributes) {
      api.set(layerId, requireAttributes(layerId, requireObject(args, "attributes")));
    }
  }

  /** Replaces "$<index>[.path]" strings with values from earlier batch results ("$0" means "$0.id"). */
  function resolveReferences(value, previous) {
    if (typeof value === "string") {
      var match = BATCH_REFERENCE.exec(value);
      if (!match) return value;
      var index = Number(match[1]);
      if (index >= previous.length) {
        fail("Reference '" + value + "' points at an operation that has not run yet.");
      }
      var path = match[2] ? match[2].slice(1).split(".") : ["id"];
      var resolved = previous[index];
      for (var i = 0; i < path.length; i++) {
        if (resolved === null || typeof resolved !== "object" || !(path[i] in resolved)) {
          fail("Reference '" + value + "' could not be resolved.");
        }
        resolved = resolved[path[i]];
      }
      return resolved;
    }
    if (Array.isArray(value)) {
      return value.map(function (item) {
        return resolveReferences(item, previous);
      });
    }
    if (value !== null && typeof value === "object") {
      var out = {};
      Object.keys(value).forEach(function (key) {
        out[key] = resolveReferences(value[key], previous);
      });
      return out;
    }
    return value;
  }

  function stripPngExtension(filePath) {
    return /\.png$/i.test(filePath) ? filePath.slice(0, -4) : filePath;
  }

  // -------------------------------------------------------------------------
  // Operations
  // -------------------------------------------------------------------------

  var ops = {
    ping: function () {
      return {
        bridge: BRIDGE_NAME,
        bridgeVersion: BRIDGE_VERSION,
        protocol: PROTOCOL_VERSION,
        cavalryVersion: api.getCavalryVersion(),
        platform: api.getPlatform(),
        allowScript: CONFIG.allowScript === true,
      };
    },

    scene_info: function () {
      var activeComp = api.getActiveComp();
      var comps = api.getComps().map(function (compId) {
        return { id: compId, name: api.getNiceName(compId) };
      });
      var settings = {};
      if (activeComp) {
        COMP_SETTING_CANDIDATES.forEach(function (attrId) {
          if (api.hasAttribute(activeComp, attrId)) {
            settings[attrId] = api.get(activeComp, attrId);
          }
        });
      }
      return {
        cavalryVersion: api.getCavalryVersion(),
        sceneFilePath: api.getSceneFilePath() || null,
        hasUnsavedChanges: api.sceneHasUnsavedChanges(),
        frame: api.getFrame(),
        activeComp: activeComp || null,
        activeCompSettings: settings,
        comps: comps,
      };
    },

    list_layers: function (args) {
      var topLevel = args.topLevel === true;
      var ids =
        typeof args.type === "string" && args.type.length > 0
          ? api.getCompLayersOfType(topLevel, args.type)
          : api.getCompLayers(topLevel);
      return { layers: ids.map(describeLayer) };
    },

    get_selection: function () {
      return { layers: api.getSelection(true).map(describeLayer) };
    },

    select: function (args) {
      var ids = requireStringArray(args, "layerIds");
      ids.forEach(requireLayer);
      api.select(ids);
      return { selected: ids };
    },

    create_layer: function (args) {
      var type = requireString(args, "type");
      var name = typeof args.name === "string" ? args.name : "";
      var layerId = api.create(type, name);
      if (!layerId || !api.layerExists(layerId)) {
        fail("Cavalry could not create a layer of type '" + type + "'.");
      }
      applyAttributes(layerId, args);
      return describeLayer(layerId);
    },

    create_primitive: function (args) {
      var shape = requireString(args, "shape");
      var name = typeof args.name === "string" ? args.name : "";
      var layerId = api.primitive(shape, name);
      if (!layerId || !api.layerExists(layerId)) {
        fail("Cavalry could not create a primitive of shape '" + shape + "'.");
      }
      applyAttributes(layerId, args);
      return describeLayer(layerId);
    },

    delete_layers: function (args) {
      var ids = requireStringArray(args, "layerIds");
      var deleted = [];
      var missing = [];
      ids.forEach(function (layerId) {
        if (api.layerExists(layerId)) {
          api.deleteLayer(layerId);
          deleted.push(layerId);
        } else {
          missing.push(layerId);
        }
      });
      return { deleted: deleted, missing: missing };
    },

    duplicate_layer: function (args) {
      var layerId = requireLayer(requireString(args, "layerId"));
      var before = {};
      api.getCompLayers(false).forEach(function (id) {
        before[id] = true;
      });
      api.duplicate(layerId, args.withInputConnections === true);
      var created = api.getCompLayers(false).filter(function (id) {
        return !before[id];
      });
      return { source: layerId, created: created.map(describeLayer) };
    },

    rename_layer: function (args) {
      var layerId = requireLayer(requireString(args, "layerId"));
      api.rename(layerId, requireString(args, "name"));
      return describeLayer(layerId);
    },

    set_parent: function (args) {
      var layerId = requireLayer(requireString(args, "layerId"));
      if (args.parentId === null || args.parentId === undefined) {
        api.unParent(layerId);
      } else {
        api.parent(layerId, requireLayer(requireString(args, "parentId")));
      }
      return describeLayer(layerId);
    },

    set_attributes: function (args) {
      var layerId = requireLayer(requireString(args, "layerId"));
      var attributes = requireObject(args, "attributes");
      if (args.skipValidation !== true) requireAttributes(layerId, attributes);
      api.set(layerId, attributes);
      return { layerId: layerId, updated: Object.keys(attributes) };
    },

    get_attributes: function (args) {
      var layerId = requireLayer(requireString(args, "layerId"));
      var attrIds = requireStringArray(args, "attrIds");
      var values = {};
      attrIds.forEach(function (attrId) {
        if (!api.hasAttribute(layerId, attrId)) {
          fail("Layer '" + layerId + "' has no attribute '" + attrId + "'.");
        }
        values[attrId] = api.get(layerId, attrId);
      });
      return { layerId: layerId, values: values };
    },

    list_attributes: function (args) {
      var layerId = requireLayer(requireString(args, "layerId"));
      var attrIds = api.getAttributes(layerId);
      if (args.includeTypes !== true && args.includeValues !== true) {
        return { layerId: layerId, attributes: attrIds };
      }
      return {
        layerId: layerId,
        attributes: attrIds.map(function (attrId) {
          var entry = { id: attrId };
          if (args.includeTypes === true) entry.type = api.getAttrType(layerId, attrId);
          if (args.includeValues === true) entry.value = api.get(layerId, attrId);
          return entry;
        }),
      };
    },

    get_bounding_box: function (args) {
      var layerId = requireLayer(requireString(args, "layerId"));
      return { layerId: layerId, boundingBox: api.getBoundingBox(layerId, args.worldSpace !== false) };
    },

    inspect_connections: function (args) {
      var layerId = requireLayer(requireString(args, "layerId"));
      var inputs = api.getInConnectedAttributes(layerId).map(function (attrId) {
        return { attrId: attrId, from: api.getInConnection(layerId, attrId) };
      });
      var outputs = api.getOutConnectedAttributes(layerId).map(function (attrId) {
        return { attrId: attrId, to: api.getOutConnections(layerId, attrId) };
      });
      return { layerId: layerId, inputs: inputs, outputs: outputs };
    },

    add_dynamic_attribute: function (args) {
      var layerId = requireLayer(requireString(args, "layerId"));
      var attrId = typeof args.attrId === "string" ? args.attrId : "array";
      var type = requireString(args, "type");
      api.addDynamic(layerId, attrId, type);
      return { layerId: layerId, attrId: attrId, type: type, arrayCount: api.getArrayCount(layerId, attrId) };
    },

    set_generator: function (args) {
      var layerId = requireLayer(requireString(args, "layerId"));
      var attrId = typeof args.attrId === "string" ? args.attrId : "generator";
      var type = requireString(args, "type");
      api.setGenerator(layerId, attrId, type);
      return { layerId: layerId, attrId: attrId, generator: type };
    },

    connect: function (args) {
      var fromId = requireLayer(requireString(args, "fromLayerId"));
      var fromAttr = typeof args.fromAttrId === "string" ? args.fromAttrId : "id";
      var toId = requireLayer(requireString(args, "toLayerId"));
      var toAttr = requireString(args, "toAttrId");
      api.connect(fromId, fromAttr, toId, toAttr, args.force === true);
      return { from: fromId + "." + fromAttr, to: toId + "." + toAttr };
    },

    disconnect: function (args) {
      var fromId = requireLayer(requireString(args, "fromLayerId"));
      var fromAttr = typeof args.fromAttrId === "string" ? args.fromAttrId : "id";
      var toId = requireLayer(requireString(args, "toLayerId"));
      var toAttr = requireString(args, "toAttrId");
      api.disconnect(fromId, fromAttr, toId, toAttr);
      return { from: fromId + "." + fromAttr, to: toId + "." + toAttr };
    },

    set_keyframes: function (args) {
      var layerId = requireLayer(requireString(args, "layerId"));
      var keyframes = args.keyframes;
      if (!Array.isArray(keyframes) || keyframes.length === 0) {
        fail("'keyframes' must be a non-empty array.");
      }
      var created = keyframes.map(function (kf) {
        var frame = requireNumber(kf, "frame");
        var values = requireAttributes(layerId, requireObject(kf, "values"));
        var keyframeId = api.keyframe(layerId, frame, values);
        if (typeof kf.easing === "string" && kf.easing.length > 0) {
          var expression = typeof kf.expression === "string" ? kf.expression : "";
          Object.keys(values).forEach(function (attrId) {
            api.magicEasing(layerId, attrId, frame, kf.easing, expression);
          });
        }
        return { frame: frame, attributes: Object.keys(values), keyframeId: keyframeId };
      });
      return { layerId: layerId, keyframes: created };
    },

    delete_keyframes: function (args) {
      var layerId = requireLayer(requireString(args, "layerId"));
      var attrId = requireString(args, "attrId");
      if (!Array.isArray(args.frames)) {
        api.deleteAnimation(layerId, attrId);
        return { layerId: layerId, attrId: attrId, deleted: "all" };
      }
      args.frames.forEach(function (frame) {
        api.deleteKeyframe(layerId, attrId, frame);
      });
      return { layerId: layerId, attrId: attrId, deleted: args.frames };
    },

    set_expression: function (args) {
      var layerId = requireLayer(requireString(args, "layerId"));
      var attrId = requireString(args, "attrId");
      var expression = typeof args.expression === "string" ? args.expression : "";
      api.setAttributeExpression(layerId, attrId, expression);
      return { layerId: layerId, attrId: attrId, expression: expression };
    },

    set_frame: function (args) {
      api.setFrame(Math.round(requireNumber(args, "frame")));
      return { frame: api.getFrame() };
    },

    playback: function (args) {
      var action = requireString(args, "action");
      if (action === "play") {
        api.play();
      } else if (action === "stop") {
        api.stop();
      } else {
        fail("'action' must be 'play' or 'stop'.");
      }
      return { action: action, frame: api.getFrame() };
    },

    render_png: function (args) {
      var base = stripPngExtension(requireString(args, "filePath"));
      var scale = typeof args.scalePercent === "number" ? args.scalePercent : 100;
      if (typeof args.frame === "number") {
        api.setFrame(Math.round(args.frame));
      }
      api.renderPNGFrame(base, scale);
      return { filePath: base + ".png", frame: api.getFrame(), scalePercent: scale };
    },

    save_scene: function (args) {
      var ok;
      if (typeof args.filePath === "string" && args.filePath.length > 0) {
        ok = api.saveSceneAs(args.filePath);
      } else {
        if (!api.getSceneFilePath()) {
          fail("The scene has never been saved. Provide 'filePath' to save it.");
        }
        ok = api.saveScene();
      }
      if (!ok) {
        fail("Cavalry reported that the scene could not be saved.");
      }
      return { sceneFilePath: api.getSceneFilePath() };
    },

    open_scene: function (args) {
      var filePath = requireString(args, "filePath");
      if (!api.filePathExists(filePath)) {
        fail("File '" + filePath + "' does not exist.");
      }
      api.openScene(filePath, args.force === true);
      return { sceneFilePath: api.getSceneFilePath() };
    },

    run_script: function (args) {
      if (CONFIG.allowScript !== true) {
        fail(
          "run_script is disabled in the bridge. Set CONFIG.allowScript = true in " +
            "cavalry-mcp-bridge.js and restart the bridge to enable it.",
        );
      }
      var code = requireString(args, "code");
      // The script body receives `api` and may `return` a JSON-serialisable value.
      var value = new Function("api", code)(api);
      return { value: value === undefined ? null : value };
    },

    batch: function (args) {
      var operations = args.operations;
      if (!Array.isArray(operations) || operations.length === 0) {
        fail("'operations' must be a non-empty array.");
      }
      var out = [];
      for (var i = 0; i < operations.length; i++) {
        var item = operations[i] || {};
        if (item.op === "batch") {
          fail("Nested batch operations are not allowed (operation " + i + ").");
        }
        try {
          out.push(execute(item.op, resolveReferences(item.args || {}, out)));
        } catch (err) {
          fail("Operation " + i + " (" + item.op + ") failed: " + messageOf(err));
        }
      }
      return { results: out };
    },
  };

  // -------------------------------------------------------------------------
  // Dispatch
  // -------------------------------------------------------------------------

  function messageOf(err) {
    return err && err.message ? err.message : String(err);
  }

  function execute(op, args) {
    if (typeof op !== "string" || !Object.prototype.hasOwnProperty.call(ops, op)) {
      fail("Unknown operation '" + op + "'.");
    }
    if (args === null || typeof args !== "object" || Array.isArray(args)) {
      fail("'args' must be an object.");
    }
    return ops[op](args);
  }

  function storeResult(id, payload) {
    if (!Object.prototype.hasOwnProperty.call(results, id)) {
      resultOrder.push(id);
    }
    results[id] = payload;
    while (resultOrder.length > CONFIG.maxResults) {
      delete results[resultOrder.shift()];
    }
  }

  /** Handles one raw /post body. Returns the stored result (or null if unaddressable). */
  function handlePost(rawBody) {
    var request;
    try {
      request = JSON.parse(rawBody);
    } catch (err) {
      console.log("[cavalry-mcp] Ignored a non-JSON request: " + messageOf(err));
      return null;
    }
    if (!request || typeof request.id !== "string" || request.id.length === 0) {
      console.log("[cavalry-mcp] Ignored a request without an id.");
      return null;
    }
    var payload;
    try {
      payload = { ok: true, result: execute(request.op, request.args || {}) };
    } catch (err) {
      payload = { ok: false, error: messageOf(err) };
    }
    processed += 1;
    storeResult(request.id, payload);
    return payload;
  }

  function snapshot() {
    return JSON.stringify({
      bridge: BRIDGE_NAME,
      bridgeVersion: BRIDGE_VERSION,
      protocol: PROTOCOL_VERSION,
      processed: processed,
      results: results,
    });
  }

  return {
    version: BRIDGE_VERSION,
    protocol: PROTOCOL_VERSION,
    ops: ops,
    execute: execute,
    handlePost: handlePost,
    snapshot: snapshot,
  };
})();

// ---------------------------------------------------------------------------
// Cavalry UI + WebServer wiring (skipped when the file is loaded by tests)
// ---------------------------------------------------------------------------
if (typeof ui !== "undefined" && typeof api !== "undefined" && api.WebServer) {
  (function () {
    var server = new api.WebServer();
    var status = new ui.Label("Stopped");
    var toggle = new ui.Button("Start Bridge");

    function drain() {
      while (server.postCount() > 0) {
        var post = server.getNextPost();
        CavalryMcpBridge.handlePost(post.result);
      }
      server.setResultForGet(CavalryMcpBridge.snapshot());
    }

    function start() {
      server.listen(CONFIG.host, CONFIG.port);
      server.setResultForGet(CavalryMcpBridge.snapshot());
      server.addCallbackObject({ onPost: drain });
      server.setRealtime();
      toggle.setText("Stop Bridge");
      status.setText("Listening on " + CONFIG.host + ":" + CONFIG.port);
      console.log(
        "[cavalry-mcp] Bridge v" + CavalryMcpBridge.version + " listening on " + CONFIG.host + ":" + CONFIG.port,
      );
    }

    function stop() {
      server.stop();
      toggle.setText("Start Bridge");
      status.setText("Stopped");
      console.log("[cavalry-mcp] Bridge stopped.");
    }

    toggle.onClick = function () {
      if (server.isRunning()) {
        stop();
      } else {
        start();
      }
    };

    ui.onClose = function () {
      if (server.isRunning()) {
        stop();
      }
    };

    ui.setTitle("Cavalry MCP Bridge");
    ui.add(status);
    ui.add(toggle);
    ui.show();
    start();
  })();
}
