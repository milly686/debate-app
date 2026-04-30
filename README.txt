AI辩论教学平台 - 部署说明
====================================

1. 获取API地址
   - 登录腾讯云控制台 (console.cloud.tencent.com)
   - 进入「云函数 SCF」服务
   - 找到你的 debate-app 函数
   - 点击「触发管理」→「访问路径」
   - 复制 HTTP触发地址（以 .service.tcloudbase.com 结尾）

2. 修改配置文件
   - 用记事本打开 config.js
   - 将第12行的地址替换为你的API地址：
     window.API_BASE = 'https://你的API地址.service.tcloudbase.com';

3. 测试API地址
   - 在浏览器打开：https://你的API地址/api/config
   - 应该返回 {"success":true,"config":null} 或类似JSON

4. 重新打包（如果修改了config.js）
   - 选中 index.html 和 config.js 两个文件
   - 右键 → 发送到 → 压缩(zipped)文件夹
   - 确保ZIP内直接是这两个文件（没有文件夹嵌套）

5. 上传到腾讯云静态托管
   - 登录腾讯云控制台
   - 进入「云开发 CloudBase」→「静态网站托管」
   - 上传ZIP文件，覆盖旧版本
   - 等待3-5分钟生效

6. 访问网站
   - 使用静态托管分配的域名（如 *.tcloudbaseapp.com）
   - 不要加任何路径，直接访问根目录

常见问题：
- 如果页面打开但显示"网络错误"：API地址不正确
- 如果页面打开空白：检查浏览器控制台（F12）的错误信息
- 如果提示"404"：确保访问的是根目录，不是子目录

联系方式：
如有问题，请参考之前的对话记录。