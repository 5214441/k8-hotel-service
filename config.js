window.HOTEL_CONFIG = {
  hotelName: "K8智享酒店",
  shortName: "K8酒店",
  address: "霍邱县城关镇城隍庙大街",
  wifiText: "Wi-Fi名称：房间号，密码：123456789",
  checkOutText: "退房时间：中午14:00前，房卡请交前台",
  // 部署 Cloudflare Worker 后，把下面地址改成你的 workers.dev 地址，不要以 / 结尾
  apiBase: "https://k8-api.kkkk8888.ccwu.cc",
  staffNames: ["前台A", "前台B"],
  pollSeconds: 4,
  overdueMinutes: 5,
  rentalPrices: [
    { name: "经济型", price: "88元", note: "价格以现场确认为准" },
    { name: "商务型", price: "138元", note: "价格以现场确认为准" },
    { name: "SUV", price: "188元", note: "价格以现场确认为准" },
    { name: "七座", price: "228元", note: "价格以现场确认为准" }
  ]
};
