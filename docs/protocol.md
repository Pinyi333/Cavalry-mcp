# Bridge Protocol (v1)

This document specifies how the `cavalry-mcp` server talks to `bridge/cavalry-mcp-bridge.js` running inside Cavalry.
You only need it if you are writing another client for the bridge or changing the protocol.

## Transport

The bridge uses Cavalry's built-in [`api.WebServer`](https://cavalry.studio/docs/tech-info/scripting/web-apis/), which has two fixed endpoints:

| Endpoint     | Direction        | Notes                                                                                  |
| ------------ | ---------------- | -------------------------------------------------------------------------------------- |
| `POST /post` | client → Cavalry | Body is queued by Cavalry. Text only (no binary). The HTTP response carries no result. |
| `GET /get`   | Cavalry → client | Returns the last text set with `setResultForGet()`. `text/plain` only.                 |

The bridge registers a callback object and calls `setRealtime()`, so Cavalry drains the `/post` queue about 60 times per second.
Callbacks only run while Cavalry is in the foreground and not blocked.

## Request

`POST /post` with a JSON body:

```json
{ "id": "1f0e2c1a-…", "op": "create_primitive", "args": { "shape": "ellipse", "name": "Dot" } }
```

| Field  | Type   | Description                                                                      |
| ------ | ------ | -------------------------------------------------------------------------------- |
| `id`   | string | Unique per request (the server uses UUIDv4). Requests without an id are ignored. |
| `op`   | string | Operation name, see the `ops` table in the bridge.                               |
| `args` | object | Operation arguments. Defaults to `{}`.                                           |

## Response

After processing, the bridge republishes a snapshot for `GET /get`:

```json
{
  "bridge": "cavalry-mcp",
  "bridgeVersion": "0.1.0",
  "protocol": 1,
  "processed": 42,
  "results": {
    "1f0e2c1a-…": {
      "ok": true,
      "result": { "id": "basicShape#1", "name": "Dot", "type": "basicShape", "parent": null }
    },
    "9b77…": { "ok": false, "error": "Layer 'x#1' does not exist." }
  }
}
```

- `processed` counts every request the bridge has handled. If it stops increasing while a request is pending, Cavalry
  is not running callbacks (backgrounded or blocked), and the client can fail fast instead of waiting for the timeout.
- `results` keeps the most recent `CONFIG.maxResults` entries (default 64), oldest evicted first.
- Clients poll `/get` until their `id` appears, then stop. A client must not assume ordering between different ids.
- `bridge` must equal `"cavalry-mcp"` and `protocol` must equal the client's protocol version. Otherwise the client
  should refuse to continue.

## Operations

| `op`                     | Required args                                                          | Optional args                                       |
| ------------------------ | ---------------------------------------------------------------------- | --------------------------------------------------- |
| `ping`                   | —                                                                      | —                                                   |
| `scene_info`             | —                                                                      | —                                                   |
| `list_layers`            | —                                                                      | `topLevel`, `type`                                  |
| `get_selection`          | —                                                                      | —                                                   |
| `select`                 | `layerIds`                                                             | —                                                   |
| `create_layer`           | `type`                                                                 | `name`, `attributes`                                |
| `create_primitive`       | `shape`                                                                | `name`, `attributes`                                |
| `delete_layers`          | `layerIds`                                                             | —                                                   |
| `duplicate_layer`        | `layerId`                                                              | `withInputConnections`                              |
| `rename_layer`           | `layerId`, `name`                                                      | —                                                   |
| `set_parent`             | `layerId`, `parentId` (string or null)                                 | —                                                   |
| `set_attributes`         | `layerId`, `attributes`                                                | `skipValidation`                                    |
| `get_attributes`         | `layerId`, `attrIds`                                                   | —                                                   |
| `list_attributes`        | `layerId`                                                              | `includeTypes`, `includeValues`                     |
| `get_bounding_box`       | `layerId`                                                              | `worldSpace` (default true)                         |
| `inspect_connections`    | `layerId`                                                              | —                                                   |
| `add_dynamic_attribute`  | `layerId`, `type`                                                      | `attrId` (default `array`)                          |
| `set_generator`          | `layerId`, `type`                                                      | `attrId` (default `generator`)                      |
| `connect` / `disconnect` | `fromLayerId`, `toLayerId`, `toAttrId`                                 | `fromAttrId` (default `id`), `force` (connect only) |
| `set_keyframes`          | `layerId`, `keyframes[]` (`frame`, `values`, `easing?`, `expression?`) | —                                                   |
| `delete_keyframes`       | `layerId`, `attrId`                                                    | `frames` (omit to delete all animation)             |
| `set_expression`         | `layerId`, `attrId`, `expression`                                      | —                                                   |
| `set_frame`              | `frame`                                                                | —                                                   |
| `playback`               | `action` (`play`/`stop`)                                               | —                                                   |
| `render_png`             | `filePath`                                                             | `frame`, `scalePercent`                             |
| `save_scene`             | —                                                                      | `filePath`                                          |
| `open_scene`             | `filePath`                                                             | `force`                                             |
| `run_script`             | `code`                                                                 | — (requires `CONFIG.allowScript = true`)            |
| `batch`                  | `operations[]` (`op`, `args`)                                          | — (no nesting, fail-fast, not atomic)               |

### Attribute validation

`create_layer`, `create_primitive`, `set_attributes` and `set_keyframes` reject attribute paths that do not exist on the
layer, because Cavalry silently ignores such writes. A path passes if either the full path (`position.x`) or its root
(`position`) exists. `set_attributes` accepts `skipValidation: true` as an escape hatch.

### Batch references

Inside `batch`, any string argument of the form `$<index>[.<key>…]` is replaced by a value from the result of an
earlier operation. `$0` is shorthand for `$0.id`. Referencing an operation that has not run yet, or a missing key, fails
the batch.

## Versioning

`protocol` is bumped whenever a request or response shape changes incompatibly. Adding a new operation or a new optional
argument does not bump it. The server and bridge from the same release always match.
