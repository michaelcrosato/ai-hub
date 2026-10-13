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

layout( location = 0 ) out vec4 m0;
layout( location = 1 ) out vec4 m1;
layout( location = 2 ) out vec4 m2;
layout( location = 3 ) out vec4 m3;



// uniforms

layout( std140 ) uniform fragment_object {
	float f_nodeUniform0;
	float f_nodeUniform1;
	float f_nodeUniform3;
	mat3 f_nodeUniform5;
	uint f_nodeUniform9;
	mat3 f_nodeUniform16;
	uint f_nodeUniform18;
};

layout( std140 ) uniform fragment_render {
	mat4 f_cameraViewMatrix;
	vec3 f_nodeUniform7;
	vec3 f_nodeUniform8;
	vec3 f_nodeUniform10;
	vec3 f_nodeUniform11;
	vec3 f_nodeUniform12;
	vec3 f_nodeUniform15;
	vec3 f_nodeUniform17;
	vec3 f_nodeUniform19;
	float f_nodeUniform20;
	float f_nodeUniform21;
};
uniform sampler2D nodeUniform4;

// varyings
in vec3 v_positionView;
in vec3 v_positionWorld;
in vec3 v_normalViewGeometry;
in vec3 nodeVarying5;
in float nodeVarying6;
in vec3 nodeVarying7;


// codes


