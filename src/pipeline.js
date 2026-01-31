/**
 * 处理流水线模块
 * 组合 OCR 和 Codegen 两个步骤
 */
import { recognizeGeometryImage } from './ocr.js';
import { generateGeoGebraCode } from './codegen.js';

/**
 * 完整的图片分析流水线
 * 第一步：OCR 识别题目内容
 * 第二步：根据识别内容生成 GeoGebra 代码
 * 
 * @param {string} base64Image - base64 编码的图片
 * @param {string} mimeType - 图片 MIME 类型
 * @param {object} env - Cloudflare Worker 环境变量
 * @returns {object} { ocrResult, commands }
 */
export async function analyzeGeometryImage(base64Image, mimeType, env) {
    // 第一步：识别题目内容
    console.log('Step 1: Recognizing image content...');
    const ocrResult = await recognizeGeometryImage(base64Image, mimeType, env);
    console.log('OCR result:', ocrResult);

    // 第二步：生成 GeoGebra 代码
    console.log('Step 2: Generating GeoGebra code...');
    const commands = await generateGeoGebraCode(ocrResult, env);
    console.log('Generated commands:', commands);

    return {
        ocrResult,
        commands
    };
}
