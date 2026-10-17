import { z } from "zod";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

/**
 * Declarative tool catalogue. Each entry maps one MCP tool onto one bridge
 * operation (`op`) implemented in bridge/cavalry-mcp-bridge.js.
 */
export interface ToolDefinition {
  name: string;
  title: string;
  description: string;
  op: string;
  inputSchema: z.ZodRawShape;
  annotations: ToolAnnotations;
  /** Only registered when CAVALRY_MCP_ALLOW_SCRIPT is enabled. */
  requiresScript?: boolean;
  /** May block Cavalry for a long time, so frozen detection is skipped (only the timeout applies). */
  longRunning?: boolean;
}

const layerId = z
  .string()
  .min(1)
  .describe('Cavalry layer id, e.g. "basicShape#1". Use cavalry_list_layers to find ids.');
const layerIds = z.array(z.string().min(1)).min(1).describe("One or more Cavalry layer ids.");
const attrId = z.string().min(1).describe('Attribute path, e.g. "position.x", "rotation", "material.materialColor".');
const attributeValues = z
  .record(z.string(), z.unknown())
  .describe(
    'Map of attribute path to value, e.g. {"position": [100, 200], "rotation.z": 45, "material.materialColor": "#ff4d00"}.',
  );

const READ_ONLY: ToolAnnotations = { readOnlyHint: true, openWorldHint: false };
const EDIT: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};
const CREATE: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
};
const DESTRUCTIVE: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: false,
};

export const MAGIC_EASINGS = [
  "SlowIn",
  "SlowOut",
  "SlowInSlowOut",
  "VerySlowIn",
  "VerySlowOut",
  "VerySlowInVerySlowOut",
  "SpringIn",
  "SpringOut",
  "SpringInSpringOut",
  "SmallSpringIn",
  "SmallSpringOut",
  "SmallSpringInSmallSpringOut",
  "AnticipateIn",
  "OvershootOut",
  "AnticipateInOvershootOut",
  "BounceIn",
  "BounceOut",
  "BounceInBounceOut",
  "Custom",
  "None",
] as const;

const BATCHABLE_OPS = [
  "scene_info",
  "list_layers",
  "get_selection",
  "select",
  "create_layer",
  "create_primitive",
  "delete_layers",
  "duplicate_layer",
  "rename_layer",
  "set_parent",
  "set_attributes",
  "get_attributes",
  "list_attributes",
  "get_bounding_box",
  "inspect_connections",
  "add_dynamic_attribute",
  "set_generator",
  "connect",
  "disconnect",
  "set_keyframes",
  "delete_keyframes",
  "set_expression",
  "set_frame",
] as const;

