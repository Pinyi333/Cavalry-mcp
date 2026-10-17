import { MAGIC_EASINGS } from "./tools.js";

/**
 * Reference served as the `cavalry://guide/attributes` MCP resource.
 * Paths come from the official Cavalry scripting docs and from paths verified by
 * the community (see README "Acknowledgements"). Always confirm with
 * cavalry_list_attributes when in doubt — layer versions can differ.
 */
export const ATTRIBUTE_GUIDE = `# Cavalry attribute & layer guide

Confirm paths with \`cavalry_list_attributes\` (optionally \`includeValues: true\`) before writing.
Cavalry silently ignores writes to paths that do not exist; this server rejects them up front.

## Common layer types (\`cavalry_create_layer\`)

| Type | What it is |
| --- | --- |
| \`basicShape\` | Shape driven by a generator (prefer \`cavalry_create_primitive\`) |
| \`textShape\` | Text |
| \`null\`, \`group\` | Containers / parents |
| \`duplicator\` | Copies connected shapes over a distribution |
| \`colorMaterial\` | Fill material; connect its \`id\` to a shape's \`material\` |
| \`linearGradient\` | Gradient shader |
| \`noiseDeformer\`, \`stagger\`, \`trail\`, \`oscillator\` | Behaviours and deformers |
| \`connectShape\`, \`pathfinder\` | Path utilities |
| \`javaScript\`, \`javaScriptShape\` | Scripted layers (support dynamic attributes) |
| \`colorPlane\` | Solid background plane |

Primitive shapes (\`cavalry_create_primitive\`): \`rectangle\`, \`ellipse\`, \`star\`, \`polygon\`.

## Transform

| Path | Type | Notes |
| --- | --- | --- |
| \`position.x\`, \`position.y\` | number | Origin is the composition centre; +y is up |
| \`scale.x\`, \`scale.y\` | number | 1.0 = 100%. Preferred way to resize |
| \`rotation.z\` | number | Degrees. \`rotation\` is a 3D vector, so use \`.z\` in 2D |
| \`opacity\` | number | 0–100 |
| \`hidden\` | boolean | Hide the layer |

## Appearance

| Path | Type | Notes |
| --- | --- | --- |
| \`material.materialColor\` | string | Hex colour, e.g. \`#ff4d00\` |
| \`generator.dimensions\` | [w, h] | Rectangle size. If a write has no effect in your version, use \`scale\` |
| \`generator.radius\` | [x, y] or number | Ellipse radii / star radius |

## Duplicator

| Path | Notes |
| --- | --- |
| \`generator.count\` | Number of copies |
| \`generator.radius\` | Radius of a \`circleDistribution\` |
| \`generator.startAngle\`, \`generator.angle\` | Arc controls |
| \`shapeScale.x\`, \`shapeScale.y\` | Scale of each copy (copies ignore the source's \`scale\`) |
| \`shapeRotation\`, \`shapeOpacity\` | Per-copy rotation / opacity |

Wire-up: \`cavalry_connect\` shape \`id\` → duplicator \`shapes\`, then \`cavalry_set_generator\` the duplicator to
\`circleDistribution\` / \`gridDistribution\`, and hide the source shape (\`hidden: true\`).

## Text

| Path | Notes |
| --- | --- |
| \`text\` | Content |
| \`fontSize\` | Size in px |
| \`font\` | \`{"font": "Arial", "style": "Bold"}\` |
| \`autoWidth\` | Set \`true\` to stop wrapping |
| \`horizontalAlignment\` | 0 left, 1 centre, 2 right |

## Composition (use the id from \`cavalry_scene_info\`)

| Path | Notes |
| --- | --- |
| \`resolution\` | Read-only from scripts |
| \`startFrame\`, \`endFrame\`, \`fps\` | Frame range and rate |

## Magic Easing

${MAGIC_EASINGS.map((name) => `\`${name}\``).join(", ")}.
\`Custom\` takes an expression in \`x\`, e.g. \`1 - pow(1 - x, 5)\`.

## Gotchas

- Bring Cavalry to the foreground: background windows pause script callbacks (\`BridgeFrozenError\`).
- Layer ids change after deleting layers or reopening scenes; list layers again instead of guessing.
- \`cavalry_batch\` is not atomic. Use \`"$0"\` to refer to the id created by operation 0.
- Render a PNG (\`cavalry_render_png\`) and look at it to verify visual results.
`;
