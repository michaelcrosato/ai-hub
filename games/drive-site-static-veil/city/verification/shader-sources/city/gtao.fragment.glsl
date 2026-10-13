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
	mat4 f_nodeUniform2;
	uint f_nodeUniform4;
	float f_nodeUniform5;
	float f_nodeUniform6;
	mat3 f_nodeUniform8;
	vec2 f_nodeUniform9;
	uint f_nodeUniform10;
	mat4 f_nodeUniform11;
	float f_nodeUniform12;
	float f_nodeUniform13;
	uint f_nodeUniform14;
	float f_nodeUniform15;
	float f_nodeUniform16;
	uint f_nodeUniform17;
	float f_nodeUniform18;
};
uniform sampler2D nodeUniform0;
uniform sampler2D nodeUniform3;
uniform sampler2D nodeUniform7;

// varyings
in vec2 nodeVarying3;


// codes


void main() {

	// vars
	vec2 nodeVar0;
	vec2 nodeVar1;
	bool nodeVar2;
	vec2 nodeVar3;
	float nodeVar4;
	float nodeVar5;
	vec3 nodeVar6;
	vec2 nodeVar7;
	vec2 nodeVar8;
	bool nodeVar9;
	vec2 nodeVar10;
	vec4 nodeVar11;
	vec3 nodeVar12;
	float nodeVar13;
	float nodeVar14;
	float nodeVar15;
	float nodeVar16;
	float nodeVar17;
	vec2 nodeVar18;
	vec2 nodeVar19;
	bool nodeVar20;
	vec2 nodeVar21;
	vec4 nodeVar22;
	vec4 nodeVar23;
	vec3 nodeVar24;
	vec3 nodeVar25;
	vec3 nodeVar26;
	vec3 nodeVar27;
	vec3 nodeVar28;
	vec2 nodeVar29;
	vec3 nodeVar30;
	vec4 nodeVar31;
	vec2 nodeVar32;
	vec2 nodeVar33;
	vec2 nodeVar34;
	vec2 nodeVar35;
	bool nodeVar36;
	vec2 nodeVar37;
	float nodeVar38;
	float nodeVar39;
	vec3 nodeVar40;
	vec3 nodeVar41;
	vec4 nodeVar42;
	vec2 nodeVar43;
	vec2 nodeVar44;
	vec2 nodeVar45;
	vec2 nodeVar46;
	bool nodeVar47;
	vec2 nodeVar48;
	float nodeVar49;
	float nodeVar50;
	vec3 nodeVar51;
	vec3 nodeVar52;
	vec2 nodeVar53;

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

	nodeVar4 = texture( nodeUniform0, nodeVar1 ).x;
	nodeVar5 = nodeVar4;

	if ( ( nodeVar5 >= 1.0 ) ) {

		discard;
		

	}

	nodeVar6 = ( ( f_nodeUniform2 * vec4( ( ( vec3( nodeVarying3.x, ( 1.0 - nodeVarying3.y ), nodeVar5 ) * vec3( 2.0 ) ) - vec3( 1.0 ) ), 1.0 ) ).xyz / vec3( ( f_nodeUniform2 * vec4( ( ( vec3( nodeVarying3.x, ( 1.0 - nodeVarying3.y ), nodeVar5 ) * vec3( 2.0 ) ) - vec3( 1.0 ) ), 1.0 ) ).w ) );
	nodeVar7 = nodeVarying3;
	nodeVar9 = bool( f_nodeUniform4 );

	if ( nodeVar9 ) {

		nodeVar10 = nodeVar7;
		nodeVar8 = vec2( nodeVar10.x, 1.0 - nodeVar10.y );

	} else {

		nodeVar8 = nodeVar7;

	}

	nodeVar11 = texture( nodeUniform3, nodeVar8 );
	nodeVar12 = normalize( nodeVar11.xyz );

	if ( ( f_nodeUniform5 < 30.0 ) ) {

		nodeVar13 = 3.0;

	} else {

		nodeVar13 = 5.0;

	}

	nodeVar14 = nodeVar13;
	nodeVar15 = ( ( f_nodeUniform5 + ( nodeVar14 - 1.0 ) ) / nodeVar14 );
	nodeVar16 = 0.0;

	for ( int i = 0; i < int( nodeVar14 ); i ++ ) {

		nodeVar17 = ( ( ( float( i ) / nodeVar14 ) * 3.141592653589793 ) + f_nodeUniform6 );
		nodeVar18 = ( f_nodeUniform8 * vec3( ( vec2( nodeVarying3.x, ( 1.0 - nodeVarying3.y ) ) * ( f_nodeUniform9 / vec2( textureSize( nodeUniform7, 0 ) ) ) ), 1.0 ) ).xy;
		nodeVar20 = bool( f_nodeUniform10 );

		if ( nodeVar20 ) {

			nodeVar21 = nodeVar18;
			nodeVar19 = vec2( nodeVar21.x, 1.0 - nodeVar21.y );

		} else {

			nodeVar19 = nodeVar18;

		}

		nodeVar22 = texture( nodeUniform7, nodeVar19 );
		nodeVar23 = vec4( cos( nodeVar17 ), sin( nodeVar17 ), 0.0, ( 0.5 + ( 0.5 * nodeVar22.w ) ) );
		nodeVar24 = normalize( vec3( ( ( nodeVar22.xyz * vec3( 2.0 ) ) - vec3( 1.0 ) ).xy, 0.0 ) );
		nodeVar23.xyz = normalize( ( mat3( nodeVar24, vec3( ( nodeVar24.y * -1.0 ), nodeVar24.x, 0.0 ), vec3( 0.0, 0.0, 1.0 ) ) * nodeVar23.xyz ) );
		nodeVar25 = normalize( ( - nodeVar6 ) );
		nodeVar26 = normalize( cross( nodeVar23.xyz, nodeVar25 ) );
		nodeVar27 = normalize( ( nodeVar12 - ( nodeVar26 * vec3( dot( nodeVar12, nodeVar26 ) ) ) ) );
		nodeVar28 = cross( nodeVar27, nodeVar26 );
		nodeVar29 = vec2( dot( nodeVar25, nodeVar28 ), dot( nodeVar25, ( - nodeVar28 ) ) );

		for ( int j = 0; j < int( nodeVar15 ); j ++ ) {

			nodeVar30 = ( ( ( nodeVar23.xyz * vec3( f_nodeUniform12 ) ) * vec3( nodeVar23.w ) ) * vec3( pow( ( ( float( j ) + 1.0 ) / nodeVar15 ), f_nodeUniform13 ) ) );
			nodeVar31 = ( f_nodeUniform11 * vec4( ( nodeVar6 + nodeVar30 ), 1.0 ) );
			nodeVar32 = ( ( ( nodeVar31.xy / vec2( nodeVar31.w ) ) * vec2( 0.5 ) ) + vec2( 0.5 ) );
			nodeVar33 = vec2( nodeVar32.x, ( 1.0 - nodeVar32.y ) );
			nodeVar34 = nodeVar33;
			nodeVar36 = bool( f_nodeUniform14 );

			if ( nodeVar36 ) {

				nodeVar37 = nodeVar34;
				nodeVar35 = vec2( nodeVar37.x, 1.0 - nodeVar37.y );

			} else {

				nodeVar35 = nodeVar34;

			}

			nodeVar38 = texture( nodeUniform0, nodeVar35 ).x;
			nodeVar39 = nodeVar38;
			nodeVar40 = ( ( f_nodeUniform2 * vec4( ( ( vec3( nodeVar33.x, ( 1.0 - nodeVar33.y ), nodeVar39 ) * vec3( 2.0 ) ) - vec3( 1.0 ) ), 1.0 ) ).xyz / vec3( ( f_nodeUniform2 * vec4( ( ( vec3( nodeVar33.x, ( 1.0 - nodeVar33.y ), nodeVar39 ) * vec3( 2.0 ) ) - vec3( 1.0 ) ), 1.0 ) ).w ) );
			nodeVar41 = ( nodeVar40 - nodeVar6 );

			if ( ( abs( nodeVar41.z ) < f_nodeUniform15 ) ) {

				nodeVar29.x = ( nodeVar29.x + max( 0.0, ( ( dot( nodeVar25, normalize( nodeVar41 ) ) - nodeVar29.x ) * mix( 1.0, ( 2.0 / ( float( j ) + 2.0 ) ), f_nodeUniform16 ) ) ) );
				

			}

			nodeVar42 = ( f_nodeUniform11 * vec4( ( nodeVar6 - nodeVar30 ), 1.0 ) );
			nodeVar43 = ( ( ( nodeVar42.xy / vec2( nodeVar42.w ) ) * vec2( 0.5 ) ) + vec2( 0.5 ) );
			nodeVar44 = vec2( nodeVar43.x, ( 1.0 - nodeVar43.y ) );
			nodeVar45 = nodeVar44;
			nodeVar47 = bool( f_nodeUniform17 );

			if ( nodeVar47 ) {

				nodeVar48 = nodeVar45;
				nodeVar46 = vec2( nodeVar48.x, 1.0 - nodeVar48.y );

			} else {

				nodeVar46 = nodeVar45;

			}

			nodeVar49 = texture( nodeUniform0, nodeVar46 ).x;
			nodeVar50 = nodeVar49;
			nodeVar51 = ( ( f_nodeUniform2 * vec4( ( ( vec3( nodeVar44.x, ( 1.0 - nodeVar44.y ), nodeVar50 ) * vec3( 2.0 ) ) - vec3( 1.0 ) ), 1.0 ) ).xyz / vec3( ( f_nodeUniform2 * vec4( ( ( vec3( nodeVar44.x, ( 1.0 - nodeVar44.y ), nodeVar50 ) * vec3( 2.0 ) ) - vec3( 1.0 ) ), 1.0 ) ).w ) );
			nodeVar52 = ( nodeVar51 - nodeVar6 );

			if ( ( abs( nodeVar52.z ) < f_nodeUniform15 ) ) {

				nodeVar29.y = ( nodeVar29.y + max( 0.0, ( ( dot( nodeVar25, normalize( nodeVar52 ) ) - nodeVar29.y ) * mix( 1.0, ( 2.0 / ( float( j ) + 2.0 ) ), f_nodeUniform16 ) ) ) );
				

			}


		}

		nodeVar53 = sqrt( ( vec2( 1.0 ) - ( nodeVar29 * nodeVar29 ) ) );
		nodeVar16 = ( nodeVar16 + ( ( dot( nodeVar27, cross( nodeVar26, nodeVar25 ) ) * ( 0.5 * ( ( acos( nodeVar29.y ) - acos( nodeVar29.x ) ) + ( ( nodeVar53.x * nodeVar29.x ) - ( nodeVar53.y * nodeVar29.y ) ) ) ) ) + ( dot( nodeVar27, nodeVar25 ) * ( 0.5 * ( ( 2.0 - ( nodeVar29.x * nodeVar29.x ) ) - ( nodeVar29.y * nodeVar29.y ) ) ) ) ) );

	}

	nodeVar16 = clamp( ( nodeVar16 / nodeVar14 ), 0.0, 1.0 );
	nodeVar16 = pow( nodeVar16, f_nodeUniform18 );

	// result
	fragColor = vec4( nodeVar16 );

}