export const TOOLS: ToolDefinition[] = [
  // --- Session & scene -----------------------------------------------------
  {
    name: "cavalry_ping",
    title: "Ping Cavalry",
    description: "Check that Cavalry is running and the bridge is reachable. Returns bridge and Cavalry versions.",
    op: "ping",
    inputSchema: {},
    annotations: READ_ONLY,
  },
  {
    name: "cavalry_scene_info",
    title: "Scene info",
    description:
      "Describe the open scene: file path, unsaved state, current frame, compositions, and the active composition's " +
      "resolution / frame range / fps when available. Call this first to orient yourself.",
    op: "scene_info",
    inputSchema: {},
    annotations: READ_ONLY,
  },
  {
    name: "cavalry_set_frame",
    title: "Set frame",
    description: "Move the playhead of the active composition to a frame.",
    op: "set_frame",
    inputSchema: { frame: z.number().int().describe("Target frame number.") },
    annotations: EDIT,
  },
  {
    name: "cavalry_playback",
    title: "Play / stop",
    description: "Start or stop playback in the viewport.",
    op: "playback",
    inputSchema: { action: z.enum(["play", "stop"]) },
    annotations: EDIT,
  },

  // --- Layers --------------------------------------------------------------
  {
    name: "cavalry_list_layers",
    title: "List layers",
    description: "List layers in the active composition with their id, name, type and parent.",
    op: "list_layers",
    inputSchema: {
      topLevel: z.boolean().optional().describe("Only return top-level layers. Defaults to false."),
      type: z.string().optional().describe('Only return layers of this type, e.g. "basicShape", "textShape", "group".'),
    },
    annotations: READ_ONLY,
  },
  {
    name: "cavalry_get_selection",
    title: "Get selection",
    description: "Return the layers currently selected in Cavalry, in hierarchy order.",
    op: "get_selection",
    inputSchema: {},
    annotations: READ_ONLY,
  },
  {
    name: "cavalry_select",
    title: "Select layers",
    description: "Replace the current selection with the given layers.",
    op: "select",
    inputSchema: { layerIds },
    annotations: EDIT,
  },
  {
    name: "cavalry_create_primitive",
    title: "Create primitive shape",
    description:
      'Create a primitive shape layer (e.g. "rectangle", "ellipse", "star", "polygon") and optionally set attributes ' +
      'in the same call, e.g. {"generator.dimensions": [400, 200], "position": [0, 0], "material.materialColor": "#00c2ff"}.',
    op: "create_primitive",
    inputSchema: {
      shape: z.string().min(1).describe('Primitive type, e.g. "rectangle", "ellipse", "star", "polygon".'),
      name: z.string().optional().describe("Display name in the Scene Window."),
      attributes: attributeValues.optional(),
    },
    annotations: CREATE,
  },
  {
    name: "cavalry_create_layer",
    title: "Create layer",
    description:
      'Create a layer of any Cavalry type (e.g. "null", "group", "textShape", "duplicator", "colorMaterial", ' +
      '"javaScript") and optionally set attributes in the same call.',
    op: "create_layer",
    inputSchema: {
      type: z.string().min(1).describe('Cavalry layer type id, e.g. "textShape", "duplicator", "null".'),
      name: z.string().optional().describe("Display name in the Scene Window."),
      attributes: attributeValues.optional(),
    },
    annotations: CREATE,
  },
  {
    name: "cavalry_duplicate_layer",
    title: "Duplicate layer",
    description: "Duplicate a layer. Returns the ids of the newly created layers.",
    op: "duplicate_layer",
    inputSchema: {
      layerId,
      withInputConnections: z.boolean().optional().describe("Also duplicate input connections. Defaults to false."),
    },
    annotations: CREATE,
  },
  {
    name: "cavalry_rename_layer",
    title: "Rename layer",
    description: "Change a layer's display name.",
    op: "rename_layer",
    inputSchema: { layerId, name: z.string().min(1) },
    annotations: EDIT,
  },
  {
    name: "cavalry_set_parent",
    title: "Set parent",
    description: "Parent a layer under another layer (e.g. a group), or pass parentId null to un-parent it.",
    op: "set_parent",
    inputSchema: {
      layerId,
      parentId: z.string().min(1).nullable().describe("New parent layer id, or null to move to the top level."),
    },
    annotations: EDIT,
  },
  {
    name: "cavalry_delete_layers",
    title: "Delete layers",
    description: "Delete one or more layers. Ids that do not exist are reported back instead of failing.",
    op: "delete_layers",
    inputSchema: { layerIds },
    annotations: DESTRUCTIVE,
  },

  // --- Attributes ----------------------------------------------------------
  {
    name: "cavalry_list_attributes",
    title: "List attributes",
    description: "List every attribute path available on a layer, optionally with data types.",
    op: "list_attributes",
    inputSchema: {
      layerId,
      includeTypes: z.boolean().optional().describe("Include each attribute's data type. Defaults to false."),
      includeValues: z.boolean().optional().describe("Include each attribute's current value. Defaults to false."),
    },
    annotations: READ_ONLY,
  },
  {
    name: "cavalry_get_attributes",
    title: "Get attributes",
    description: "Read the current values of one or more attributes on a layer.",
    op: "get_attributes",
    inputSchema: { layerId, attrIds: z.array(attrId).min(1) },
    annotations: READ_ONLY,
  },
  {
    name: "cavalry_set_attributes",
    title: "Set attributes",
    description:
      "Set one or more attribute values on a layer at the current frame (does not create keyframes). Every path is " +
      'checked first, because Cavalry silently ignores writes to unknown paths. In 2D, rotate with "rotation.z".',
    op: "set_attributes",
    inputSchema: {
      layerId,
      attributes: attributeValues,
      skipValidation: z
        .boolean()
        .optional()
        .describe("Skip the attribute-path check (only for paths the check wrongly rejects). Defaults to false."),
    },
    annotations: EDIT,
  },
  {
    name: "cavalry_get_bounding_box",
    title: "Get bounding box",
    description:
      "Return a layer's bounding box (x, y, width, height, centre, left/right/top/bottom). Use it to lay out, align " +
      "and check that layers fit inside the composition.",
    op: "get_bounding_box",
    inputSchema: {
      layerId,
      worldSpace: z.boolean().optional().describe("World-space coordinates. Defaults to true."),
    },
    annotations: READ_ONLY,
  },
  {
    name: "cavalry_inspect_connections",
    title: "Inspect connections",
    description: "List a layer's incoming and outgoing attribute connections, to understand an existing node graph.",
    op: "inspect_connections",
    inputSchema: { layerId },
    annotations: READ_ONLY,
  },
  {
    name: "cavalry_add_dynamic_attribute",
    title: "Add dynamic attribute",
    description:
      "Add a dynamic attribute to layers that support them (e.g. JavaScript layers). Returns the new array count; " +
      "use cavalry_list_attributes to find the new attribute path.",
    op: "add_dynamic_attribute",
    inputSchema: {
      layerId,
      type: z.string().min(1).describe('Attribute type, e.g. "double", "int", "bool", "string", "double2", "color".'),
      attrId: z.string().optional().describe('Dynamic array attribute. Defaults to "array".'),
    },
    annotations: CREATE,
  },
  {
    name: "cavalry_set_generator",
    title: "Set generator",
    description:
      'Swap the generator on a layer, e.g. set a Duplicator\'s "generator" to "circleDistribution" or a Basic Shape\'s ' +
      'to "ellipse".',
    op: "set_generator",
    inputSchema: {
      layerId,
      type: z.string().min(1).describe('Generator type id, e.g. "circleDistribution", "gridDistribution".'),
      attrId: z.string().optional().describe('Generator attribute. Defaults to "generator".'),
    },
    annotations: EDIT,
  },
  {
    name: "cavalry_set_expression",
    title: "Set expression",
    description: "Set (or clear, with an empty string) a JavaScript expression on an attribute.",
    op: "set_expression",
    inputSchema: { layerId, attrId, expression: z.string() },
    annotations: EDIT,
  },
  {
    name: "cavalry_connect",
    title: "Connect attributes",
    description:
      'Connect an output to an input. A layer\'s main output is its "id" attribute, e.g. connect shape "id" -> ' +
      'duplicator "shapes", or colorMaterial "id" -> shape "material" with force=true.',
    op: "connect",
    inputSchema: {
      fromLayerId: layerId,
      fromAttrId: z.string().optional().describe('Source attribute. Defaults to "id" (the layer\'s output).'),
      toLayerId: layerId,
      toAttrId: attrId,
      force: z.boolean().optional().describe("Replace an existing input connection. Defaults to false."),
    },
    annotations: EDIT,
  },
  {
    name: "cavalry_disconnect",
    title: "Disconnect attributes",
    description: "Remove a connection between two attributes.",
    op: "disconnect",
    inputSchema: {
      fromLayerId: layerId,
      fromAttrId: z.string().optional().describe('Source attribute. Defaults to "id".'),
      toLayerId: layerId,
      toAttrId: attrId,
    },
    annotations: DESTRUCTIVE,
  },

  // --- Animation -----------------------------------------------------------
  {
    name: "cavalry_set_keyframes",
    title: "Set keyframes",
    description:
      "Create keyframes on a layer. Each keyframe sets one or more attribute values at a frame and can apply a Magic " +
      'Easing to the keyframes it creates. Example: [{"frame": 0, "values": {"position.x": -300}, "easing": "SlowOut"}, ' +
      '{"frame": 30, "values": {"position.x": 300}}].',
    op: "set_keyframes",
    inputSchema: {
      layerId,
      keyframes: z
        .array(
          z.object({
            frame: z.number().int(),
            values: attributeValues,
            easing: z.enum(MAGIC_EASINGS).optional().describe("Magic Easing applied to the keyframes at this frame."),
            expression: z
              .string()
              .optional()
              .describe('Custom easing expression in x, e.g. "1 - pow(1 - x, 5)". Requires easing "Custom".'),
          }),
        )
        .min(1),
    },
    annotations: EDIT,
  },
  {
    name: "cavalry_delete_keyframes",
    title: "Delete keyframes",
    description: "Delete keyframes on an attribute at specific frames, or all of its animation when frames is omitted.",
    op: "delete_keyframes",
    inputSchema: {
      layerId,
      attrId,
      frames: z.array(z.number().int()).optional().describe("Frames to delete. Omit to remove all animation."),
    },
    annotations: DESTRUCTIVE,
  },

  // --- Files & rendering ---------------------------------------------------
  {
    name: "cavalry_render_png",
    title: "Render PNG frame",
    description:
      "Render the active composition to a PNG file on the local machine (useful for checking your work visually). " +
      "Use an absolute path; the .png extension is added automatically.",
    op: "render_png",
    longRunning: true,
    inputSchema: {
      filePath: z.string().min(1).describe("Absolute output path, with or without .png."),
      frame: z.number().int().optional().describe("Frame to render. Defaults to the current frame."),
      scalePercent: z.number().positive().max(1000).optional().describe("Output scale in percent. Defaults to 100."),
    },
    annotations: CREATE,
  },
  {
    name: "cavalry_save_scene",
    title: "Save scene",
    description: "Save the scene in place, or to a new .cv path when filePath is given.",
    op: "save_scene",
    longRunning: true,
    inputSchema: {
      filePath: z.string().optional().describe("Absolute .cv path for Save As. Omit to save in place."),
    },
    annotations: EDIT,
  },
  {
    name: "cavalry_open_scene",
    title: "Open scene",
    description:
      "Open a .cv scene file. Unless force is true, Cavalry may ask the user about unsaved changes in the current scene.",
    op: "open_scene",
    longRunning: true,
    inputSchema: {
      filePath: z.string().min(1).describe("Absolute path to a .cv file."),
      force: z.boolean().optional().describe("Discard unsaved changes without asking. Defaults to false."),
    },
    annotations: DESTRUCTIVE,
  },

  // --- Advanced ------------------------------------------------------------
  {
    name: "cavalry_batch",
    title: "Batch operations",
    description:
      "Run several operations in one round-trip, in order. Stops at the first failure; earlier operations are NOT " +
      'rolled back. Each item is {"op": "<operation>", "args": {...}} where op is the tool name without the ' +
      '"cavalry_" prefix. Reference earlier results with "$<index>" strings: "$0" is the id created by operation 0, ' +
      '"$2.created.0.id" walks into a result. Example: [{"op": "create_primitive", "args": {"shape": "ellipse"}}, ' +
      '{"op": "set_keyframes", "args": {"layerId": "$0", "keyframes": [...]}}].',
    op: "batch",
    longRunning: true,
    inputSchema: {
      operations: z
        .array(
          z.object({
            op: z.enum(BATCHABLE_OPS),
            args: z.record(z.string(), z.unknown()).optional(),
          }),
        )
        .min(1)
        .max(200),
    },
    annotations: DESTRUCTIVE,
  },
  {
    name: "cavalry_run_script",
    title: "Run JavaScript",
    description:
      "Run arbitrary JavaScript inside Cavalry's JavaScript Editor context. The code receives `api` and may `return` " +
      "a JSON-serialisable value. Prefer the typed tools; use this only when none of them fits.",
    op: "run_script",
    longRunning: true,
    inputSchema: { code: z.string().min(1).describe("Function body to execute, e.g. 'return api.getComps();'.") },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    requiresScript: true,
  },
];
