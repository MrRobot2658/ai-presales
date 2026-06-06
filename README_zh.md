# aipresales

基于 [Hermes Agent](https://github.com/NousResearch/hermes-agent) 的 AI 售前 CRM 系统。

[English](./README.md)

---

## 功能

### 商机概览

- KPI 看板：商机总数、本月新增、跟进中数量
- AI 匹配度排行
- 行业与地域分布统计
- 按优先级展示的 AI 跟进建议

### 商机列表

- CRM 线索列表，包含公司、联系人、行业、来源等字段
- 支持通过 API 创建与更新商机
- 单条商机的 AI 匹配洞察
- 企业画像洞察
- 从商机一键生成售前方案 / PPT

### 知识库

- 上传 PDF、PPT、DOCX 等文档
- 后台 Agent 自动清洗，无需人工审核
- 状态流转：`processing` → `ready` / `failed`
- 清洗进行中前端自动轮询刷新
- 清洗结果保存为 Markdown，并生成分块便于检索

### 内容管理

- 展示 `content/ppt/` 目录下的 PPT（含 Agent 直接生成的文件）
- 下载任意已完成文档
- **继续编辑** — 打开文件后由 Hermes Agent 协助修改
- 编辑过程中显示遮罩，右侧面板可继续下达修改指令
- 支持 Word / PPT 生成流程的草稿元数据管理

### Agent 集成

每个租户 Profile 内置售前 manifest 与 Skill，Hermes Agent 可以：

- 读取和更新商机列表
- 查询知识库资产与清洗后的内容
- 创建内容草稿，并将 PPT 写入 `content/ppt/`
- 调用售前 BFF API，或直接读写 Profile 目录文件

**Profile 数据目录：**

```text
presales/
  manifest.json          # API 与目录映射
  opportunities.json     # 商机列表（数据源）
content/
  ppt/                   # 生成的 PPT（内容管理默认目录）
  word/                  # 生成的 Word 文档
  drafts/                # 草稿元数据
  knowledge/
    raw/{assetId}/       # 上传的原始文件
    processed/{assetId}/ # Agent 清洗后的 Markdown
skills/presales/         # 售前 Agent Skill
```

### 多租户

- 1 租户 = 1 Hermes Profile = N 个 Web UI 账号
- 全部售前数据按 Profile 隔离
- BFF 解析租户上下文，所有 API 按当前 Profile 作用域执行
