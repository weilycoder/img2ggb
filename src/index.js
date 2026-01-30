/**
 * img2ggb - Cloudflare Worker
 * 功能：上传几何图片 -> AI 解析 -> GeoGebra 渲染
 */

import { analyzeGeometryImage } from './ai.js';

/**
 * ArrayBuffer 转 Base64（分块处理，避免栈溢出）
 */
function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 8192;
    let binary = '';
    
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, chunk);
    }
    
    return btoa(binary);
}

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // 只处理 API 路由，静态文件由 assets 自动处理
        if (url.pathname === '/api/analyze') {
            return handleAnalyze(request, env);
        }

        // 其他路径返回 404（或让 assets 处理）
        return new Response('Not Found', { status: 404 });
    }
};

/**
 * 处理图片分析请求
 */
async function handleAnalyze(request, env) {
    // 只允许 POST 请求
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const formData = await request.formData();
        const imageFile = formData.get('image');

        if (!imageFile) {
            return new Response(JSON.stringify({ error: 'No image provided' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 将图片转换为 base64（分块处理避免栈溢出）
        const arrayBuffer = await imageFile.arrayBuffer();
        const base64Image = arrayBufferToBase64(arrayBuffer);
        const mimeType = imageFile.type || 'image/png';

        // 调用 AI 分析图片
        const geogebraCommands = await analyzeGeometryImage(base64Image, mimeType, env);

        return new Response(JSON.stringify({
            success: true,
            commands: geogebraCommands
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Analysis error:', error);
        return new Response(JSON.stringify({
            error: 'Analysis failed',
            message: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
