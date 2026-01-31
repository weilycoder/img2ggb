/**
 * OCR 模块 - 第一个 AI
 * 负责识别几何题目图片中的所有内容（文字、图形元素、几何关系）
 */
import OpenAI from "openai";

// 题目识别的提示词
const OCR_PROMPT = `你是一个 OCR 识别工具。你的任务是识别学生上传的几何题目图片中的文字内容，并原样输出。

[输出要求]
1. 使用 OCR 识别图片中的所有文字，完整、准确地输出题目原文
2. 如果图中有几何图形，但题目文字中未明确说明图形的构成，则在题目原文后简要描述图中的几何元素（如"图中包含三角形ABC，点D在BC上"）
3. 保持客观描述，只说明"看到了什么"，不做任何分析、推理或解释

[输出格式]
题目原文：
（OCR 识别的文字内容）

图形补充说明：
（如果文字已完整描述题目，此部分可省略；否则简要说明图中可见的几何元素）

[禁止事项]
- 禁止分析几何关系
- 禁止输出解题提示或建议
- 禁止对题目进行分类整理
- 禁止输出与识别无关的任何内容

请严格按照上述要求输出，确保后续处理不受干扰。`;

/**
 * 调用 AI 识别几何题目图片
 * @param {string} base64Image - base64 编码的图片
 * @param {string} mimeType - 图片 MIME 类型
 * @param {object} env - Cloudflare Worker 环境变量
 * @returns {string} 识别结果（结构化文本）
 */
export async function recognizeGeometryImage(base64Image, mimeType, env) {
    const apiKey = env.AI_API_KEY;
    const testMode = env.TEST_MODE === 'true';

    if (!apiKey || testMode) {
        console.warn('AI_API_KEY not configured or test mode enabled, returning demo result');
        return getDemoOcrResult();
    }

    const openai = new OpenAI({
        apiKey: apiKey,
        baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1"
    });

    const response = await openai.chat.completions.create({
        model: "qwen3-vl-plus",
        messages: [
            { role: 'system', content: OCR_PROMPT },
            { role: 'user', content: [{ type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } }] }
        ],
    });

    console.log('OCR AI response:', response);

    const content = response.choices?.[0]?.message?.content;

    if (!content) {
        throw new Error('OCR AI returned empty response');
    }

    return content;
}

/**
 * 返回演示用的识别结果
 */
function getDemoOcrResult() {
    return `题目原文：
如图，在三角形ABC中，AB = 4，BC = 3，角ABC = 90°。点D是BC的中点，求AD的长度。

图形补充说明：
图中包含三角形ABC和点D，其中D位于边BC上。`;
}
