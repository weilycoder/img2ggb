/**
 * 代码生成模块 - 第二个 AI
 * 负责根据识别的题目内容生成 GeoGebra 命令
 */
import OpenAI from "openai";

// GeoGebra 代码生成的提示词
const CODEGEN_PROMPT = `你是GeoGebra命令生成器。你的任务是根据提供的几何题目描述，生成GeoGebra命令使其完整体现题目中的所有几何关系。

[目标]
学生用这个工具来直观验证几何关系，包括动点、动直线等。你必须：
1. 体现题目中给出的所有几何元素（点、线、圆、多边形等）
2. 体现题目中给出的所有几何关系（相等、垂直、平行、相切、相交等）
3. 计算坐标和参数使这些关系成立（例如求交点坐标、计算满足条件的点位置），而不是使用限制条件描述
4. 尽可能不使用参数方程或函数来描述几何对象，优先使用基本几何构造命令，例如抛物线使用 Parabola(<Point>, <Line>) 命令
5. 对于动点/动直线，使用Slider等方法使其可动态调整
6. 输出的命令必须能在GeoGebra中直接运行，且不包含任何语法错误

[严格输出格式]
1. 只输出GeoGebra命令，每行一条
2. 禁止包含任何计算过程、推导、解答、说明或注释
3. 禁止输出markdown代码块标记（\`\`\`）
4. 禁止输出任何非GeoGebra命令的文本
5. 命令按绘制顺序排列（先点，再线/圆，再构造与测量）
6. 命名规范：点 A,B,C...；线 line1,line2...；圆 circle1,circle2...

[命令来源要求]
严格要求：只能使用下面【命令清单】中列出的命令和语法
禁止：使用清单外的任何GeoGebra命令
禁止：自己编造或想象命令
禁止：使用你认为"可能存在"的命令变体
如果题目需要的操作在清单中找不到，请输出空结果（如果无法实现）

[禁止输出]
- 计算过程："根据勾股定理..."
- 文字说明："图中有三角形ABC"
- 最终答案："所以AB=5"
- 任何解释性文本

[输出示例（无任何其他内容）]
A = Point({0, 0})
B = Point({4, 0})
C = Point({2, 3})
Segment(A, B)
Segment(B, C)
Segment(C, A)
Polygon(A, B, C)

[命令清单（只能从这里选择）]

[点 (Point)]
- Point({x, y})
- Point(<Object>)
- Intersect(<Object>, <Object>)

[直线 (Line)]
- Line(<Point>, <Point>)：通过两点创建直线
- Line(<Point>, <Line>)：通过点和平行线创建直线

[线段 (Segment)]
- Segment(<Point>, <Point>)：通过两点创建线段
- Segment(<Point>, <Number>)：从点出发，按指定长度创建线段（终点可以被用户拖动）

[圆 (Circle)]
- Circle(<Point>, <Number>)：以点为圆心，指定半径创建圆
- Circle(<Point>, <Segment>)：以点为圆心，线段长度为半径创建圆
- Circle(<Point>, <Point>)：以两点为圆心和圆上点创建圆
- Circle(<Point>, <Point>, <Point>)：通过三点创建圆

[圆锥曲线 (Conic)]
- Focus(<Conic>)：获取圆锥曲线的焦点
- Ellipse(<Point>, <Point>, <Number>)：以两点为焦点，指定数值为半长轴创建椭圆
- Ellipse(<Point>, <Point>, <Point>)：以两点为焦点，通过第三点创建椭圆
- Hyperbola(<Point>, <Point>, <Number>)：以两点为焦点，指定数值为半实轴创建双曲线
- Hyperbola(<Point>, <Point>, <Point>)：以两点为焦点，通过第三点创建双曲线
- Parabola(<Point>, <Line>)：以点为焦点，线为准线创建抛物线

[曲线]
- Curve(<ExpressionX>, <ExpressionY>, <Parameter>, <Start>, <End>)：通过参数方程创建曲线

[多边形 (Polygon)]
- Polygon(<Point>, <Point>, <Point>, ...)：通过多个点创建多边形

[函数 (Function)]
- Function(<Expression>, <Number>, <Number>)：创建函数，指定表达式和定义域，无穷大可用 inf

[其他常用命令]
- Midpoint(<Point>, <Point>)：计算两点的中点
- Midpoint(<Segment>)：计算线段的中点
- Incircle(<Point>, <Point>, <Point>)：创建三角形的内切圆
- PerpendicularLine(<Point>, <Line>)：通过点创建垂线
- Slider(<Min>, <Max>, <Increment>)：创建滑块，该滑块可用于动态调整参数

现在根据题目描述输出命令。严禁输出任何非命令文本，严禁使用清单外的命令！`;

/**
 * 调用 AI 生成 GeoGebra 命令
 * @param {string} problemDescription - 题目描述（来自 OCR 模块的输出）
 * @param {object} env - Cloudflare Worker 环境变量
 * @returns {string} GeoGebra 命令
 */
export async function generateGeoGebraCode(problemDescription, env) {
    const apiKey = env.AI_API_KEY;
    const testMode = env.TEST_MODE === 'true';

    if (!apiKey || testMode) {
        console.warn('AI_API_KEY not configured or test mode enabled, returning demo commands');
        return getDemoCommands();
    }

    const openai = new OpenAI({
        apiKey: apiKey,
        baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1"
    });

    const response = await openai.chat.completions.create({
        model: "deepseek-r1",
        messages: [
            { role: 'system', content: CODEGEN_PROMPT },
            { role: 'user', content: problemDescription }
        ],
    });

    console.log('Codegen AI response:', response);

    const message = response.choices?.[0]?.message;

    // DeepSeek R1 模型可能把内容放在 reasoning_content 中
    // 优先使用 content，如果为空则尝试 reasoning_content
    let content = message?.content;

    // 如果 content 为空，尝试从 reasoning_content 提取
    if (!content && message?.reasoning_content) {
        console.log('Using reasoning_content as fallback');
        content = message.reasoning_content;
    }

    if (!content) {
        console.error('Message object:', JSON.stringify(message, null, 2));
        throw new Error('Codegen AI returned empty response');
    }

    return extractGeoGebraCommands(content);
}

/**
 * 从 AI 响应中提取 GeoGebra 命令
 */
function extractGeoGebraCommands(content) {
    let commands = content
        .replace(/```[\s\S]*?```/g, '')
        .replace(/^```[\w]*\n?/gm, '')
        .replace(/\n?```\n?$/gm, '')
        .trim();

    const lines = commands.split('\n');

    const validLines = lines
        .map(line => line.trim())
        .filter(line => {
            if (!line) return false;
            if (line.startsWith('#')) return false;
            if (line.startsWith('//')) return false;
            if (line.startsWith('/*')) return false;
            if (!/[=\(\)]/.test(line)) return false;
            return true;
        });

    return validLines.join('\n');
}

/**
 * 返回演示用的 GeoGebra 命令
 */
function getDemoCommands() {
    return `B = Point({0, 0})
A = Point({0, 4})
C = Point({3, 0})
D = Midpoint(B, C)
Segment(A, B)
Segment(B, C)
Segment(C, A)
Segment(A, D)
Polygon(A, B, C)`;
}
