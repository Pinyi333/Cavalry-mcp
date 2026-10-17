/* Bilingual copy. English lives in index.html; this file only holds the Traditional Chinese strings,
   keyed by each element's data-i18n attribute. Add a key here and in the HTML to translate new text. */
(function () {
  "use strict";

  var zh = {
    "nav.skip": "跳到主要內容",
    "nav.how": "運作方式",
    "nav.demos": "示範",
    "nav.install": "安裝",
    "nav.star": "Star",

    "hero.eyebrow": "Cavalry 的開源 MCP 伺服器",
    "hero.title1": "動態設計，",
    "hero.title2": "說一句話就好。",
    "hero.lede":
      "讓 Claude 等 AI 助理透過 28 個具型別、經過驗證的工具，在 Cavalry 裡建立圖層、串接程序化結構、用 Magic Easing 設定關鍵影格並輸出畫面。",
    "hero.you": "你",

    "cta.star": "到 GitHub 給星星",
    "cta.start": "開始使用",

    "how.kicker": "運作方式",
    "how.title1": "輸入一句話，",
    "how.title2": "得到會動的場景。",
    "how.a": "Claude Desktop、Claude Code、Cursor，或任何支援 stdio 的 MCP 用戶端。",
    "how.b": "Node.js 伺服器，每個參數都先經過型別檢查，才會送進 Cavalry。",
    "how.c": "一支純 JavaScript 腳本，透過 Cavalry 內建的 WebServer 在 Cavalry 裡執行。",

    "p1.title": "具型別的工具",
    "p1.body": "每個參數都經過驗證，寫入前也會先檢查屬性路徑。任意程式碼執行預設關閉。",
    "p2.title": "只在本機執行",
    "p2.body": "Bridge 只綁定 localhost，不對外連線。你的場景不會離開你的電腦。",
    "p3.title": "一次往返批次執行",
    "p3.body": "<code>cavalry_batch</code> 一次呼叫就能建好整個結構，並用 <code>$0</code> 參照先前建立的圖層。",
    "p4.title": "Cavalry 端零依賴",
    "p4.body": "把一支腳本放進 Scripts 資料夾、按下啟動即可。錯誤訊息會清楚告訴你該修哪裡。",

    "demos.kicker": "示範",
    "demos.title1": "說出來，",
    "demos.title2": "看它動起來。",
    "demos.lede": "四個指令，從第一個關鍵影格到整個場景改風格。每一個都只是傳給 Claude 的一則訊息。",
    "demos.preview": "預覽 · 影片即將推出",

    "d1.title": "入門：一句話做出彈入動畫",
    "d1.shows": "建立圖層、設定屬性、用 Magic Easing 設定關鍵影格。",
    "d1.prompt": "在畫面正中間建立一個 480×160 的橘色圓角矩形，讓它在 24 格內從畫面下方彈上來，帶一點回彈。",
    "d2.title": "程序化：旋轉圓環",
    "d2.shows": "Duplicator、Generator 與連線，一次批次呼叫完成。這正是 Cavalry 最強的地方。",
    "d2.prompt": "用 12 顆小的青色圓點排成半徑 300 的圓環，讓整個圓環在 120 格內慢慢轉一圈，可以無縫循環。",
    "d3.title": "實用：一張完整的標題卡",
    "d3.shows": "文字、版面、配色與錯開的時間軸，幾秒內做出可交付的成品。",
    "d3.prompt":
      "做一張標題卡：深藍色背景，大大的白色粗體標題「Hello Cavalry」，下方一行小的橘色副標。讓它們依序淡入並往上滑入。",
    "d4.title": "驚喜：讀懂場景再改風格",
    "d4.shows": "AI 先讀懂現有場景，再有意圖地修改每一個圖層。",
    "d4.prompt": "看一下場景裡現在有什麼，把它改成霓虹賽博龐克風格。動畫保留，只改配色，營造發光的感覺。",

    "install.kicker": "安裝",
    "install.title1": "三個步驟，",
    "install.title2": "大約兩分鐘。",
    "install.lede": "你需要 Cavalry 2.7 以上（個人免費）與 Node.js 22 LTS。",
    "s1.title": "建置伺服器",
    "s2.title": "在 Cavalry 啟動 Bridge",
    "s2.body":
      "把 bridge/cavalry-mcp-bridge.js 複製到 Cavalry 的 Scripts 資料夾（Help > Scripts），再執行 Window > Scripts > cavalry-mcp-bridge。面板會顯示「Listening on 127.0.0.1:37650」。",
    "s3.title": "連接你的用戶端",
    copy: "複製",
    copied: "已複製",
    "install.more": "完整說明、工具列表與疑難排解",

    "cta.kicker": "開源",
    "cta.title1": "給顆星，",
    "cta.title2": "一起打造它。",
    "cta.lede":
      "Cavalry MCP 採 MIT 授權、公開開發。你的星星能讓更多動態設計師找到它，而 issue 與 pull request 決定它接下來學會什麼。",
    "cta.issue": "建議新工具",

    "footer.note": "獨立社群專案，與 Cavalry 或 Scene Group 無隸屬關係。",
  };

  // Rotating hero prompts, per language.
  var prompts = {
    en: [
      "Make a ring of 12 small cyan dots with a radius of 300, and slowly rotate it 360° over 120 frames.",
      "Create an orange rounded rectangle and make it spring up from below with an overshoot.",
      "Look at the scene and restyle it as neon cyberpunk. Keep the animation.",
    ],
    zh: [
      "用 12 顆青色圓點排成半徑 300 的圓環，在 120 格內慢慢轉一圈。",
      "建立一個橘色圓角矩形，讓它從畫面下方彈上來，帶一點回彈。",
      "看一下場景，把它改成霓虹賽博龐克風格，動畫保留。",
    ],
  };

  window.CavalryI18n = { zh: zh, prompts: prompts };
})();
