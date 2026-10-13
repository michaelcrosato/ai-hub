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
	mat3 f_nodeUniform1;
	uint f_nodeUniform2;
	mat3 f_nodeUniform4;
	vec2 f_nodeUniform5;
	vec2 f_nodeUniform6;
	uint f_nodeUniform7;
	mat3 f_nodeUniform8;
	uint f_nodeUniform9;
};
uniform sampler2D nodeUniform0;
uniform NodeBuffer_8713 {
	vec4 buffer8713[14];
};


// varyings
in vec2 nodeVarying3;


// codes


void main() {

	// vars
	vec2 nodeVar0;
	vec2 nodeVar1;
	bool nodeVar2;
	vec2 nodeVar3;
	vec4 nodeVar4;
	vec3 nodeVar5;
	vec2 nodeVar6;
	vec2 nodeVar7;
	vec2 nodeVar8;
	bool nodeVar9;
	vec2 nodeVar10;
	vec4 nodeVar11;
	vec2 nodeVar12;
	vec2 nodeVar13;
	bool nodeVar14;
	vec2 nodeVar15;
	vec4 nodeVar16;

	// flow
	// code

	nodeVar0 = ( f_nodeUniform1 * vec3( nodeVarying3, 1.0 ) ).xy;
	nodeVar2 = bool( f_nodeUniform2 );

	if ( nodeVar2 ) {

		nodeVar3 = nodeVar0;
		nodeVar1 = vec2( nodeVar3.x, 1.0 - nodeVar3.y );

	} else {

		nodeVar1 = nodeVar0;

	}

	nodeVar4 = texture( nodeUniform0, nodeVar1 );
	nodeVar5 = ( nodeVar4.xyz * vec3( buffer8713[ 0u ].x ) );

	for ( int i = 1; i < 14; i ++ ) {

		nodeVar6 = ( ( f_nodeUniform5 * f_nodeUniform6 ) * vec2( float( i ) ) );
		nodeVar7 = ( f_nodeUniform4 * vec3( ( nodeVarying3 + nodeVar6 ), 1.0 ) ).xy;
		nodeVar9 = bool( f_nodeUniform7 );

		if ( nodeVar9 ) {

			nodeVar10 = nodeVar7;
			nodeVar8 = vec2( nodeVar10.x, 1.0 - nodeVar10.y );

		} else {

			nodeVar8 = nodeVar7;

		}

		nodeVar11 = texture( nodeUniform0, nodeVar8 );
		nodeVar12 = ( f_nodeUniform8 * vec3( ( nodeVarying3 - nodeVar6 ), 1.0 ) ).xy;
		nodeVar14 = bool( f_nodeUniform9 );

		if ( nodeVar14 ) {

			nodeVar15 = nodeVar12;
			nodeVar13 = vec2( nodeVar15.x, 1.0 - nodeVar15.y );

		} else {

			nodeVar13 = nodeVar12;

		}

		nodeVar16 = texture( nodeUniform0, nodeVar13 );
		nodeVar5 = ( nodeVar5 + ( ( nodeVar11.xyz + nodeVar16.xyz ) * vec3( buffer8713[ i ].x ) ) );

	}


	// result
	fragColor = vec4( nodeVar5, 1.0 );

}
