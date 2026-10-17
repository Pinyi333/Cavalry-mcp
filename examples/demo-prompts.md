# Demo Prompts · 示範指令

Ready-to-use prompts for showing off Cavalry MCP, ordered from simple to impressive. Each demo lists the prompt
(English for international viewers, 繁體中文 for local ones), what should happen, and a fallback if it doesn't.

可直接使用的示範指令，由淺入深排列。每個 demo 都附上英文和繁中指令、預期結果，以及失敗時的備案。

---

## 0. Before you record · 錄影前準備

**Scene setup · 場景設定**

1. In Cavalry, create a **new scene** (`File > New`). Keep the default composition (1920×1080).
2. Run **Window > Scripts > cavalry-mcp-bridge** and confirm the panel says `Listening on 127.0.0.1:37650`.
3. Put Claude Desktop on the left and Cavalry on the right. **Cavalry must stay visible**: backgrounded windows pause
   script callbacks.

**Prime Claude off-camera · 在鏡頭外先設定好 Claude**

Create a Claude Desktop **Project** (e.g. "Cavalry Demo") and paste this into its **project instructions**, so the
viewer only sees your short, natural prompts:

```text
You control Cavalry (2D motion design) through the cavalry_* tools.
- Composition is 1920x1080, origin at the centre, +y is up. Frame rate as reported by cavalry_scene_info.
- Prefer cavalry_batch for multi-step builds; use "$0", "$1"... to reference layers created earlier in the batch.
- Rotate with "rotation.z". Scale 1.0 = 100%. Colours are hex strings on "material.materialColor".
- If an attribute path is rejected, call cavalry_list_attributes on that layer and retry with the right path.
- Name every layer you create clearly. Keep replies to one or two short sentences: the viewer is watching Cavalry.
- After animating, move the playhead to frame 0 and start playback so the result is visible.
```

**Rehearse · 先彩排**

Run every demo once before recording, then `File > New` to reset. If a demo needs a fallback prompt, record with
the fallback, since it is what works on your machine.

---

## Demo ① Hello, keyframes · 入門：一句話做出彈入動畫

**Shows:** create layer, set attributes, keyframes, Magic Easing. **Length on video:** ~8 s (sped up).

> **EN:** Create an orange rounded rectangle, 480 by 160, in the centre. Make it spring up from below the frame over
> 24 frames with an overshoot.
>
> **中文：** 在畫面正中間建立一個 480×160 的橘色圓角矩形，讓它在 24 格內從畫面下方彈上來，帶一點回彈。

**Expected:** a `rectangle` primitive (`#FF6B2C`-ish), keyframes on `position.y` (e.g. −700 → 0, frames 0 → 24) with
`OvershootOut`, then playback.

**Fallback:** if the rounded corners fail, drop "rounded". If the size doesn't apply, add
"use scale instead of dimensions if needed".

---

## Demo ② Procedural ring · 程序化：12 顆圓點組成旋轉圓環

**Shows:** duplicator, connections, generators, batch references. This is Cavalry's signature strength and **the
best clip for a short vertical video**.

> **EN:** Make a ring of 12 small cyan dots with a radius of 300, and slowly rotate the whole ring 360 degrees over
> 120 frames so it loops.
>
> **中文：** 用 12 顆小的青色圓點排成半徑 300 的圓環，讓整個圓環在 120 格內慢慢轉一圈，可以無縫循環。

**Expected (one `cavalry_batch`):** an ellipse (hidden source) → duplicator → connect `id` → `shapes` → generator
`circleDistribution` with `generator.count = 12`, `generator.radius = 300` → keyframes on the duplicator's
`rotation.z` 0 → 360 (no easing for a seamless loop).

**Follow-up for extra wow · 加碼指令:**

> **EN:** Now make every other dot magenta and make the dots pulse in size.
>
> **中文：** 現在讓圓點一個青色一個洋紅色交錯，並且讓大小有脈動的感覺。

**Fallback:** if the pulse is too ambitious, ask only for the colour change, or "keyframe `shapeScale` from 1 to 1.4
and back".

---

## Demo ③ Title card · 實用：一張完整的標題卡

**Shows:** text, layout, colour, staggered timing: a "real deliverable" in seconds.

> **EN:** Build a title card: a deep navy background, the title "Hello Cavalry" in large white bold text, and a small
> orange subtitle "Made with Claude + MCP" underneath. Fade and slide them in one after another.
>
> **中文：** 做一張標題卡：深藍色背景，大大的白色粗體標題「Hello Cavalry」，下方一行小的橘色副標「Made with Claude + MCP」。讓它們依序淡入並往上滑入。

**Expected:** a background (`colorPlane` or a full-frame rectangle), two `textShape` layers (`text`, `fontSize`,
`material.materialColor`), `opacity` + `position.y` keyframes offset by ~8 frames, `SlowOut` easing.

**Fallback:** if the font weight fails, drop "bold". If the background layer type is rejected, ask for
"a 1920×1080 navy rectangle behind everything".

---

## Demo ④ Understand & restyle · 驚喜：讀懂現有場景再改風格

**Shows:** the AI **reads** an existing scene (scene info, list layers, attributes) and edits it intelligently.
Best as the closing demo. Start from the result of Demo ③.

> **EN:** Look at what's in the scene and restyle it as a neon cyberpunk look. Keep the animation, just change the
> colours and add a glow feel.
>
> **中文：** 看一下場景裡現在有什麼，把它改成霓虹賽博龐克風格。動畫保留，只改配色，營造發光的感覺。

**Expected:** `cavalry_scene_info` + `cavalry_list_layers` + `cavalry_get_attributes`, then `cavalry_set_attributes`
on each layer (e.g. black background, `#00F0FF` / `#FF2BD6` text).

**Fallback:** "glow" may need effects the tools don't cover yet; if so, ask for colours only.

---

## Bonus · 加分鏡頭（片尾 3 秒）

> **EN:** Save this scene as `cavalry-mcp-demo.cv` on my desktop.
>
> **中文：** 把這個場景存成桌面上的 `cavalry-mcp-demo.cv`。

A quick, concrete "and it's a real file" ending. `cavalry_save_scene` needs an absolute path, e.g.
`C:\Users\<you>\Desktop\cavalry-mcp-demo.cv`.

---

## Recording tips · 錄影小技巧

- **Resolution:** record at 2560×1440 or 1920×1080. Bump Claude Desktop's font size (`Ctrl` + `+`) so prompts are
  readable on phones.
- **Speed:** keep typing at real speed, speed up the AI thinking time 4–8×, and slow down to 1× when layers appear in
  Cavalry.
- **Clean UI:** hide unrelated panels in Cavalry, close notifications, and use a clean desktop.
- **Approve tools in advance:** in Claude Desktop, allow the cavalry tools ("Allow always") during rehearsal so no
  permission dialogs appear on camera.
- **Reset between takes:** `File > New` in Cavalry, plus a new conversation in the Claude project.
