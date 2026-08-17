# 立项裁判

把「拍脑袋立项」变成「看证据立项」。每一次评级产出一份可追溯的 SABC 判决书。

## 别人电脑一键安装（不用先装 Node / Git）

把仓库里的安装脚本拷到对方电脑，双击即可。脚本会自动安装 Node.js、下载项目、安装依赖并启动。

- **Mac**：双击 `一键安装.command`。若提示“无法打开”，按 **右键 → 打开**。安装 Node 时会要一次本机密码。
- **Windows**：双击 `一键安装.bat`，在弹出的窗口里允许管理员权限。

启动后按提示粘贴 OpenLux API Key，浏览器会打开 http://localhost:3000

也可以只发这两个脚本文件；对方电脑有网时会自动从 GitHub 拉取源码。

## 启动

已有代码时：

```bash
npm install
npm run dev
```

打开 http://localhost:3000

模型已接到 OpenLux 的 `gpt-5.6-sol`（`https://api.openlux.ai/v1`）。密钥写在 `.env.local`，不要提交到 git。

## 环境变量

| 变量 | 说明 |
|---|---|
| `LLM_BASE_URL` | 默认 `https://api.openlux.ai/v1` |
| `LLM_API_KEY` | OpenLux API Key |
| `LLM_MODEL` | 默认 `gpt-5.6-sol` |
| `BOCHA_API_KEY` | 可选。博查 Web Search，申请：https://open.bochaai.com/ |
| `ANYSEARCH_API_KEY` | AnySearch，申请：https://anysearch.com/console/api-keys |

| `KB_CHUNK_MODEL` | 知识库切片，默认 `gpt-5.6-luna` |
| `EMBEDDING_MODEL` | 向量模型，默认 `gemini-embedding-2-preview` |
| `QDRANT_URL` | 全量库，默认 `http://127.0.0.1:6333`；Docker 未启动时写入本地 `data/kb/qdrant-full.jsonl` |

知识库：`/knowledge` 拖入文档/图片/视频 → Luna 切片 → embedding → **FAISS 热缓存 + Qdrant 全量**。提问与评级时 **BM25 + FAISS** 双路融合。

可选拉起 Qdrant：`docker compose up -d qdrant`（需 Docker 守护进程）。

切换国内模型：改这三行即可。

## 三幕

1. **受理** `/` — 对话 + 上传 PDF/Word/PPT，最多追问两轮
2. **取证直播** `/evaluation/[id]/research` — SSE 推送检索、交叉验证、顾问交锋
3. **宣判** `/evaluation/[id]/verdict` — 大字评级 + 三层判决书

二级页：`/knowledge` 公司档案（可跳过）、`/projects` 卷宗与对比、`/example` 预置示例判决。

内测期为本地单公司，未做手机号登录。
