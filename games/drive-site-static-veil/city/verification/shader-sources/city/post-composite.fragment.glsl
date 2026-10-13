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
	uint f_nodeUniform1;
	vec2 f_nodeUniform3;
	uint f_nodeUniform4;
	uint f_nodeUniform5;
	uint f_nodeUniform6;
	float f_nodeUniform7;
	float f_nodeUniform8;
	uint f_nodeUniform10;
	uint f_nodeUniform11;
	uint f_nodeUniform12;
	float f_nodeUniform13;
	uint f_nodeUniform15;
	uint f_nodeUniform17;
	uint f_nodeUniform19;
};
uniform sampler2D nodeUniform0;
uniform sampler2D nodeUniform2;
uniform sampler2D nodeUniform9;
uniform sampler2D nodeUniform14;
uniform sampler2D nodeUniform16;
uniform sampler2D nodeUniform18;

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
	float nodeVar24;
	vec2 nodeVar25;
	vec2 nodeVar26;
	bool nodeVar27;
	vec2 nodeVar28;
	float nodeVar29;
	float nodeVar30;
	vec2 nodeVar31;
	vec2 nodeVar32;
	bool nodeVar33;
	vec2 nodeVar34;
	float nodeVar35;
	float nodeVar36;
	ivec2 nodeVar37;
	ivec2 nodeVar38;
	bool nodeVar39;
	vec4 nodeVar40;
	vec2 nodeVar41;
	vec2 nodeVar42;
	bool nodeVar43;
	vec2 nodeVar44;
	vec4 nodeVar45;
	vec2 nodeVar46;
	vec2 nodeVar47;
	bool nodeVar48;
	vec2 nodeVar49;
	vec4 nodeVar50;

	// flow
	// code

	nodeVar0 = nodeVarying3;
	nodeVar2 = bool( f_nodeUniform1 );

	if ( nodeVar2 ) {

		nodeVar3 = nodeVar0;
		nodeVar1 = vec2( nodeVar3.x, 1.0 - nodeVar3.y );

	} else {

		nodeVar1 = nodeVar0;

	}

	nodeVar4 = texture( nodeUniform0, nodeVar1 );
	nodeVar5 = ( nodeVarying3 + ( vec2( 1.0, 0.0 ) / f_nodeUniform3 ) );
	nodeVar7 = bool( f_nodeUniform4 );

	if ( nodeVar7 ) {

		nodeVar8 = nodeVar5;
		nodeVar6 = vec2( nodeVar8.x, 1.0 - nodeVar8.y );

	} else {

		nodeVar6 = nodeVar5;

	}

	nodeVar9 = texture( nodeUniform2, nodeVar6 );
	nodeVar10 = nodeVarying3;
	nodeVar12 = bool( f_nodeUniform5 );

	if ( nodeVar12 ) {

		nodeVar13 = nodeVar10;
		nodeVar11 = vec2( nodeVar13.x, 1.0 - nodeVar13.y );

	} else {

		nodeVar11 = nodeVar10;

	}

	nodeVar14 = texture( nodeUniform2, nodeVar11 );
	nodeVar15 = ( nodeVarying3 + ( vec2( 0.0, 1.0 ) / f_nodeUniform3 ) );
	nodeVar17 = bool( f_nodeUniform6 );

	if ( nodeVar17 ) {

		nodeVar18 = nodeVar15;
		nodeVar16 = vec2( nodeVar18.x, 1.0 - nodeVar18.y );

	} else {

		nodeVar16 = nodeVar15;

	}

	nodeVar19 = texture( nodeUniform2, nodeVar16 );
	nodeVar20 = ( nodeVarying3 + ( vec2( 1.0, 0.0 ) / f_nodeUniform3 ) );
	nodeVar22 = bool( f_nodeUniform10 );

	if ( nodeVar22 ) {

		nodeVar23 = nodeVar20;
		nodeVar21 = vec2( nodeVar23.x, 1.0 - nodeVar23.y );

	} else {

		nodeVar21 = nodeVar20;

	}

	nodeVar24 = texture( nodeUniform9, nodeVar21 ).x;
	nodeVar25 = nodeVarying3;
	nodeVar27 = bool( f_nodeUniform11 );

	if ( nodeVar27 ) {

		nodeVar28 = nodeVar25;
		nodeVar26 = vec2( nodeVar28.x, 1.0 - nodeVar28.y );

	} else {

		nodeVar26 = nodeVar25;

	}

	nodeVar29 = texture( nodeUniform9, nodeVar26 ).x;
	nodeVar30 = ( ( f_nodeUniform7 * f_nodeUniform8 ) / ( ( ( f_nodeUniform8 - f_nodeUniform7 ) * nodeVar29 ) - f_nodeUniform8 ) );
	nodeVar31 = ( nodeVarying3 + ( vec2( 0.0, 1.0 ) / f_nodeUniform3 ) );
	nodeVar33 = bool( f_nodeUniform12 );

	if ( nodeVar33 ) {

		nodeVar34 = nodeVar31;
		nodeVar32 = vec2( nodeVar34.x, 1.0 - nodeVar34.y );

	} else {

		nodeVar32 = nodeVar31;

	}

	nodeVar35 = texture( nodeUniform9, nodeVar32 ).x;
	nodeVar37 = ivec2( clamp( floor( ( nodeVarying3 * f_nodeUniform3 ) ), vec2( 0.0, 0.0 ), ( f_nodeUniform3 - vec2( 1.0 ) ) ) );
	nodeVar39 = bool( f_nodeUniform15 );

	if ( nodeVar39 ) {

		nodeVar38 = ivec2( nodeVar37.x, ( ( int( textureSize( nodeUniform14, 0 ).y ) - nodeVar37.y ) - 1 ) );

	} else {

		nodeVar38 = nodeVar37;

	}

	nodeVar40 = texelFetch( nodeUniform14, nodeVar38, 0 );

	if ( ( ( f_nodeUniform13 == 1.0 ) || ( ( f_nodeUniform13 == 2.0 ) && ( nodeVar40.x > 0.5 ) ) ) ) {

		nodeVar36 = 0.52;

	} else {

		nodeVar36 = 0.0;

	}

	nodeVar41 = nodeVarying3;
	nodeVar43 = bool( f_nodeUniform17 );

	if ( nodeVar43 ) {

		nodeVar44 = nodeVar41;
		nodeVar42 = vec2( nodeVar44.x, 1.0 - nodeVar44.y );

	} else {

		nodeVar42 = nodeVar41;

	}

	nodeVar45 = texture( nodeUniform16, nodeVar42 );
	nodeVar46 = nodeVarying3;
	nodeVar48 = bool( f_nodeUniform19 );

	if ( nodeVar48 ) {

		nodeVar49 = nodeVar46;
		nodeVar47 = vec2( nodeVar49.x, 1.0 - nodeVar49.y );

	} else {

		nodeVar47 = nodeVar46;

	}

	nodeVar50 = texture( nodeUniform18, nodeVar47 );

	// result
	fragColor = vec4( ( ( ( nodeVar4.xyz * vec3( ( 1.0 - ( max( smoothstep( 0.18, 0.55, max( length( ( nodeVar9.xyz - nodeVar14.xyz ) ), length( ( nodeVar19.xyz - nodeVar14.xyz ) ) ) ), smoothstep( 0.012, 0.05, ( max( abs( ( ( ( f_nodeUniform7 * f_nodeUniform8 ) / ( ( ( f_nodeUniform8 - f_nodeUniform7 ) * nodeVar24 ) - f_nodeUniform8 ) ) - nodeVar30 ) ), abs( ( ( ( f_nodeUniform7 * f_nodeUniform8 ) / ( ( ( f_nodeUniform8 - f_nodeUniform7 ) * nodeVar35 ) - f_nodeUniform8 ) ) - nodeVar30 ) ) ) / max( abs( nodeVar30 ), 1.0 ) ) ) ) * nodeVar36 ) ) ) ) * vec3( mix( 1.0, nodeVar45.x, 0.5 ) ) ) + nodeVar50.xyz ), 1.0 );

}
