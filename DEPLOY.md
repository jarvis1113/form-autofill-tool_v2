# 部署指南

## 前置準備

1. **Google Gemini API Key**（免費）
   - 前往 https://aistudio.google.com
   - 登入 Google 帳號 → 點「Get API key」→ 建立新 key

2. **GitHub 帳號**（用於連接 Railway/Render）

---

## 方案 A：部署到 Railway（推薦）

Railway 有免費方案，每月 $5 美元額度，足夠個人使用。

1. 前往 https://railway.app，用 GitHub 登入
2. 點「New Project」→「Deploy from GitHub repo」→ 選擇此倉庫
3. Railway 會自動偵測 Node.js 專案並部署
4. 新增 MySQL 資料庫：點「Add Service」→「Database」→「MySQL」
5. 在「Variables」頁面新增以下環境變數：
   ```
   GEMINI_API_KEY=你的_gemini_api_key
   JWT_SECRET=任意隨機字串（至少32字元）
   DATABASE_URL=（Railway MySQL 會自動提供）
   ```
6. 部署完成後，Railway 會提供一個 `.railway.app` 網址

---

## 方案 B：部署到 Render（免費方案）

Render 免費方案會在閒置 15 分鐘後休眠（首次訪問較慢）。

1. 前往 https://render.com，用 GitHub 登入
2. 點「New」→「Web Service」→ 連接此 GitHub 倉庫
3. 設定：
   - **Build Command**: `pnpm install && pnpm build`
   - **Start Command**: `node dist/index.js`
4. 新增環境變數（同上）
5. 資料庫：點「New」→「PostgreSQL」（需修改 schema 為 PostgreSQL）
   或使用外部 MySQL（如 PlanetScale 免費方案）

---

## 本地運行

```bash
# 複製環境變數範本
cp .env.example .env
# 填入你的 GEMINI_API_KEY 和 DATABASE_URL

# 安裝依賴
pnpm install

# 啟動開發伺服器
pnpm dev
```

