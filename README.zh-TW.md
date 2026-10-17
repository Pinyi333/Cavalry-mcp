<div align="center">

# Cavalry MCP

**透過 Model Context Protocol，讓 Claude 等 AI 助理直接操控 [Cavalry](https://cavalry.studio/) 2D 程序化動態設計軟體。**

[![CI](https://github.com/Pinyi333/cavalry-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Pinyi333/cavalry-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Node](https://img.shields.io/badge/node-%3E%3D18.17-339933)
![MCP](https://img.shields.io/badge/MCP-stdio-8A2BE2)

**[官方網站](https://pinyi333.github.io/Cavalry-mcp/?lang=zh)** · [English](README.md) · **繁體中文**

</div>

---

## 目錄

- [簡介](#簡介)
- [運作原理](#運作原理)
- [系統需求](#系統需求)
- [安裝](#安裝)
- [連接 MCP 用戶端](#連接-mcp-用戶端)
- [使用範例](#使用範例)
- [工具一覽](#工具一覽)
- [設定](#設定)
- [安全性](#安全性)
- [疑難排解](#疑難排解)
- [開發](#開發)
- [未來規劃](#未來規劃)
- [參與貢獻](#參與貢獻)
- [授權](#授權)

## 簡介

Cavalry MCP 是一個 MCP 伺服器，提供 AI 助理一組**有型別、經過驗證的工具**來操作 Cavalry。建立圖層、設定屬性、連接節點、加上帶 Magic Easing 的關鍵影格、輸出 PNG 預覽、儲存場景，都可以用自然語言完成：

> 「做一張 1920×1080 的標題卡：一個橘色圓角矩形，在 24 格內從下方彈入，然後把第 30 格輸出到我的桌面。」

設計原則：

- **有型別的工具**：每個參數送進 Cavalry 之前都會先經過 schema 檢查。執行任意程式碼的功能預設關閉。
- **只在本機運作**：所有資料都留在你的電腦裡。橋接器只綁定 `127.0.0.1`，不對外連線。
- **錯誤訊息清楚**：出錯時會說明原因和解法，例如「橋接器未啟動」、「圖層不存在」、「連接埠不符」。
- **Cavalry 端不用裝任何套件**：橋接器只是一個 JavaScript 檔案，使用 Cavalry 內建的 `api.WebServer`。

## 運作原理

```
┌──────────────┐  stdio (MCP)  ┌────────────────────┐  HTTP 127.0.0.1:37650  ┌──────────────────────────┐
│ Claude / MCP │ ────────────▶ │  cavalry-mcp       │ ─────────────────────▶ │ cavalry-mcp-bridge.js    │
│ 用戶端        │ ◀──────────── │  (Node.js 伺服器)   │ ◀───────────────────── │ （在 Cavalry 內執行）       │
└──────────────┘               └────────────────────┘   POST /post, GET /get  └──────────────────────────┘
```

1. **MCP 伺服器**（`src/`）透過 stdio 把工具提供給用戶端。
2. 每次呼叫工具，伺服器會把 `{id, op, args}` 以 JSON POST 給在 Cavalry 內執行的**橋接器**。
3. Cavalry 的 WebServer 無法直接回應 POST。橋接器用 Cavalry 腳本 API 執行操作後，把結果依請求 id 發佈出來，伺服器則輪詢 `GET /get`，直到拿到該筆結果。

通訊協定的完整規格請見 [docs/protocol.md](docs/protocol.md)。

## 系統需求

| 元件                               | 版本                                                                                |
| ---------------------------------- | ----------------------------------------------------------------------------------- |
| [Cavalry](https://cavalry.studio/) | **2.7 以上**（自 2.7 起個人使用免費，包含腳本功能）                                 |
| [Node.js](https://nodejs.org/)     | **建議 22 LTS**。伺服器在 18.17 以上就能執行，但 `npm test` 和 lint 需要 22.12 以上 |
| MCP 用戶端                         | Claude Desktop、Claude Code、Cursor，或任何支援 stdio 的 MCP 用戶端                 |
| 作業系統                           | macOS 12+ 或 Windows 10+（Cavalry 支援的平台）                                      |

> Cavalry 2.6.1 以前的版本，只有付費的 _Professional_ 授權才能執行未加密的腳本，而本專案的橋接器就是未加密的腳本。請使用 Cavalry 2.7 以上版本。

## 安裝

### 1. 建置 MCP 伺服器

```bash
git clone https://github.com/Pinyi333/cavalry-mcp.git
cd cavalry-mcp
npm install        # 會透過 "prepare" 腳本自動建置 dist/
```

想確認安裝沒問題，可以跑測試（不需要開 Cavalry）：

```bash
npm test
```

### 2. 安裝 Cavalry 橋接器

把 [`bridge/cavalry-mcp-bridge.js`](bridge/cavalry-mcp-bridge.js) 複製到 Cavalry 的 Scripts 資料夾。也可以在 Cavalry 裡用 **Help > Scripts** 直接打開這個資料夾。

| 作業系統 | Scripts 資料夾                                   |
| -------- | ------------------------------------------------ |
| macOS    | `~/Library/Application Support/Cavalry/Scripts/` |
| Windows  | `%APPDATA%\Cavalry\Scripts\`                     |

### 3. 啟動橋接器

在 Cavalry 選擇 **Window > Scripts > cavalry-mcp-bridge**，會跳出一個小面板，顯示 `Listening on 127.0.0.1:37650`。腳本第一次使用 Web API 時，Cavalry 可能會詢問權限，請按允許。

> 關閉面板或 Cavalry 後，橋接器就會停止。每次重開 Cavalry 都要再啟動一次。

## 連接 MCP 用戶端

把 `/ABSOLUTE/PATH/TO/cavalry-mcp` 換成你 clone 下來的資料夾路徑。可直接複製的設定檔放在 [`examples/`](examples/)。

<details open>
<summary><b>Claude Desktop</b></summary>

編輯 `claude_desktop_config.json`：

- macOS：`~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows：`%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "cavalry": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/cavalry-mcp/dist/index.js"]
    }
  }
}
```

重新啟動 Claude Desktop 後，工具選單裡就會出現 Cavalry 的工具。

</details>

<details>
<summary><b>Claude Code</b></summary>

```bash
claude mcp add cavalry -- node /ABSOLUTE/PATH/TO/cavalry-mcp/dist/index.js
```

或在專案根目錄新增 `.mcp.json`：

```json
{
  "mcpServers": {
    "cavalry": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/cavalry-mcp/dist/index.js"]
    }
  }
}
```

</details>

<details>
<summary><b>Cursor 與其他用戶端</b></summary>

任何能啟動 stdio MCP 伺服器的用戶端都可以用。指令填 `node`，參數填 `dist/index.js`，需要的話再加上[環境變數](#設定)。

</details>

設定完成後，對 AI 助理說：**「Ping Cavalry」**。如果收到橋接器和 Cavalry 的版本資訊，就代表連線成功。

## 使用範例

| 你可以說                                                | 實際執行的工具                                                                                           |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 「我現在的場景裡有什麼？」                              | `cavalry_scene_info` 和 `cavalry_list_layers`                                                            |
| 「在正中間加一個半徑 120 的藍色圓形。」                 | `cavalry_create_primitive`，搭配 `generator.radius` 和 `material.materialColor`                          |
| 「讓它在 20 格內從上方彈跳進場。」                      | `cavalry_set_keyframes`，搭配 `"easing": "BounceOut"`                                                    |
| 「把 12 個圓排成一圈。」                                | `cavalry_create_layer`（duplicator）、`cavalry_connect`、`cavalry_set_generator`（`circleDistribution`） |
| 「把第 30 格以 50% 尺寸輸出到 ~/Desktop/preview.png。」 | `cavalry_render_png`                                                                                     |
| 「存成 ~/Projects/intro.cv。」                          | `cavalry_save_scene`                                                                                     |

更多附備案的逐步示範，請見 [examples/demo-prompts.md](examples/demo-prompts.md)。

讓效果更好的小技巧：

- 寫入時如果出現 _「has no attribute」_，代表屬性路徑錯了。Cavalry 遇到錯誤路徑原本會直接忽略、不報錯，所以伺服器會先檢查每個路徑。請用 `cavalry_list_attributes` 查正確的路徑。2D 旋轉請用 `rotation.z`。
- 做完大改動後，請 AI **輸出一張 PNG 來檢查**。能讀取本機檔案的用戶端（例如 Claude Code）可以自己看圖驗證。
- 屬性路徑和 Cavalry 的 **Copy Scripting Path**（在 Attribute Editor 對屬性按右鍵）一致，例如 `position.x`、`generator.dimensions`。
- 步驟很多的建構工作，AI 可以用 `cavalry_batch` 一次送出全部操作，減少來回次數。

## 工具一覽

| 工具                                     | 用途                                                                         | 類型         |
| ---------------------------------------- | ---------------------------------------------------------------------------- | ------------ |
| `cavalry_ping`                           | 檢查連線和版本                                                               | 唯讀         |
| `cavalry_scene_info`                     | 場景路徑、未儲存狀態、目前影格、合成清單、目前合成的設定                     | 唯讀         |
| `cavalry_set_frame`                      | 移動播放頭                                                                   | 編輯         |
| `cavalry_playback`                       | 播放／停止                                                                   | 編輯         |
| `cavalry_list_layers`                    | 列出圖層（可只列頂層或依類型篩選）                                           | 唯讀         |
| `cavalry_get_selection`                  | 取得目前選取的圖層                                                           | 唯讀         |
| `cavalry_select`                         | 取代目前的選取                                                               | 編輯         |
| `cavalry_create_primitive`               | 建立矩形、橢圓、星形、多邊形等，可同時設定屬性                               | 建立         |
| `cavalry_create_layer`                   | 建立任意類型圖層（文字、null、群組、duplicator、材質…）                      | 建立         |
| `cavalry_duplicate_layer`                | 複製圖層，回傳新圖層的 id                                                    | 建立         |
| `cavalry_rename_layer`                   | 重新命名圖層                                                                 | 編輯         |
| `cavalry_set_parent`                     | 設定或解除父層                                                               | 編輯         |
| `cavalry_delete_layers`                  | 刪除圖層                                                                     | 破壞性       |
| `cavalry_list_attributes`                | 列出屬性路徑（可附上資料型別和目前的值）                                     | 唯讀         |
| `cavalry_get_attributes`                 | 讀取屬性值                                                                   | 唯讀         |
| `cavalry_set_attributes`                 | 設定屬性值（寫入前會先檢查路徑）                                             | 編輯         |
| `cavalry_get_bounding_box`               | 取得圖層邊界框，用於排版和對齊                                               | 唯讀         |
| `cavalry_inspect_connections`            | 查看圖層的輸入／輸出連線                                                     | 唯讀         |
| `cavalry_add_dynamic_attribute`          | 新增動態屬性（例如 JavaScript 圖層）                                         | 建立         |
| `cavalry_set_generator`                  | 更換圖層的 generator                                                         | 編輯         |
| `cavalry_set_expression`                 | 設定或清除屬性的 expression                                                  | 編輯         |
| `cavalry_connect` / `cavalry_disconnect` | 連接或中斷屬性之間的連線                                                     | 編輯／破壞性 |
| `cavalry_set_keyframes`                  | 為一個或多個屬性加上關鍵影格，可套用 Magic Easing                            | 編輯         |
| `cavalry_delete_keyframes`               | 刪除特定關鍵影格，或刪除屬性上的所有動畫                                     | 破壞性       |
| `cavalry_render_png`                     | 把某一格輸出成 PNG                                                           | 建立         |
| `cavalry_save_scene`                     | 儲存／另存新檔                                                               | 編輯         |
| `cavalry_open_scene`                     | 開啟 `.cv` 檔                                                                | 破壞性       |
| `cavalry_batch`                          | 一次執行多個操作，可用 `$0` 引用前面的結果（遇錯即停，已完成的操作不會還原） | 破壞性       |
| `cavalry_run_script`                     | 在 Cavalry 內執行任意 JavaScript（**需手動開啟**，見[安全性](#安全性)）      | 破壞性       |

**Resource：** `cavalry://guide/attributes` 是內建的參考指南，整理了常用圖層類型、屬性路徑（`rotation.z`、`shapeScale.x`、`startFrame`…）、Magic Easing 名稱和常見陷阱。支援 MCP resources 的用戶端可以把它附加為參考資料。

**批次引用：** `cavalry_batch` 裡後面的操作可以使用前面操作的結果。`"$0"` 代表第 0 個操作建立的 id，`"$1.created.0.id"` 則可以取出結果裡更深層的值：

```json
[
  { "op": "create_primitive", "args": { "shape": "ellipse", "attributes": { "hidden": true } } },
  { "op": "create_layer", "args": { "type": "duplicator" } },
  { "op": "connect", "args": { "fromLayerId": "$0", "toLayerId": "$1", "toAttrId": "shapes" } },
  { "op": "set_generator", "args": { "layerId": "$1", "type": "circleDistribution" } }
]
```

**Magic Easing 名稱：** `SlowIn`、`SlowOut`、`SlowInSlowOut`、`VerySlowIn`、`VerySlowOut`、`VerySlowInVerySlowOut`、`SpringIn`、`SpringOut`、`SpringInSpringOut`、`SmallSpringIn`、`SmallSpringOut`、`SmallSpringInSmallSpringOut`、`AnticipateIn`、`OvershootOut`、`AnticipateInOvershootOut`、`BounceIn`、`BounceOut`、`BounceInBounceOut`、`Custom`（搭配 expression，例如 `1 - pow(1 - x, 5)`）、`None`。

## 設定

伺服器會讀取以下環境變數，全部都可以不設。

| 變數                           | 預設值      | 說明                                                                                                                                |
| ------------------------------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `CAVALRY_MCP_HOST`             | `127.0.0.1` | 橋接器監聽的主機，請保持在本機 loopback。                                                                                           |
| `CAVALRY_MCP_PORT`             | `37650`     | 必須和橋接器腳本裡的 `CONFIG.port` 一致。                                                                                           |
| `CAVALRY_MCP_TIMEOUT_MS`       | `15000`     | 單一操作的最長等待時間。輸出較重的畫面時可以調高。                                                                                  |
| `CAVALRY_MCP_POLL_INTERVAL_MS` | `40`        | 伺服器向橋接器輪詢結果的間隔。                                                                                                      |
| `CAVALRY_MCP_FROZEN_MS`        | `5000`      | Cavalry 超過這段時間都沒處理請求時，立即回報 `BridgeFrozenError`（設為 `0` 可停用）。輸出畫面、儲存、開啟場景和批次操作不受此限制。 |
| `CAVALRY_MCP_ALLOW_SCRIPT`     | `false`     | 開啟後會註冊 `cavalry_run_script`。橋接器端也必須同時允許。                                                                         |

在用戶端設定檔裡這樣傳入：

```json
{
  "mcpServers": {
    "cavalry": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/cavalry-mcp/dist/index.js"],
      "env": { "CAVALRY_MCP_PORT": "37650", "CAVALRY_MCP_TIMEOUT_MS": "30000" }
    }
  }
}
```

橋接器有自己的設定，寫在 `cavalry-mcp-bridge.js` 開頭的 `CONFIG` 區塊：`host`、`port`、`allowScript`、`maxResults`。

## 安全性

- 橋接器**沒有身分驗證**。你電腦上任何能連到 `127.0.0.1:37650` 的程式都可以對它下指令。因為只綁定 loopback，其他電腦連不進來。請不要把 `CONFIG.host` 改成 `0.0.0.0` 或區網位址。
- **執行任意 JavaScript 的功能，兩端預設都關閉。** 要啟用 `cavalry_run_script`，必須同時設定 `CAVALRY_MCP_ALLOW_SCRIPT=true`，*並且*把橋接器的 `CONFIG.allowScript` 改成 `true`。建議只在需要時才開啟。
- 本專案不儲存任何憑證、API 金鑰或遙測資料，也不需要這些東西。
- 不使用時，請關閉橋接器面板。

發現安全漏洞時，請依照 [SECURITY.md](SECURITY.md) 私下回報。

## 疑難排解

| 狀況                                                      | 解法                                                                                                       |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `BridgeUnavailableError: Cannot reach the Cavalry bridge` | Cavalry 沒開，或橋接器面板沒啟動。請執行 **Window > Scripts > cavalry-mcp-bridge**，並確認兩端連接埠一致。 |
| `BridgeFrozenError`                                       | Cavalry 在背景，或有對話框開著。請把 Cavalry 切到前景，請求仍在佇列中，Cavalry 恢復後就會執行。            |
| `BridgeTimeoutError`                                      | 操作花的時間太久。輸出時間較長的畫面時，請調高 `CAVALRY_MCP_TIMEOUT_MS`。                                  |
| `BridgeProtocolError: ... not the cavalry-mcp bridge`     | 連接埠被其他程式占用。把 `CONFIG.port` 和 `CAVALRY_MCP_PORT` 改成同一個空閒的連接埠。                      |
| `Bridge protocol mismatch`                                | 把和伺服器同一版本的 `cavalry-mcp-bridge.js` 重新複製到 Cavalry。                                          |
| `Layer '…' does not exist`                                | 刪除圖層或重開場景後，圖層 id 會改變。請 AI 重新呼叫 `cavalry_list_layers`。                               |
| Claude 裡看不到工具                                       | 確認設定檔裡的路徑是絕對路徑，而且 `dist/index.js` 存在（可執行 `npm run build`），然後重啟用戶端。        |

不透過 AI 用戶端除錯時，可以用 MCP Inspector：

```bash
npm run inspector
```

## 開發

```bash
npm install
npm run dev          # tsc --watch
npm test             # vitest（用模擬的 Cavalry 執行真正的橋接器腳本）
npm run check        # 型別檢查 + lint + 格式檢查 + 測試（和 CI 相同）
```

專案結構：

```
cavalry-mcp/
├── bridge/cavalry-mcp-bridge.js   # 在 Cavalry 內執行（純 ES2017，無相依套件）
├── src/
│   ├── index.ts                   # CLI 進入點：讀取設定、建立 stdio 傳輸
│   ├── server.ts                  # 在 MCP 伺服器上註冊工具
│   ├── tools.ts                   # 宣告式工具清單（schema、annotations）
│   ├── guide.ts                   # cavalry://guide/attributes 參考指南
│   ├── bridge-client.ts           # HTTP POST 後輪詢的用戶端 + 有型別的錯誤類別
│   └── config.ts                  # 解析環境變數
├── test/                          # 單元測試 + 使用模擬 Cavalry api 的端對端測試
├── docs/protocol.md               # 橋接器通訊協定
├── docs/index.html                # 推廣首頁（GitHub Pages）
└── examples/                      # MCP 用戶端設定範本
```

### 推廣首頁

專案網站放在 [`docs/`](docs/)，以純 HTML、CSS、JavaScript 搭配 [GSAP](https://gsap.com/) 與 canvas 製作，不需要建置。直接用瀏覽器開啟 `docs/index.html`，或用任何靜態伺服器（`npx serve docs`）即可預覽。[Deploy site](.github/workflows/pages.yml) workflow 會在每次推送到 `main` 且有修改 `docs/` 時自動發佈；第一次使用請到 **Settings > Pages > Build and deployment > Source** 選擇 **GitHub Actions**。

若要把示範的動畫預覽換成實際錄影，把影片放到 `docs/assets/videos/`，再在 `docs/index.html` 對應示範的 `.demo__media` 元素設定 `data-video="assets/videos/demo-1.mp4"`（可另加 `data-poster`）。英文文案寫在 HTML 裡，繁體中文字串在 `docs/assets/js/i18n.js`。

新增工具的步驟：在橋接器的 `ops` 表實作操作，在 `src/tools.ts` 加上定義，再到 `test/bridge.test.ts` 補上測試。詳見 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 未來規劃

- 算圖佇列工具（把合成的影格範圍輸出成影片或圖片序列）
- 合成管理（建立合成，設定解析度、影格範圍和 fps）
- 匯入素材（圖片、SVG、Google Sheets／Canva Sheets 資料）
- 提供場景結構的 MCP resources，以及常見動態效果的 prompts
- 伺服器與橋接器之間可選用的共用密鑰（token）

## 參與貢獻

歡迎提出 Issue 和 Pull Request，請先閱讀 [CONTRIBUTING.md](CONTRIBUTING.md)。自動化測試是在模擬的 Cavalry 上執行，所以來自實際 Cavalry 環境的回報特別有價值，請附上 Cavalry 版本、作業系統，以及失敗的工具呼叫內容。

## 致謝

本專案參考了以下社群專案的設計概念，特此致謝：

- [ZHUYUFAN3-33/cavalry-mcp](https://github.com/ZHUYUFAN3-33/cavalry-mcp)：用有型別的工具取代直接執行程式碼、帶請求 id 的 POST 後輪詢協定、快速偵測「凍結」狀態、邊界框與連線檢查，以及社群驗證過的屬性路徑（已整理進屬性指南）。
- [kacperchlebowicz/Cavalry-mcp](https://github.com/kacperchlebowicz/Cavalry-mcp)：動態屬性，以及圖層類型和屬性路徑的參考清單。
- [matthewobanla/Calvary-MCP](https://github.com/matthewobanla/Calvary-MCP)：節點圖和算圖流程的工作方式（算圖佇列工具已列入未來規劃）。

沒有複製任何程式碼，所有實作皆為原創。

## 授權

[MIT](LICENSE) © Piny

Cavalry 是 Canva／Scene Group 的產品。本專案是獨立的社群整合專案，與 Canva 或 Scene Group 沒有任何關聯，也未獲得其背書。
