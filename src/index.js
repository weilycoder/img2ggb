/**
 * img2ggb - Cloudflare Worker
 * 功能：上传几何图片 -> AI 解析 -> GeoGebra 渲染
 */

// 使用新的流水线模块（分两步：OCR + 代码生成）
import { analyzeGeometryImage } from './pipeline.js';
// 旧模块已弃用但保留存档：import { analyzeGeometryImage } from './ai.js';

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

/**
 * 检查请求是否来自网页前端（而非外部程序）
 */
function isWebRequest(request) {
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');
    const requestedWith = request.headers.get('x-requested-with');

    // 检查 Origin 或 Referer 头，确保请求来自 HTTP(S) 网页
    // 外部程序（curl、Python、etc）通常不会设置这些头
    const hasOrigin = origin && (origin.startsWith('http://') || origin.startsWith('https://'));
    const hasReferer = referer && (referer.startsWith('http://') || referer.startsWith('https://'));

    // XMLHttpRequest 会设置此头，确保是浏览器发起的请求
    const isBrowserRequest = requestedWith === 'XMLHttpRequest' ||
        (hasOrigin && hasReferer);

    return isBrowserRequest || hasOrigin || hasReferer;
}

/**
 * 获取信任的源列表（支持配置）
 */
function getTrustedOrigins(env) {
    const defaultOrigins = [
        'http://localhost:*',
        'http://127.0.0.1:*',
        'https://*.workers.dev'
    ];

    const configuredOrigins = env.TRUSTED_ORIGINS
        ? env.TRUSTED_ORIGINS.split(',').map(o => o.trim())
        : [];

    return [...defaultOrigins, ...configuredOrigins];
}

/**
 * 检查源是否在信任列表中
 */
function isOriginTrusted(origin, trustedOrigins) {
    if (!origin) return false;

    return trustedOrigins.some(trusted => {
        if (trusted.includes('*')) {
            const pattern = trusted
                .replace(/\./g, '\\.')
                .replace(/\*/g, '.*');
            const regex = new RegExp(`^${pattern}$`);
            return regex.test(origin);
        }
        return origin === trusted;
    });
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

    // 验证请求来源：只允许网页前端请求
    if (!isWebRequest(request)) {
        console.warn('Rejected non-web request:', {
            origin: request.headers.get('origin'),
            referer: request.headers.get('referer'),
            userAgent: request.headers.get('user-agent')
        });
        return new Response(JSON.stringify({
            error: 'Access denied',
            message: 'This API can only be called from a web browser'
        }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // 验证 Origin 是否在信任列表中
    const origin = request.headers.get('origin');
    const trustedOrigins = getTrustedOrigins(env);

    // 如果有 Origin 头，必须在信任列表中
    if (origin && !isOriginTrusted(origin, trustedOrigins)) {
        console.warn('Rejected request from untrusted origin:', origin);
        return new Response(JSON.stringify({
            error: 'Access denied',
            message: 'Origin not trusted'
        }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // 如果是 CORS 预检请求 (OPTIONS)，拦截
    if (request.method === 'OPTIONS') {
        console.warn('Rejected OPTIONS request');
        return new Response(null, { status: 403 });
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

        // 调用 AI 分析图片（两步流水线）
        const result = await analyzeGeometryImage(base64Image, mimeType, env);

        return new Response(JSON.stringify({
            success: true,
            ocrResult: result.ocrResult,  // 返回 OCR 识别结果（可选，便于调试）
            commands: result.commands
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
