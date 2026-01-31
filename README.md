> NEEDED HELP: codegen 模块的 prompt 设计仍需优化

# img2ggb

将几何题目图片转换为 GeoGebra 图形的 Web 应用，部署在 Cloudflare Workers 上。

## 功能特性

1. **图片上传** - 支持拖拽上传或点击选择几何题目图片
2. **AI 智能分析** - 使用阿里云百炼 Qwen-VL 模型识别几何元素和关系
3. **命令生成** - 自动生成标准 GeoGebra 命令
4. **手动编辑** - 支持实时编辑和调整命令
5. **实时渲染** - 使用 GeoGebra Classic 渲染交互式几何图形

## 技术栈

- **后端**: Cloudflare Workers + Workers Assets
- **前端**: 原生 HTML/CSS/JavaScript
- **AI**: 阿里云百炼 Qwen-VL (通过 OpenAI SDK)
- **渲染**: GeoGebra Apps API

## 项目结构

```
img2ggb/
├── public/
│   └── index.html   # 前端页面（独立 HTML 文件）
├── src/
│   ├── index.js     # Worker 主入口和 API 路由
│   └── ai.js        # AI 图片分析模块
├── .gitignore
├── wrangler.toml
├── package.json
└── README.md
```

## 快速开始

### 1. 克隆项目并安装依赖

```bash
git clone <repository-url>
cd img2ggb
npm install
```

### 2. 配置 AI API Key

#### 本地开发

创建 `.dev.vars` 文件（在项目根目录）：

```env
AI_API_KEY=sk-your-dashscope-api-key
```

> 获取阿里云百炼 API Key：https://dashscope.console.aliyun.com/

#### 生产部署

使用 Wrangler Secrets：

```bash
npx wrangler secret put AI_API_KEY
```

### 3. 本地开发

```bash
npm run dev
```

访问 http://localhost:8787

### 4. 部署到 Cloudflare

```bash
npm run deploy
```

## API 接口

### POST /api/analyze

上传图片进行几何分析。

**请求**: `multipart/form-data`
- `image`: 图片文件（支持 PNG、JPG、WEBP）

**响应**:
```json
{
  "success": true,
  "commands": "A = (0, 0)\nB = (4, 0)\nC = (2, 3)\nPolygon(A, B, C)"
}
```

**错误响应**:
```json
{
  "error": "Analysis failed",
  "message": "详细错误信息"
}
```

## GeoGebra 命令参考

请参考 [GeoGebra 官方文档](https://wiki.geogebra.org/en/Manual)

## 配置说明

### AI 模型配置

当前使用阿里云百炼 Qwen-VL 系列模型，可在 [src/ai.js](src/ai.js) 中修改：

```javascript
const response = await openai.chat.completions.create({
    model: "qwen3-vl-flash",  // 可选: qwen-vl-max, qwen-vl-plus
    // ...
});
```

### 切换到其他 AI 服务

TODO

### GeoGebra 配置

TODO
