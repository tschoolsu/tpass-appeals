// vitest 跑在 node 下，沒有 Next 的 "server-only" 解析。這個 stub 讓 server-only
// 的模組能在測試裡被載入；它的用途本來就只是「在 client bundle 裡 build 失敗」，
// 對測試沒有意義。
export {};
