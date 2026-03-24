#pragma header

#ifdef GL_ES
// Funkin crew fix this!
//    #ifdef GL_OES_standard_derivatives
//        #define HAS_DERIVATIVES
//    #endif
#else
    #if __VERSION__ >= 130
        #define HAS_DERIVATIVES
    #elif defined(GL_ARB_derivative_control)
        #define HAS_DERIVATIVES
    #endif
#endif

// This shader aims to mostly recreate how Adobe Animate/Flash handles drop shadows, but its main use here is for rim lighting.

// this shader also includes a recreation of the Animate/Flash "Adjust Color" filter,
// which was kindly provided and written by Rozebud https://github.com/ThatRozebudDude ( thank u rozebud :) )
// Adapted from Andrey-Postelzhuks shader found here: https://forum.unity.com/threads/hue-saturation-brightness-contrast-shader.260649/
// Hue rotation stuff is from here: https://www.w3.org/TR/filter-effects/#feColorMatrixElement

// equals (frame.left, frame.top, frame.right, frame.bottom)
uniform vec4 uFrameBounds;

uniform float ang;
uniform float dist;
uniform float str;
uniform float thr;
uniform float angOffset;

uniform float angCos;
uniform float angSin;

uniform sampler2D altMask;
uniform bool useMask;
uniform float thr2;

uniform vec3 dropColor;

uniform mat3 hueMatrix;
uniform float contrast;
uniform mat3 saturationMatrix;
uniform float brightness;

uniform float AA_STAGES;

varying vec2 dropShader_TextureRatio;

const vec3 grayscaleValues = vec3(0.3098, 0.6078, 0.0823);
const vec3 lumaValue = vec3(0.2126, 0.7152, 0.0722);

// ============================
// FAST COLOR ADJUST
// ============================

vec3 applyHSBCEffect(vec3 color)
{
    vec3 bh = (brightness + color) * hueMatrix;
    vec3 c = (bh - 0.25) * contrast + 0.25;
    vec3 s = c * saturationMatrix;

    return s;
}

float getGrayRGB(vec3 color)
{
    return dot(color.rgb, grayscaleValues);
}

float getLumaRGB(vec3 color)
{
    return dot(color.rgb, lumaValue);
}

vec4 getTexRGBA(vec2 uv)
{
    return texture2D(bitmap, uv);
}

float getGrayTex(vec2 uv)
{
    return getGrayRGB(getTexRGBA(uv).rgb);
}

float getLumaTex(vec2 uv)
{
    return getLumaRGB(getTexRGBA(uv).rgb);
}

vec3 normalizeRGB(vec3 color)
{
    vec3 result = color;
    float maxChannel = max(color.r, max(color.g, color.b));

    if (maxChannel > 1.0)
        result *= 1.0 / maxChannel;

    return result;
}

// ============================
// THRESHOLD
// ============================

float getThreshold(vec2 uv)
{
    float threshold = thr;
    float maskIntensity = 0.0;

    if (useMask)
    {
        maskIntensity = texture2D(altMask, uv).b;
        if (maskIntensity > 0.0)
            threshold = thr2;
    }

    return threshold;
}

float lwidth_manual(float center, vec2 uv, vec2 px)
{
    if (AA_STAGES <= 1.0)
        return 0.0;

    vec3 p2x1 = getTexRGBA(uv + vec2( 1.0,  0.0) * px).rgb;
    vec3 p1x2 = getTexRGBA(uv + vec2( 0.0,  1.0) * px).rgb;
    vec3 p2x2 = getTexRGBA(uv + vec2( 1.0,  1.0) * px).rgb;

    float right     = getLumaRGB(p2x1);
    float down      = getLumaRGB(p1x2);
    float diagonal  = getLumaRGB(p2x2);

    float dx = abs(right - center);
    float dy = abs(down - center);
    float dd = abs(diagonal - center);

    float delta = ((dx + dy + dd * 0.7) / (1.0 + 1.0 + 0.7)) * 2.0;

    return delta;
}

// ============================
// DROP SHADOW / RIM
// ============================

vec4 createDropShadowEx(vec2 uv, vec2 ratio, vec2 size)
{
    vec4 color4 = texture2D(bitmap, uv);

#ifdef HAS_DERIVATIVES
    vec2 px = fwidth(uv);
#else
    vec2 px = ratio;
#endif

    float color3_light = getLumaRGB(color4.rgb);
    float delta = lwidth_manual(color3_light, uv, px);

    vec3 color3_no_effect = color4.a > 0.0 ? color4.rgb / color4.a : color4.rgb;
    vec3 color3 = applyHSBCEffect(color3_no_effect);

    float threshold = max(getThreshold(uv) - 0.05, 0.0);
    float intensity = smoothstep(threshold - delta, threshold + delta, color3_light);

    vec2 checked = vec2(
        uv.x + (dist * angCos * ratio.x),
        uv.y - (dist * angSin * ratio.y)
    );

    float shadowAlpha = 0.0;

    if (checked.x > uFrameBounds.x &&
        checked.y > uFrameBounds.y &&
        checked.x < uFrameBounds.z &&
        checked.y < uFrameBounds.w)
    {
        shadowAlpha = texture2D(bitmap, checked).a;
    }

    float rim = (1.0 - (shadowAlpha * str)) * intensity;

    color3 += dropColor * rim;

    return vec4(color3 * color4.a, color4.a);
}

// ============================
// MAIN
// ============================

void main()
{
    gl_FragColor = createDropShadowEx(openfl_TextureCoordv, dropShader_TextureRatio, openfl_TextureSize.xy);
}
