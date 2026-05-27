# R2 读诗音频配置

读诗音频存放在私有 R2 bucket 中，通过 Cloudflare Worker 代理访问，避免把 R2 公共对象地址直接写进页面。

## 已创建的资源

- R2 bucket：`syaoran-poetry-audio`
- Worker：`syaoran-poetry-audio`
- Worker 地址：`https://syaoran-poetry-audio.iicatlolier.workers.dev`
- 短链接域名：`https://videos.syaoran.me/poetry/*`
- 已配置但当前未生效的 route：`blog.syaoran.me/audio/*`

`blog.syaoran.me/audio/*` 当前仍返回 GitHub Pages，是因为 `blog.syaoran.me` 没有经过 Cloudflare 代理。等这个 DNS 记录切到 Cloudflare orange cloud 后，该路径才会触发 Worker。

## 上传音频

Worker 配置里 `AUDIO_PREFIX` 是 `poetry/`，所以：

```bash
bunx wrangler r2 object put syaoran-poetry-audio/poetry/test-reading.mp3 --file ./test-reading.mp3
```

当前可用的页面音频地址写：

```yaml
audioUrl: "https://videos.syaoran.me/poetry/test-reading.mp3"
audioType: "audio/mpeg"
```

如果短链接域名临时不可用，可以退回 Worker 地址：

```yaml
audioUrl: "https://syaoran-poetry-audio.iicatlolier.workers.dev/poetry/test-reading.mp3"
audioType: "audio/mpeg"
```

## 防盗刷策略

Worker 会在返回音频前检查来源：

- 允许 `https://blog.syaoran.me`
- 允许 `https://videos.syaoran.me`
- 允许 `https://iiwenwen.github.io`
- 允许本地开发地址 `http://localhost:*`、`http://127.0.0.1:*` 和 `http://[::1]:*`
- 无来源或非允许来源访问会返回 `403`

Worker 支持音频播放所需的 `Range` 请求，并返回 `Accept-Ranges`、`Content-Range`、`ETag` 和缓存头。

## 部署命令

```bash
bun run audio:deploy
```

## 本地开发

```bash
bun run audio:dev
```
