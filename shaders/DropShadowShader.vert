#pragma header

precision highp float;

varying vec2 dropShader_TextureRatio;

void main()
{
    gl_Position = openfl_Matrix * openfl_Position;

    openfl_TextureCoordv = openfl_TextureCoord;
    dropShader_TextureRatio = 1.0 / openfl_TextureSize.xy;
}
