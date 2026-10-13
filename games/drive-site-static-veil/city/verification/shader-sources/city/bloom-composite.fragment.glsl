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
	float f_nodeUniform1;
	mat3 f_nodeUniform4;
	uint f_nodeUniform5;
	mat3 f_nodeUniform7;
	uint f_nodeUniform8;
	mat3 f_nodeUniform10;
	uint f_nodeUniform11;
	mat3 f_nodeUniform13;
	uint f_nodeUniform14;
	mat3 f_nodeUniform16;
	uint f_nodeUniform17;
	float f_nodeUniform18;
};
uniform NodeBuffer_8742 {
	vec4 buffer8742[5];
};

uniform NodeBuffer_8743 {
	vec4 buffer8743[5];
};

uniform sampler2D nodeUniform3;
uniform sampler2D nodeUniform6;
uniform sampler2D nodeUniform9;
uniform sampler2D nodeUniform12;
uniform sampler2D nodeUniform15;

// varyings
in vec2 nodeVarying3;


// codes
float lerpBloomFactor ( float factor, float radius ) {

	


	return mix( factor, ( 1.2 - factor ), radius );

}



void main() {

	// vars
	vec2 nodeVar0;
	vec2 nodeVar1;
	bool nodeVar2;
	vec2 nodeVar3;
	vec4 nodeVar4;
	vec2 nodeVar5;
	vec2 nodeVar6;
	bool nodeVar7;
	vec2 nodeVar8;
	vec4 nodeVar9;
	vec2 nodeVar10;
	vec2 nodeVar11;
	bool nodeVar12;
	vec2 nodeVar13;
	vec4 nodeVar14;
	vec2 nodeVar15;
	vec2 nodeVar16;
	bool nodeVar17;
	vec2 nodeVar18;
	vec4 nodeVar19;
	vec2 nodeVar20;
	vec2 nodeVar21;
	bool nodeVar22;
	vec2 nodeVar23;
	vec4 nodeVar24;

	// flow
	// code

	nodeVar0 = ( f_nodeUniform4 * vec3( nodeVarying3, 1.0 ) ).xy;
	nodeVar2 = bool( f_nodeUniform5 );

	if ( nodeVar2 ) {

		nodeVar3 = nodeVar0;
		nodeVar1 = vec2( nodeVar3.x, 1.0 - nodeVar3.y );

	} else {

		nodeVar1 = nodeVar0;

	}

	nodeVar4 = texture( nodeUniform3, nodeVar1 );
	nodeVar5 = ( f_nodeUniform7 * vec3( nodeVarying3, 1.0 ) ).xy;
	nodeVar7 = bool( f_nodeUniform8 );

	if ( nodeVar7 ) {

		nodeVar8 = nodeVar5;
		nodeVar6 = vec2( nodeVar8.x, 1.0 - nodeVar8.y );

	} else {

		nodeVar6 = nodeVar5;

	}

	nodeVar9 = texture( nodeUniform6, nodeVar6 );
	nodeVar10 = ( f_nodeUniform10 * vec3( nodeVarying3, 1.0 ) ).xy;
	nodeVar12 = bool( f_nodeUniform11 );

	if ( nodeVar12 ) {

		nodeVar13 = nodeVar10;
		nodeVar11 = vec2( nodeVar13.x, 1.0 - nodeVar13.y );

	} else {

		nodeVar11 = nodeVar10;

	}

	nodeVar14 = texture( nodeUniform9, nodeVar11 );
	nodeVar15 = ( f_nodeUniform13 * vec3( nodeVarying3, 1.0 ) ).xy;
	nodeVar17 = bool( f_nodeUniform14 );

	if ( nodeVar17 ) {

		nodeVar18 = nodeVar15;
		nodeVar16 = vec2( nodeVar18.x, 1.0 - nodeVar18.y );

	} else {

		nodeVar16 = nodeVar15;

	}

	nodeVar19 = texture( nodeUniform12, nodeVar16 );
	nodeVar20 = ( f_nodeUniform16 * vec3( nodeVarying3, 1.0 ) ).xy;
	nodeVar22 = bool( f_nodeUniform17 );

	if ( nodeVar22 ) {

		nodeVar23 = nodeVar20;
		nodeVar21 = vec2( nodeVar23.x, 1.0 - nodeVar23.y );

	} else {

		nodeVar21 = nodeVar20;

	}

	nodeVar24 = texture( nodeUniform15, nodeVar21 );

	// result
	fragColor = ( ( ( ( ( ( ( vec4( lerpBloomFactor( buffer8742[ 0u ].x, f_nodeUniform1 ) ) * vec4( buffer8743[ 0u ].xyz, 1.0 ) ) * nodeVar4 ) + ( ( vec4( lerpBloomFactor( buffer8742[ 1u ].x, f_nodeUniform1 ) ) * vec4( buffer8743[ 1u ].xyz, 1.0 ) ) * nodeVar9 ) ) + ( ( vec4( lerpBloomFactor( buffer8742[ 2u ].x, f_nodeUniform1 ) ) * vec4( buffer8743[ 2u ].xyz, 1.0 ) ) * nodeVar14 ) ) + ( ( vec4( lerpBloomFactor( buffer8742[ 3u ].x, f_nodeUniform1 ) ) * vec4( buffer8743[ 3u ].xyz, 1.0 ) ) * nodeVar19 ) ) + ( ( vec4( lerpBloomFactor( buffer8742[ 4u ].x, f_nodeUniform1 ) ) * vec4( buffer8743[ 4u ].xyz, 1.0 ) ) * nodeVar24 ) ) * vec4( f_nodeUniform18 ) );

}
