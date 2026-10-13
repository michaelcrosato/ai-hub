#version 300 es

// Three.js r181 - Node System


// extensions


// precision

precision highp float;
precision highp int;
precision highp sampler2D;
precision highp sampler3D;
precision highp samplerCube;
precision highp sampler2DArray;

precision highp usampler2D;
precision highp usampler3D;
precision highp usamplerCube;
precision highp usampler2DArray;

precision highp isampler2D;
precision highp isampler3D;
precision highp isamplerCube;
precision highp isampler2DArray;

precision lowp sampler2DShadow;
precision lowp sampler2DArrayShadow;
precision lowp samplerCubeShadow;


// structs

layout( location = 0 ) out vec4 fragColor;



// uniforms

layout( std140 ) uniform fragment_object {
	float f_nodeUniform0;
	vec2 f_nodeUniform2;
	uint f_nodeUniform3;
	float f_nodeUniform4;
	uint f_nodeUniform5;
	uint f_nodeUniform7;
	uint f_nodeUniform8;
};
uniform sampler2D nodeUniform1;
uniform sampler2D nodeUniform6;

// varyings
in vec2 nodeVarying3;


// codes
vec3 sRGBTransferOETF ( vec3 color ) {

	


	return mix( ( ( pow( color, vec3( 0.41666 ) ) * vec3( 1.055 ) ) - vec3( 0.055 ) ), ( color * vec3( 12.92 ) ), vec3( lessThanEqual( color, vec3( 0.0031308 ) ) ) );

}



void main() {

	// vars
	vec4 nodeVar0;
	vec2 nodeVar1;
	ivec2 nodeVar2;
	ivec2 nodeVar3;
	bool nodeVar4;
	vec4 nodeVar5;
	vec2 nodeVar6;
	ivec2 nodeVar7;
	ivec2 nodeVar8;
	bool nodeVar9;
	vec4 nodeVar10;
	ivec2 nodeVar11;
	ivec2 nodeVar12;
	bool nodeVar13;
	vec4 nodeVar14;
	ivec2 nodeVar15;
	ivec2 nodeVar16;
	bool nodeVar17;
	vec4 nodeVar18;

	// flow
	// code

	nodeVar1 = clamp( floor( ( nodeVarying3 * f_nodeUniform2 ) ), vec2( 0.0, 0.0 ), ( f_nodeUniform2 - vec2( 1.0 ) ) );
	nodeVar2 = ivec2( nodeVar1 );
	nodeVar4 = bool( f_nodeUniform3 );

	if ( nodeVar4 ) {

		nodeVar3 = ivec2( nodeVar2.x, ( ( int( textureSize( nodeUniform1, 0 ).y ) - nodeVar2.y ) - 1 ) );

	} else {

		nodeVar3 = nodeVar2;

	}

	nodeVar5 = texelFetch( nodeUniform1, nodeVar3, 0 );
	nodeVar6 = min( ( ( floor( ( nodeVar1 / vec2( f_nodeUniform4 ) ) ) * vec2( f_nodeUniform4 ) ) + vec2( floor( ( f_nodeUniform4 * 0.5 ) ) ) ), ( f_nodeUniform2 - vec2( 1.0 ) ) );
	nodeVar7 = ivec2( nodeVar6 );
	nodeVar9 = bool( f_nodeUniform5 );

	if ( nodeVar9 ) {

		nodeVar8 = ivec2( nodeVar7.x, ( ( int( textureSize( nodeUniform1, 0 ).y ) - nodeVar7.y ) - 1 ) );

	} else {

		nodeVar8 = nodeVar7;

	}

	nodeVar10 = texelFetch( nodeUniform1, nodeVar8, 0 );

	if ( ( ( f_nodeUniform0 == 1.0 ) || ( ( ( f_nodeUniform0 == 2.0 ) && ( nodeVar5.x > 0.5 ) ) && ( nodeVar10.x > 0.5 ) ) ) ) {

		nodeVar11 = ivec2( nodeVar6 );
		nodeVar13 = bool( f_nodeUniform7 );

		if ( nodeVar13 ) {

			nodeVar12 = ivec2( nodeVar11.x, ( ( int( textureSize( nodeUniform6, 0 ).y ) - nodeVar11.y ) - 1 ) );

		} else {

			nodeVar12 = nodeVar11;

		}

		nodeVar14 = texelFetch( nodeUniform6, nodeVar12, 0 );
		nodeVar0 = nodeVar14;

	} else {

		nodeVar15 = ivec2( nodeVar1 );
		nodeVar17 = bool( f_nodeUniform8 );

		if ( nodeVar17 ) {

			nodeVar16 = ivec2( nodeVar15.x, ( ( int( textureSize( nodeUniform6, 0 ).y ) - nodeVar15.y ) - 1 ) );

		} else {

			nodeVar16 = nodeVar15;

		}

		nodeVar18 = texelFetch( nodeUniform6, nodeVar16, 0 );
		nodeVar0 = nodeVar18;

	}


	// result
	fragColor = vec4( sRGBTransferOETF( nodeVar0.xyz ), nodeVar0.w );

}
