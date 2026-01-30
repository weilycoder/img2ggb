/**
 * AI 图片分析模块
 * 调用第三方 AI API 解析几何图片，输出 GeoGebra 命令
 */
import OpenAI from "openai";

// GeoGebra 命令生成的提示词
const SYSTEM_PROMPT = `你是一个GeoGebra命令生成器。你的唯一任务是分析几何图片并输出有效的GeoGebra命令。

严格要求：
1. 只输出GeoGebra命令，每行一条
2. 禁止包含任何解释、说明或注释
3. 禁止输出markdown代码块标记（\`\`\`）
4. 禁止输出任何非GeoGebra命令的文本
5. 命令必须按绘制顺序排列（先点，后线段、圆等）
6. 使用有意义的名称（A, B, C代表点；line1, circle1等代表其他对象）

有效的GeoGebra命令示例：
A = (0, 0)
B = (4, 0)
C = (2, 3)
Segment(A, B)
Segment(B, C)
Segment(C, A)
Circle(A, 2)
M = Midpoint(A, B)
Line(A, C)
Polygon(A, B, C)
Incircle(A, B, C)

输出示例（无任何其他内容）：
A = (0, 0)
B = (4, 0)
C = (2, 3)
Polygon(A, B, C)

现在分析图片并输出命令。严禁添加任何解释或多余文本！`;

/**
 * 调用 AI API 分析几何图片
 * @param {string} base64Image - base64 编码的图片
 * @param {string} mimeType - 图片 MIME 类型
 * @param {object} env - Cloudflare Worker 环境变量
 * @returns {string} GeoGebra 命令
 */
export async function analyzeGeometryImage(base64Image, mimeType, env) {
    const apiKey = env.AI_API_KEY;

    if (!apiKey) {
        // 如果没有配置 API Key，返回示例命令用于测试
        console.warn('AI_API_KEY not configured, returning demo commands');
        return getDemoCommands();
    }

    const openai = new OpenAI({
        apiKey: apiKey,
        baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1"
    });

    const response = await openai.chat.completions.create({
        model: "qwen3-vl-flash",
        messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: [{ type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } }] }
        ],
    });

    console.log('AI response:', response);

    const content = response.choices?.[0]?.message?.content;

    if (!content) {
        throw new Error('AI returned empty response');
    }

    return extractGeoGebraCommands(content);
}

/**
 * 从 AI 响应中提取 GeoGebra 命令
 */
function extractGeoGebraCommands(content) {
    // 移除 markdown 代码块标记
    let commands = content
        .replace(/```[\s\S]*?```/g, '')  // 移除代码块
        .replace(/^```[\w]*\n?/gm, '')   // 移除开始标记
        .replace(/\n?```\n?$/gm, '')     // 移除结束标记
        .trim();

    // 按行分割
    const lines = commands.split('\n');
    
    // 过滤：移除空行、注释行和非命令行
    const validLines = lines
        .map(line => line.trim())
        .filter(line => {
            if (!line) return false;                    // 移除空行
            if (line.startsWith('#')) return false;    // 移除注释
            if (line.startsWith('//')) return false;   // 移除注释
            if (line.startsWith('/*')) return false;   // 移除多行注释
            // 检查是否看起来像 GeoGebra 命令（包含 = 或 函数调用）
            if (!/[=\(\)]/.test(line)) return false;
            return true;
        });

    return validLines.join('\n');
}

/**
 * 返回演示用的 GeoGebra 命令
 */
function getDemoCommands() {
    return `# 未提供 API Key，以下为演示用命令
# 绘制一个三角形及其内切圆
A = (0, 0)
B = (4, 0)
C = (2, 3)
Polygon(A, B, C)
incircle = Incircle(A, B, C)
I = Center(incircle)`;
}
