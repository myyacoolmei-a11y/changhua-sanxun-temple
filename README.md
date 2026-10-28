# 彰化三巡府｜Railway 登入與帳號權限版本

## 部署
1. 備份原本 GitHub 專案，並保留目前 Railway 設定。
2. 將本資料夾的檔案上傳到同一個 GitHub repo 的根目錄（`public/index.html`, `public/login.html`, `server.js`, `package.json`）。原本根目錄的 `index.html` 建議移除或改名，避免部署誤判；`public/index.html` 是新版。
3. Railway 現有服務連接該 GitHub repository，Root Directory 留空。Build 可使用 `npm install`，Start Command 為 `npm start`。Node 20+。
4. `Variables` 設定 `DATABASE_URL` 為 Railway 的 Postgres reference：`${{Postgres.DATABASE_URL}}`（如實際名稱不同請更改）。
5. **第一次啟動前**加入 `ADMIN_INITIAL_PASSWORD`：自行設定至少 8 字元的安全臨時密碼。**不可貼進 GitHub，也不要在聊天中分享。** 初始帳號為 `LOH0715`，也可設 `ADMIN_USERNAME` 覆蓋。建完管理員後可移除 `ADMIN_INITIAL_PASSWORD`。
6. `NODE_ENV=production`，並確認 Railway 網域是 HTTPS。
7. `/login` 登入，進入「帳號權限管理」設定姓名、自由頭銜、帳號密碼及功能勾選。

## 重要限制
- **登入帳號、密碼雜湊、權限與登入 session** 存在 PostgreSQL。
- **原本宮廟業務資料** 的 HTML 還在使用 localStorage！它未同步 PostgreSQL，無法達成跨裝置共用、資料統一備份或完整的資料列級權限。這不是正式完成的宮廟資料庫遷移版本；不建議在遷移及安全驗收前讓多名人員使用真實敏感資料。
- 本版本依登入驗證保護主頁，左側選單按照帳號權限隱藏，伺服器端 API 有獨立的管理員權限驗證。**原 HTML 的業務資料讀寫仍是前端操作，不能把選單隱藏當成後端資料權限控管。**
- 根據原始上傳內容，`temple-banner.png` 等外部圖片請沿用原專案原有檔案。
- 若已洩露 PostgreSQL 連線密碼，請先在 Railway 旋轉資料庫密碼並更新相關引用。
- 建議 Railway 資料庫啟用獨立備份與還原測試。

## 登入錯誤診斷
- 先開啟 `https://你的網址/api/diagnostics`：應回 JSON 的 `api: online`, `database: online`, `users_initialized: true`。
- 如果顯示 HTML 或 404：Railway 不是以本專案的 Node 伺服器啟動，請確認根目錄含 `server.js`/`package.json`、Start Command=`npm start`。
- 如果 `database: unavailable`：檢查 Railway `DATABASE_URL` reference 和 Postgres 狀態，**不要傳送完整連線網址**。
- 如果 `users_initialized: false`：檢查服務部署日誌有沒有初始化失敗、設定初始密碼的時間。
- 變更 `ADMIN_INITIAL_PASSWORD` 不會變更既存帳號的密碼。
- 管理員密碼已在螢幕截圖曝光，成功登入後應立即重設，並清除初始密碼環境變數。
