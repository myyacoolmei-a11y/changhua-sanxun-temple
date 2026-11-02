三巡府修正包（第一階段：系統設定位置）

請先備份 GitHub 正式版本。使用 Cursor 開啟 GitHub 專案根目錄，將本壓縮檔中的兩份檔案放進根目錄，再於 Cursor 終端機執行：
  python3 install_sanxun_admin_tools.py

修改結果：
  public/index.html 加入系統設定腳本
  public/sanxun-admin-tools.js 新增系統設定 UI
  原有同步 API、信眾資料與儀式資料均不變

登入最高系統管理員帳號，會看到宮務行政附近的「系統設定」。開啟後原有下載備份／重新同步按鈕會移到其中。同步錯誤時才會顯示警告。

注意：目前 GitHub 連接器無法完整讀取接近 3MB 的 public/index.html，尚無法安全修改內部的儀式與活動參與資料關聯。
第二階段請提供該檔案本身，以便準確修復統計、個人歷史、儀式連動與活動連動。未經測試前請不要部署到正式站。
