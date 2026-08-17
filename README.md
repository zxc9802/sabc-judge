# 立项裁判

把「拍脑袋立项」变成「看证据立项」。每一次评级产出一份可追溯的 SABC 判决书。

## 一条命令安装（其他电脑）

其他电脑已登录同一 GitHub 账号（`gh auth login`）后，执行：

```bash
gh repo clone zxc9802/sabc-judge && cd sabc-judge && cp .env.example .env.local && npm install && npm run dev
```

然后编辑 `.env.local` 填入 `LLM_API_KEY`（以及可选的博查 / AnySearch 密钥），打开 http://localhost:3000

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
