# R2 读诗音频配置

读诗音频存放在私有 R2 bucket 中，通过 Cloudflare Worker 代理访问，避免把 R2 公共对象地址直接写进页面。

## 已创建的资源

- R2 bucket：`syaoran-poetry-audio`
- Worker：`syaoran-poetry-audio`
- Worker 的 `workers.dev` 公共地址和版本预览地址均已关闭
- 短链接域名：`https://videos.syaoran.me/poetry/*`
- 已配置但当前未生效的 route：`blog.syaoran.me/audio/*`

`blog.syaoran.me/audio/*` 当前仍返回 GitHub Pages，是因为 `blog.syaoran.me` 没有经过 Cloudflare 代理。等这个 DNS 记录切到 Cloudflare orange cloud 后，该路径才会触发 Worker。

## 上传音频

使用项目命令上传音频，并自动把 `audioUrl`、`audioType` 和可选的 `duration` 写回诗歌 Markdown：

```bash
bun run audio:publish ./我的朗读.mp3 src/content/poetry/2022-06-27-hthbu7gt5yckqbyj4hfuat.md 01:32
```

脚本使用诗歌 Markdown 文件名作为对象名。例如上面的文件会上传到：

```text
r2://syaoran-poetry-audio/poetry/2022-06-27-hthbu7gt5yckqbyj4hfuat.mp3
```

页面访问地址会自动写成：

```text
https://videos.syaoran.me/poetry/2022-06-27-hthbu7gt5yckqbyj4hfuat.mp3
```

支持 `mp3`、`m4a`、`wav`、`ogg`、`oga`、`webm` 和 `flac`。上传成功后才修改 Markdown，避免页面引用不存在的对象。

Wrangler 统一通过 `bunx wrangler@latest` 运行，不写入项目依赖。当前机器环境中的旧 `CLOUDFLARE_API_TOKEN` 权限不足，因此项目命令会忽略它并使用 Wrangler OAuth 登录态。

## 防盗刷策略

Worker 会在返回音频前执行分层防护：

- 允许 `https://blog.syaoran.me`
- 允许 `https://videos.syaoran.me`
- 允许 `https://iiwenwen.github.io`
- 允许本地开发地址 `http://localhost:*`、`http://127.0.0.1:*` 和 `http://[::1]:*`
- 无来源或非允许来源访问会返回 `403`
- 不再仅凭可伪造的 `Sec-Fetch-Site` 请求头放行
- 在每个 Cloudflare 机房内，按客户端 IP 约 120 次/分钟执行目标限速
- 在每个 Cloudflare 机房内，全部音频请求约 600 次/分钟执行目标限速
- 超出限额返回 `429`，不会继续读取 R2
- 缓存键会忽略查询参数，避免攻击者用随机查询字符串绕过缓存
- 完整音频写入边缘缓存，后续 `Range` 请求由缓存切片，减少 R2 Class B 操作
- 非法或多段 `Range` 请求在读取 R2 前返回 `416`

Worker 支持音频播放所需的单段 `Range` 请求，并返回 `Accept-Ranges`、`Content-Range`、`ETag`、`X-Audio-Cache` 和缓存头。`X-Audio-Cache` 的值为 `HIT`、`MISS` 或缓存失败时的 `BYPASS`。

Rate Limiting binding 按 Cloudflare 机房本地计数，并采用宽松、最终一致的计数方式，因此上述数值是防滥用目标阈值，不是全球严格上限。

`syaoran.me` 的区域级 WAF 还会在 Worker 执行前，对 `img.syaoran.me` 与 `videos.syaoran.me` 按 IP 和机房执行 20 次/10 秒限速，超限阻断 10 秒。Free 套餐只有一条区域限速规则，因此图片与音频共用该规则。

Cache Rules 中已为 `videos.syaoran.me` 设置 `cache: false`，强制入口绕过 CDN 缓存并执行 Worker。不能启用 Worker 的入口级原生缓存：线上验证表明它可能在 Worker 来源检查前返回已缓存响应。音频只使用 Worker 内部 Cache API；所有请求必须先经过来源检查和代码内限速。

## 部署命令

```bash
bun run audio:deploy
```

## 本地开发

```bash
bun run audio:dev
```

## 检查 R2 状态

```bash
bun run audio:r2:info
```
