# Project TODO

- [x] Google Form 連結輸入欄，後端自動解析表單結構取得各欄位 entry.ID
- [x] 純文字貼上區，從混合文字中以 LLM 智能提取所需資訊（英文名字、編號）
- [x] 課程主題與導師姓名等共用欄位手動輸入區
- [x] 資料核對表格，讓用戶確認解析結果正確後再生成連結（含性別選擇）
- [x] 為每位學生生成 Google Form 預填連結（固定欄位已填入）
- [x] 卡片展示每位學生的「開啟表單」按鈕（新視窗開啟）
- [x] 一鍵複製所有連結 + 下載 CSV 功能
- [x] 優雅精緻的整體視覺設計風格（elegant and perfect）
- [x] 複製連結加入 async error handling 與 fallback 機制
- [x] 驗證 Google Form 欄位映射：確認 entry.ID 存在於抽出的欄位清單
- [x] 缺少欄位映射時顯示警告提示
- [x] 修復預填連結空白問題：使用 subFieldId 而非 questionId 作為 entry.ID
- [x] 修復 TUTOR 和課程主題預填失敗：從表單提取選項列表，在核對步驟提供下拉選單選擇
