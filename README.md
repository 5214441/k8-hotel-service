# 酒店房间微信二维码服务

独立静态网站，部署在一个全新的 GitHub 仓库中，不依赖原来的工具箱仓库。

## 功能

- 房间专属链接：`?room=608`
- 客房用品、清洁、布草、维修、续住、退房、开票、租车等服务选择
- 自动生成可复制的微信服务单
- 前台微信二维码展示
- 房号二维码批量生成和打印
- 手机端适配

## 必须替换的图片

把前台微信二维码图片命名为：

`assets/wechat-qr.png`

直接覆盖同名文件即可。当前压缩包内提供的是提示占位图（SVG），正式使用必须放入真实的微信二维码 PNG 图片。

## 修改酒店信息

编辑 `config.js`：

- 酒店名称
- 地址
- 前台微信号（可留空）
- 租车价格
- Wi-Fi和退房提示

## GitHub 部署

1. 在 GitHub 新建一个 Public 仓库，建议名称：`k8-hotel-service`
2. 将本项目全部文件上传到仓库根目录，包括隐藏目录 `.github`
3. 打开仓库 `Settings → Pages`
4. 在 `Build and deployment` 中将 Source 选择为 `GitHub Actions`
5. 打开 `Actions`，等待“部署酒店微信服务页”变成绿色对勾

部署地址一般为：

`https://你的GitHub用户名.github.io/k8-hotel-service/`

二维码生成页：

`https://你的GitHub用户名.github.io/k8-hotel-service/qr.html`

房间示例：

`https://你的GitHub用户名.github.io/k8-hotel-service/?room=608`

## 使用流程

1. 在 `qr.html` 输入全部房间号并生成二维码
2. 打印后放在对应房间
3. 住客扫码选择服务
4. 复制服务单
5. 长按识别前台微信二维码并发送

## 注意

这是纯静态网页，不会把住客请求自动推送到前台。住客需通过微信发送生成的服务单。
