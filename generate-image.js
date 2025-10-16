// Vercel/Netlify Serverless Function
// Hugging Face 무료 API를 사용한 이미지 생성

export default async function handler(req, res) {
    // CORS 설정
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { prompt, type = 'character', size = '512x512' } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        // Hugging Face API 키 (환경 변수에서 가져오기)
        const HF_API_KEY = process.env.HUGGING_FACE_API_KEY;

        if (!HF_API_KEY) {
            return res.status(500).json({ error: 'API key not configured' });
        }

        // 타입별 최적화된 프롬프트
        const optimizedPrompt = optimizePrompt(prompt, type);

        // Hugging Face 모델 선택
        const modelUrl = getModelUrl(type);

        console.log('Generating image:', { type, modelUrl, prompt: optimizedPrompt });

        // Hugging Face API 호출
        const response = await fetch(modelUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${HF_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                inputs: optimizedPrompt,
                options: {
                    wait_for_model: true
                }
            })
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('Hugging Face API error:', error);
            return res.status(response.status).json({ 
                error: 'Image generation failed',
                details: error 
            });
        }

        // 이미지 데이터 가져오기
        const imageBuffer = await response.arrayBuffer();
        const base64Image = Buffer.from(imageBuffer).toString('base64');

        // Base64 이미지 반환
        return res.status(200).json({
            success: true,
            image: `data:image/png;base64,${base64Image}`,
            prompt: optimizedPrompt
        });

    } catch (error) {
        console.error('Error generating image:', error);
        return res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
}

// 타입별 모델 URL 선택
function getModelUrl(type) {
    const models = {
        // 픽셀아트 - 캐릭터, 타일셋, 오브젝트용
        character: 'https://api-inference.huggingface.co/models/nerijs/pixel-art-xl',
        tileset: 'https://api-inference.huggingface.co/models/nerijs/pixel-art-xl',
        object: 'https://api-inference.huggingface.co/models/nerijs/pixel-art-xl',
        
        // 일반 이미지 - 포스터, 배경용
        poster: 'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2-1',
        background: 'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2-1'
    };

    return models[type] || models.character;
}

// 프롬프트 최적화
function optimizePrompt(prompt, type) {
    const optimizations = {
        character: `pixel art, 2D game character, ${prompt}, transparent background, simple design, 64x64 sprite, top-down view, clean lines, vibrant colors`,
        
        tileset: `pixel art, seamless tileable texture, ${prompt}, 48x48 tile, game asset, repeatable pattern, top-down view, clean pixel art`,
        
        object: `pixel art, 2D game object, ${prompt}, transparent background, isometric view, simple design, game asset, clean pixels`,
        
        poster: `digital art, poster design, ${prompt}, high quality, detailed, vibrant colors, professional`,
        
        background: `digital art, background scene, ${prompt}, wide shot, detailed environment, atmospheric, high quality`
    };

    return optimizations[type] || prompt;
}
