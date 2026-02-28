#pragma header

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

const float edgeSoftness = 1.0 / 16.0;

const vec3 grayscaleValues = vec3(0.3098, 0.6078, 0.0823);
const vec3 lumaValue = vec3(0.2126, 0.7152, 0.0722);

const float rgb_samples_norm = 1.0 / 3.0;
const float edgeThreshold = 0.10;

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

float getGrayTex(vec2 uv)
{
    return getGrayRGB(texture2D(bitmap, uv).rgb);
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

#define cenW 2.0
#define croW 4.0
#define diaW 8.0
#define samples(n) (cenW + (croW * 4.0 + diaW * 4.0) * n)

float grayAA(float c, vec2 uv, vec2 ratio, vec2 size)
{
    if (AA_STAGES <= 1.0)
        return c;

    vec2 l   = uv + vec2(-1.0,  0.0) * ratio;
    vec2 r   = uv + vec2( 1.0,  0.0) * ratio;
    vec2 u   = uv + vec2( 0.0, -1.0) * ratio;
    vec2 d   = uv + vec2( 0.0,  1.0) * ratio;

    vec2 ul   = uv + vec2(-1.0, -1.0) * ratio;
    vec2 ur   = uv + vec2( 1.0, -1.0) * ratio;
    vec2 dl   = uv + vec2(-1.0,  1.0) * ratio;
    vec2 dr   = uv + vec2( 1.0,  1.0) * ratio;

    float sum = c * cenW;

    sum += getGrayTex(l) * croW;
    sum += getGrayTex(r) * croW;
    sum += getGrayTex(u) * croW;
    sum += getGrayTex(d) * croW;

    sum += getGrayTex(ul) * diaW;
    sum += getGrayTex(ur) * diaW;
    sum += getGrayTex(dl) * diaW;
    sum += getGrayTex(dr) * diaW;

    return sum * (1.0 / samples(1.0));
}

// ============================
// DROP SHADOW / RIM
// ============================

vec4 createDropShadowEx(vec2 uv, vec2 ratio, vec2 size)
{
    vec4 color4 = texture2D(bitmap, uv);

    vec3 color3_no_effect = color4.a > 0.0 ? color4.rgb / color4.a : color4.rgb;
    vec3 color3 = applyHSBCEffect(color3_no_effect);

    float color3_light = getGrayRGB(color3_no_effect);
    float threshold = getThreshold(uv);

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

    float intensity = smoothstep(threshold - edgeThreshold, threshold + edgeThreshold, grayAA(color3_light, uv, ratio, size));
    float rim = (1.0 - (shadowAlpha * str)) * intensity;

    color3 += dropColor * rim;

    return vec4(color3 * color4.a, color4.a);
}

// ============================
// MAIN
// ============================

void main()
{
    gl_FragColor = createDropShadowEx(openfl_TextureCoordv, 1.0 / openfl_TextureSize.xy, openfl_TextureSize.xy);
}