void main() {

	// vars
	vec4 DiffuseColor;
	vec3 EmissiveColor;
	vec4 Output;
	vec3 directDiffuse;
	vec3 nodeVar0;
	vec3 nodeVar1;
	vec2 nodeVar2;
	vec2 nodeVar3;
	bool nodeVar4;
	vec2 nodeVar5;
	vec4 nodeVar6;
	vec3 nodeVar7;
	vec3 nodeVar8;
	vec3 nodeVar9;
	vec3 nodeVar10;
	vec3 irradiance;
	vec3 normalViewGeometry;
	vec3 NORMAL_normalView;
	vec3 normalView;
	vec4 nodeVar11;
	vec4 nodeVar12;
	vec3 nodeVar13;
	vec3 normalWorld;
	float nodeVar14;
	float nodeVar15;
	float nodeVar16;
	vec3 nodeVar17;
	vec3 nodeVar18;
	vec3 nodeVar19;
	vec3 nodeVar20;
	vec2 nodeVar21;
	vec2 nodeVar22;
	bool nodeVar23;
	vec2 nodeVar24;
	vec4 nodeVar25;
	float nodeVar26;
	float nodeVar27;
	float nodeVar28;
	float nodeVar29;
	vec3 nodeVar30;
	vec3 nodeVar31;
	vec3 nodeVar32;
	vec3 nodeVar33;
	vec3 nodeVar34;
	vec3 indirectDiffuse;
	vec4 nodeVar35;
	vec4 nodeVar36;
	vec4 nodeVar37;
	float ambientOcclusion;
	vec3 nodeVar38;
	vec3 totalDiffuse;
	vec3 nodeVar39;
	vec3 totalSpecular;
	vec3 directSpecular;
	vec3 indirectSpecular;
	vec3 nodeVar40;
	vec3 outgoingLight;
	vec3 nodeVar41;

	// flow
	// code

	DiffuseColor = vec4( nodeVarying5, 1.0 );
	DiffuseColor.w = ( DiffuseColor.w * f_nodeUniform0 );
	DiffuseColor.w = 1.0;
	EmissiveColor = ( ( ( nodeVarying5 * vec3( pow( nodeVarying6, 1.25 ) ) ) * vec3( 3.4 ) ) * vec3( ( ( ( sin( ( ( f_nodeUniform1 * 0.75 ) + ( v_positionWorld.x * 0.08 ) ) ) * 0.055 ) * f_nodeUniform3 ) + 1.0 ) ) );
	directDiffuse = vec3( 0.0, 0.0, 0.0 );
	nodeVar0 = ( f_nodeUniform7 - f_nodeUniform8 );
	nodeVar1 = normalize( ( f_cameraViewMatrix * vec4( nodeVar0, 0.0 ) ).xyz );
	nodeVar2 = ( f_nodeUniform5 * vec3( vec2( ( ( dot( nodeVarying7, nodeVar1 ) * 0.5 ) + 0.5 ), 0.0 ), 1.0 ) ).xy;
	nodeVar4 = bool( f_nodeUniform9 );

	if ( nodeVar4 ) {

		nodeVar5 = nodeVar2;
		nodeVar3 = vec2( nodeVar5.x, 1.0 - nodeVar5.y );

	} else {

		nodeVar3 = nodeVar2;

	}

	nodeVar6 = texture( nodeUniform4, nodeVar3 );
	nodeVar7 = ( vec3( nodeVar6.x ) * f_nodeUniform10 );
	nodeVar8 = ( DiffuseColor.xyz * vec3( 0.3183098861837907 ) );
	nodeVar9 = ( nodeVar7 * nodeVar8 );
	nodeVar10 = ( directDiffuse + nodeVar9 );
	directDiffuse = nodeVar10;
	irradiance = vec3( 0.0, 0.0, 0.0 );
	normalViewGeometry = normalize( v_normalViewGeometry );
	NORMAL_normalView = ( normalViewGeometry * vec3( ( ( float( gl_FrontFacing ) * 2.0 ) - 1.0 ) ) );
	normalView = NORMAL_normalView;
	nodeVar11 = vec4( normalView, 0.0 );
	nodeVar12 = ( nodeVar11 * f_cameraViewMatrix );
	nodeVar13 = normalize( nodeVar12.xyz );
	normalWorld = nodeVar13;
	nodeVar14 = dot( normalWorld, normalize( f_nodeUniform15 ) );
	nodeVar15 = ( nodeVar14 * 0.5 );
	nodeVar16 = ( nodeVar15 + 0.5 );
	nodeVar17 = mix( f_nodeUniform11, f_nodeUniform12, nodeVar16 );
	nodeVar18 = ( irradiance + nodeVar17 );
	irradiance = nodeVar18;
	nodeVar19 = ( f_nodeUniform17 - v_positionView );
	nodeVar20 = normalize( nodeVar19 );
	nodeVar21 = ( f_nodeUniform16 * vec3( vec2( ( ( dot( nodeVarying7, nodeVar20 ) * 0.5 ) + 0.5 ), 0.0 ), 1.0 ) ).xy;
	nodeVar23 = bool( f_nodeUniform18 );

	if ( nodeVar23 ) {

		nodeVar24 = nodeVar21;
		nodeVar22 = vec2( nodeVar24.x, 1.0 - nodeVar24.y );

	} else {

		nodeVar22 = nodeVar21;

	}

	nodeVar25 = texture( nodeUniform4, nodeVar22 );

	if ( ( f_nodeUniform20 > 0.0 ) ) {

		nodeVar27 = length( nodeVar19 );
		nodeVar28 = ( nodeVar27 / f_nodeUniform20 );
		nodeVar29 = clamp( ( 1.0 - ( ( ( nodeVar28 * nodeVar28 ) * nodeVar28 ) * nodeVar28 ) ), 0.0, 1.0 );
		nodeVar26 = ( ( 1.0 / max( pow( nodeVar27, f_nodeUniform21 ), 0.01 ) ) * ( nodeVar29 * nodeVar29 ) );

	} else {

		nodeVar26 = ( 1.0 / max( pow( length( nodeVar19 ), f_nodeUniform21 ), 0.01 ) );

	}

	nodeVar30 = ( f_nodeUniform19 * vec3( nodeVar26 ) );
	nodeVar31 = ( vec3( nodeVar25.x ) * nodeVar30 );
	nodeVar32 = ( DiffuseColor.xyz * vec3( 0.3183098861837907 ) );
	nodeVar33 = ( nodeVar31 * nodeVar32 );
	nodeVar34 = ( directDiffuse + nodeVar33 );
	directDiffuse = nodeVar34;
	indirectDiffuse = vec3( 0.0, 0.0, 0.0 );
	nodeVar35 = ( DiffuseColor * vec4( 0.3183098861837907 ) );
	nodeVar36 = ( vec4( irradiance, 1.0 ) * nodeVar35 );
	nodeVar37 = ( vec4( indirectDiffuse, 1.0 ) + nodeVar36 );
	indirectDiffuse = nodeVar37.xyz;
	ambientOcclusion = 1.0;
	nodeVar38 = ( indirectDiffuse * vec3( ambientOcclusion ) );
	indirectDiffuse = nodeVar38;
	nodeVar39 = ( directDiffuse + indirectDiffuse );
	totalDiffuse = nodeVar39;
	directSpecular = vec3( 0.0, 0.0, 0.0 );
	indirectSpecular = vec3( 0.0, 0.0, 0.0 );
	nodeVar40 = ( directSpecular + indirectSpecular );
	totalSpecular = nodeVar40;
	nodeVar41 = ( totalDiffuse + totalSpecular );
	outgoingLight = nodeVar41;
	Output = max( vec4( ( outgoingLight + EmissiveColor ), DiffuseColor.w ), 0.0 );
	m0 = Output;
	m1 = vec4( normalView, 1.0 );
	m2 = vec4( 1.0, 0.0, 0.0, 1.0 );
	m3 = vec4( EmissiveColor, 1.0 );

	// result
	

}
