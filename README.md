# 酒店住客服务工单系统 V2

## 使用效果

住客扫码选择服务后，点击“立即提交给前台”；前台 Windows 电脑上的 Edge 工单台会响铃并显示新工单。前台可接单、完成、交接和查看当天记录。

## 目录

- `index.html`：住客扫码服务页
- `admin.html`：前台工单台
- `qr.html`：房间二维码批量生成页
- `config.js`：酒店名称、Worker 地址、前台姓名等配置
- `worker/`：Cloudflare Worker + D1 后端
- `windows/`：创建 Edge 桌面和开机启动快捷方式

## 部署顺序

### 一、更新 GitHub 网站

把压缩包根目录中的下列文件上传到 `5214441/k8-hotel-service` 仓库根目录，并覆盖同名文件：

`index.html、style.css、app.js、admin.html、admin.css、admin.js、config.js、manifest.webmanifest、sw.js、qr.html、qr.css、qr.js、assets`

暂时不要修改 `config.js` 的 Worker 地址，等 Worker 部署成功后再改。

### 二、创建 Cloudflare D1 数据库

1. 登录 Cloudflare。
2. 进入 **Workers & Pages → D1 SQL Database**。
3. 创建数据库：`k8-hotel-tickets`。
4. 打开数据库控制台，把 `worker/schema.sql` 全部复制进去执行。

### 三、创建 Worker

1. 进入 **Workers & Pages → Create → Worker**。
2. 名称填写：`k8-hotel-tickets`。
3. 打开在线编辑器，把默认代码全部删除。
4. 将 `worker/worker.js` 全部复制进去并部署。
5. 在 Worker 的 **Settings → Bindings** 中添加 D1：
   - Variable name：`DB`
   - Database：`k8-hotel-tickets`
6. 在 **Settings → Variables and Secrets** 中添加：
   - Secret：`ADMIN_PASSWORD`，值设置为前台管理密码
   - Variable：`ALLOWED_ORIGINS`，值填写 `https://5214441.github.io`
7. 再部署一次。
8. 记下 Worker 地址，例如：
   `https://k8-hotel-tickets.你的账号.workers.dev`

### 四、填写 Worker 地址

打开 GitHub 仓库根目录的 `config.js`，把：

`https://请替换为你的Worker地址.workers.dev`

替换成真实 Worker 地址并提交。

### 五、前台 Edge 设置

1. 打开：
   `https://5214441.github.io/k8-hotel-service/admin.html`
2. 输入 `ADMIN_PASSWORD` 对应的管理密码。
3. 选择当班前台。
4. 点击“开启声音提醒”。
5. 点击“开启桌面通知”并允许。
6. 可直接双击 `windows/创建前台桌面和开机启动快捷方式.cmd`，创建桌面入口并设置开机启动。

## 测试

打开：

`https://5214441.github.io/k8-hotel-service/?room=608`

提交“两瓶矿泉水”，前台工单台应在数秒内响铃并出现608房工单。

Pages redeploy 2026-08-06
