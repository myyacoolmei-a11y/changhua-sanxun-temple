# 三巡府行事曆權限名稱統一修正

這次將「三巡府行事曆」與「宮廟行事曆」統一為「行事曆」，同時更新 Railway 的資料庫權限欄位，保留既有使用者的授權。

## 更新方式
只將 ZIP 裡的 `server.js` 與 `public/index.html` **覆蓋 GitHub 同名路徑**，不要刪除資料庫，不用改 Railway Variables。

注意：GitHub 根目錄另一個 `index.html` 是舊版，Railway 實際使用 `public/index.html`。本包沒有修改根目錄舊版。

上線後在帳號權限管理頁重新整理，確認勾選項目顯示「行事曆」，已授權的帳號仍有該權限。
