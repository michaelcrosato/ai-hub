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
	float f_nodeUniform5;
	float f_nodeUniform6;
	float f_nodeUniform7;
	uint f_nodeUniform12;
	uint f_nodeUniform13;
	uint f_nodeUniform21;
	uint f_nodeUniform22;
	uint f_nodeUniform23;
};

layout( std140 ) uniform fragment_render {
	mat4 f_cameraViewMatrix;
	vec3 f_nodeUniform8;
	vec3 f_nodeUniform9;
	vec3 f_nodeUniform10;
	vec3 f_nodeUniform14;
	vec3 f_nodeUniform15;
	vec3 f_nodeUniform16;
	vec3 f_nodeUniform17;
	vec3 f_nodeUniform18;
	float f_nodeUniform19;
	float f_nodeUniform20;
};
uniform sampler2D nodeUniform11;

// varyings
in vec3 v_positionView;
in vec3 v_positionWorld;
in vec3 v_normalViewGeometry;
in vec3 v_positionViewDirection;
in vec3 nodeVarying6;
in float nodeVarying7;


// codes
float V_GGX_SmithCorrelated ( float alpha, float dotNL, float dotNV ) {

	float nodeVar0;

	nodeVar0 = ( alpha * alpha );

	return ( 0.5 / max( ( ( dotNL * sqrt( ( nodeVar0 + ( ( 1.0 - nodeVar0 ) * ( dotNV * dotNV ) ) ) ) ) + ( dotNV * sqrt( ( nodeVar0 + ( ( 1.0 - nodeVar0 ) * ( dotNL * dotNL ) ) ) ) ) ), 0.000001 ) );

}

float D_GGX ( float alpha, float dotNH ) {

	float nodeVar0;
	float nodeVar1;

	nodeVar0 = ( alpha * alpha );
	nodeVar1 = ( 1.0 - ( ( dotNH * dotNH ) * ( 1.0 - nodeVar0 ) ) );

	return ( ( nodeVar0 / ( nodeVar1 * nodeVar1 ) ) * 0.3183098861837907 );

}



void main() {

	// vars
	vec4 DiffuseColor;
	float Metalness;
	vec3 normalViewGeometry;
	vec3 NORMAL_normalView;
	vec3 normalView;
	vec3 normalWorld;
	float nodeVar0;
	float Roughness;
	vec3 nodeVar1;
	vec3 SpecularColor;
	float SpecularF90;
	vec3 EmissiveColor;
	vec4 Output;
	vec3 directDiffuse;
	vec3 nodeVar2;
	vec4 nodeVar3;
	vec4 nodeVar4;
	vec3 nodeVar5;
	vec3 nodeVar6;
	float nodeVar7;
	vec3 nodeVar8;
	vec3 nodeVar9;
	vec3 nodeVar10;
	vec3 nodeVar11;
	vec3 directSpecular;
	vec3 positionViewDirection;
	vec3 nodeVar12;
	float nodeVar13;
	float nodeVar14;
	float nodeVar15;
	vec2 nodeVar16;
	vec2 nodeVar17;
	bool nodeVar18;
	vec2 nodeVar19;
	vec4 nodeVar20;
	vec2 nodeVar21;
	vec2 nodeVar22;
	bool nodeVar23;
	vec2 nodeVar24;
	vec4 nodeVar25;
	vec3 nodeVar26;
	float nodeVar27;
	float nodeVar28;
	vec3 nodeVar29;
	vec3 nodeVar30;
	vec3 nodeVar31;
	vec3 irradiance;
	float nodeVar32;
	float nodeVar33;
	float nodeVar34;
	vec3 nodeVar35;
	vec3 nodeVar36;
	vec3 nodeVar37;
	vec3 nodeVar38;
	float nodeVar39;
	float nodeVar40;
	float nodeVar41;
	float nodeVar42;
	float nodeVar43;
	vec3 nodeVar44;
	vec3 nodeVar45;
	vec3 nodeVar46;
	vec3 nodeVar47;
	vec3 nodeVar48;
	vec3 nodeVar49;
	float nodeVar50;
	float nodeVar51;
	float nodeVar52;
	vec2 nodeVar53;
	vec2 nodeVar54;
	bool nodeVar55;
	vec2 nodeVar56;
	vec4 nodeVar57;
	vec2 nodeVar58;
	vec2 nodeVar59;
	bool nodeVar60;
	vec2 nodeVar61;
	vec4 nodeVar62;
	vec3 nodeVar63;
	float nodeVar64;
	float nodeVar65;
	vec3 nodeVar66;
	vec3 nodeVar67;
	vec3 nodeVar68;
	vec3 indirectDiffuse;
	vec4 nodeVar69;
	vec4 nodeVar70;
	vec4 nodeVar71;
	vec3 singleScattering;
	vec3 multiScattering;
	float nodeVar72;
	vec2 nodeVar73;
	vec2 nodeVar74;
	bool nodeVar75;
	vec2 nodeVar76;
	vec4 nodeVar77;
	vec3 nodeVar78;
	float nodeVar79;
	vec3 nodeVar80;
	vec3 nodeVar81;
	vec3 nodeVar82;
	vec3 nodeVar83;
	vec3 nodeVar84;
	vec3 nodeVar85;
	vec3 nodeVar86;
	float nodeVar87;
	float nodeVar88;
	float nodeVar89;
	vec3 nodeVar90;
	vec3 nodeVar91;
	vec3 nodeVar92;
	vec3 nodeVar93;
	vec3 nodeVar94;
	vec3 nodeVar95;
	vec3 indirectSpecular;
	vec3 radiance;
	vec3 nodeVar96;
	vec3 nodeVar97;
	vec3 iblIrradiance;
	vec3 nodeVar98;
	vec3 nodeVar99;
	vec3 nodeVar100;
	vec3 nodeVar101;
	float nodeVar102;
	float nodeVar103;
	float nodeVar104;
	float nodeVar105;
	vec4 nodeVar106;
	vec4 nodeVar107;
	vec4 nodeVar108;
	float ambientOcclusion;
	vec3 nodeVar109;
	float nodeVar110;
	float nodeVar111;
	float nodeVar112;
	float nodeVar113;
	float nodeVar114;
	float nodeVar115;
	float nodeVar116;
	float nodeVar117;
	float nodeVar118;
	float nodeVar119;
	float nodeVar120;
	vec3 nodeVar121;
	vec3 totalDiffuse;
	vec3 nodeVar122;
	vec3 totalSpecular;
	vec3 nodeVar123;
	vec3 outgoingLight;
	vec3 nodeVar124;

	// flow
	// code

	DiffuseColor = vec4( nodeVarying6, 1.0 );
	DiffuseColor.w = ( DiffuseColor.w * f_nodeUniform0 );
	DiffuseColor.w = 1.0;
	normalViewGeometry = normalize( v_normalViewGeometry );
	NORMAL_normalView = ( normalViewGeometry * vec3( ( ( float( gl_FrontFacing ) * 2.0 ) - 1.0 ) ) );
	normalView = NORMAL_normalView;
	normalWorld = normalize( ( vec4( normalView, 0.0 ) * f_cameraViewMatrix ).xyz );
	nodeVar0 = ( ( smoothstep( 0.78, 0.98, normalWorld.z ) * smoothstep( 0.25, 0.8, ( ( ( sin( ( v_positionWorld.x * 0.31 ) ) * cos( ( v_positionWorld.y * 0.23 ) ) ) * 0.5 ) + 0.5 ) ) ) * f_nodeUniform5 );
	Metalness = mix( 0.12, 0.36, nodeVar0 );
	nodeVar1 = max( abs( dFdx( normalViewGeometry ) ), abs( dFdy( normalViewGeometry ) ) );
	Roughness = min( ( max( mix( 0.78, 0.2, nodeVar0 ), 0.0525 ) + max( max( nodeVar1.x, nodeVar1.y ), nodeVar1.z ) ), 1.0 );
	SpecularColor = mix( vec3( 0.04, 0.04, 0.04 ), DiffuseColor.xyz, Metalness );
	SpecularF90 = 1.0;
	DiffuseColor = vec4( ( DiffuseColor.xyz * vec3( ( 1.0 - mix( 0.12, 0.36, nodeVar0 ) ) ) ), DiffuseColor.w );
	EmissiveColor = ( ( ( nodeVarying6 * vec3( pow( nodeVarying7, 1.25 ) ) ) * vec3( 3.4 ) ) * vec3( ( ( ( sin( ( ( f_nodeUniform6 * 0.75 ) + ( v_positionWorld.x * 0.08 ) ) ) * 0.055 ) * f_nodeUniform7 ) + 1.0 ) ) );
	directDiffuse = vec3( 0.0, 0.0, 0.0 );
	nodeVar2 = ( f_nodeUniform8 - f_nodeUniform9 );
	nodeVar3 = vec4( nodeVar2, 0.0 );
	nodeVar4 = ( f_cameraViewMatrix * nodeVar3 );
	nodeVar5 = normalize( nodeVar4.xyz );
	nodeVar6 = nodeVar5;
	nodeVar7 = dot( normalView, nodeVar6 );
	nodeVar8 = ( vec3( clamp( nodeVar7, 0.0, 1.0 ) ) * f_nodeUniform10 );
	nodeVar9 = ( DiffuseColor.xyz * vec3( 0.3183098861837907 ) );
	nodeVar10 = ( nodeVar8 * nodeVar9 );
	nodeVar11 = ( directDiffuse + nodeVar10 );
	directDiffuse = nodeVar11;
	directSpecular = vec3( 0.0, 0.0, 0.0 );
	positionViewDirection = normalize( v_positionViewDirection );
	nodeVar12 = normalize( ( nodeVar6 + positionViewDirection ) );
	nodeVar13 = clamp( dot( positionViewDirection, nodeVar12 ), 0.0, 1.0 );
	nodeVar14 = exp2( ( ( ( nodeVar13 * -5.55473 ) - 6.98316 ) * nodeVar13 ) );
	nodeVar15 = ( Roughness * Roughness );
	nodeVar16 = vec2( Roughness, clamp( dot( normalView, positionViewDirection ), 0.0, 1.0 ) );
	nodeVar18 = bool( f_nodeUniform12 );

	if ( nodeVar18 ) {

		nodeVar19 = nodeVar16;
		nodeVar17 = vec2( nodeVar19.x, 1.0 - nodeVar19.y );

	} else {

		nodeVar17 = nodeVar16;

	}

	nodeVar20 = texture( nodeUniform11, nodeVar17 );
	nodeVar21 = vec2( Roughness, clamp( dot( normalView, nodeVar6 ), 0.0, 1.0 ) );
	nodeVar23 = bool( f_nodeUniform13 );

	if ( nodeVar23 ) {

		nodeVar24 = nodeVar21;
		nodeVar22 = vec2( nodeVar24.x, 1.0 - nodeVar24.y );

	} else {

		nodeVar22 = nodeVar21;

	}

	nodeVar25 = texture( nodeUniform11, nodeVar22 );
	nodeVar26 = ( SpecularColor + ( ( vec3( 1.0 ) - SpecularColor ) * vec3( 0.047619 ) ) );
	nodeVar27 = ( 1.0 - ( nodeVar20.xy.x + nodeVar20.xy.y ) );
	nodeVar28 = ( 1.0 - ( nodeVar25.xy.x + nodeVar25.xy.y ) );
	nodeVar29 = ( ( ( ( ( SpecularColor * vec3( ( 1.0 - nodeVar14 ) ) ) + vec3( ( 1.0 * nodeVar14 ) ) ) * vec3( V_GGX_SmithCorrelated( nodeVar15, clamp( dot( normalView, nodeVar6 ), 0.0, 1.0 ), clamp( dot( normalView, positionViewDirection ), 0.0, 1.0 ) ) ) ) * vec3( D_GGX( nodeVar15, clamp( dot( normalView, nodeVar12 ), 0.0, 1.0 ) ) ) ) + ( ( ( ( ( ( SpecularColor * vec3( nodeVar20.xy.x ) ) + vec3( ( 1.0 * nodeVar20.xy.y ) ) ) * ( ( SpecularColor * vec3( nodeVar25.xy.x ) ) + vec3( ( 1.0 * nodeVar25.xy.y ) ) ) ) * nodeVar26 ) / ( ( vec3( 1.0 ) - ( ( vec3( ( nodeVar27 * nodeVar28 ) ) * nodeVar26 ) * nodeVar26 ) ) + vec3( 0.000001 ) ) ) * vec3( ( nodeVar27 * nodeVar28 ) ) ) );
	nodeVar30 = ( nodeVar8 * nodeVar29 );
	nodeVar31 = ( directSpecular + nodeVar30 );
	directSpecular = nodeVar31;
	irradiance = vec3( 0.0, 0.0, 0.0 );
	nodeVar32 = dot( normalWorld, normalize( f_nodeUniform16 ) );
	nodeVar33 = ( nodeVar32 * 0.5 );
	nodeVar34 = ( nodeVar33 + 0.5 );
	nodeVar35 = mix( f_nodeUniform14, f_nodeUniform15, nodeVar34 );
	nodeVar36 = ( irradiance + nodeVar35 );
	irradiance = nodeVar36;
	nodeVar37 = ( f_nodeUniform17 - v_positionView );
	nodeVar38 = normalize( nodeVar37 );
	nodeVar39 = dot( normalView, nodeVar38 );

	if ( ( f_nodeUniform19 > 0.0 ) ) {

		nodeVar41 = length( nodeVar37 );
		nodeVar42 = ( nodeVar41 / f_nodeUniform19 );
		nodeVar43 = clamp( ( 1.0 - ( ( ( nodeVar42 * nodeVar42 ) * nodeVar42 ) * nodeVar42 ) ), 0.0, 1.0 );
		nodeVar40 = ( ( 1.0 / max( pow( nodeVar41, f_nodeUniform20 ), 0.01 ) ) * ( nodeVar43 * nodeVar43 ) );

	} else {

		nodeVar40 = ( 1.0 / max( pow( length( nodeVar37 ), f_nodeUniform20 ), 0.01 ) );

	}

	nodeVar44 = ( f_nodeUniform18 * vec3( nodeVar40 ) );
	nodeVar45 = ( vec3( clamp( nodeVar39, 0.0, 1.0 ) ) * nodeVar44 );
	nodeVar46 = ( DiffuseColor.xyz * vec3( 0.3183098861837907 ) );
	nodeVar47 = ( nodeVar45 * nodeVar46 );
	nodeVar48 = ( directDiffuse + nodeVar47 );
	directDiffuse = nodeVar48;
	nodeVar49 = normalize( ( nodeVar38 + positionViewDirection ) );
	nodeVar50 = clamp( dot( positionViewDirection, nodeVar49 ), 0.0, 1.0 );
	nodeVar51 = exp2( ( ( ( nodeVar50 * -5.55473 ) - 6.98316 ) * nodeVar50 ) );
	nodeVar52 = ( Roughness * Roughness );
	nodeVar53 = vec2( Roughness, clamp( dot( normalView, positionViewDirection ), 0.0, 1.0 ) );
	nodeVar55 = bool( f_nodeUniform21 );

	if ( nodeVar55 ) {

		nodeVar56 = nodeVar53;
		nodeVar54 = vec2( nodeVar56.x, 1.0 - nodeVar56.y );

	} else {

		nodeVar54 = nodeVar53;

	}

	nodeVar57 = texture( nodeUniform11, nodeVar54 );
	nodeVar58 = vec2( Roughness, clamp( dot( normalView, nodeVar38 ), 0.0, 1.0 ) );
	nodeVar60 = bool( f_nodeUniform22 );

	if ( nodeVar60 ) {

		nodeVar61 = nodeVar58;
		nodeVar59 = vec2( nodeVar61.x, 1.0 - nodeVar61.y );

	} else {

		nodeVar59 = nodeVar58;

	}

	nodeVar62 = texture( nodeUniform11, nodeVar59 );
	nodeVar63 = ( SpecularColor + ( ( vec3( 1.0 ) - SpecularColor ) * vec3( 0.047619 ) ) );
	nodeVar64 = ( 1.0 - ( nodeVar57.xy.x + nodeVar57.xy.y ) );
	nodeVar65 = ( 1.0 - ( nodeVar62.xy.x + nodeVar62.xy.y ) );
	nodeVar66 = ( ( ( ( ( SpecularColor * vec3( ( 1.0 - nodeVar51 ) ) ) + vec3( ( 1.0 * nodeVar51 ) ) ) * vec3( V_GGX_SmithCorrelated( nodeVar52, clamp( dot( normalView, nodeVar38 ), 0.0, 1.0 ), clamp( dot( normalView, positionViewDirection ), 0.0, 1.0 ) ) ) ) * vec3( D_GGX( nodeVar52, clamp( dot( normalView, nodeVar49 ), 0.0, 1.0 ) ) ) ) + ( ( ( ( ( ( SpecularColor * vec3( nodeVar57.xy.x ) ) + vec3( ( 1.0 * nodeVar57.xy.y ) ) ) * ( ( SpecularColor * vec3( nodeVar62.xy.x ) ) + vec3( ( 1.0 * nodeVar62.xy.y ) ) ) ) * nodeVar63 ) / ( ( vec3( 1.0 ) - ( ( vec3( ( nodeVar64 * nodeVar65 ) ) * nodeVar63 ) * nodeVar63 ) ) + vec3( 0.000001 ) ) ) * vec3( ( nodeVar64 * nodeVar65 ) ) ) );
	nodeVar67 = ( nodeVar45 * nodeVar66 );
	nodeVar68 = ( directSpecular + nodeVar67 );
	directSpecular = nodeVar68;
	indirectDiffuse = vec3( 0.0, 0.0, 0.0 );
	nodeVar69 = ( DiffuseColor * vec4( 0.3183098861837907 ) );
	nodeVar70 = ( vec4( irradiance, 1.0 ) * nodeVar69 );
	nodeVar71 = ( vec4( indirectDiffuse, 1.0 ) + nodeVar70 );
	indirectDiffuse = nodeVar71.xyz;
	singleScattering = vec3( 0.0, 0.0, 0.0 );
	multiScattering = vec3( 0.0, 0.0, 0.0 );
	nodeVar72 = dot( normalView, positionViewDirection );
	nodeVar73 = vec2( Roughness, clamp( nodeVar72, 0.0, 1.0 ) );
	nodeVar75 = bool( f_nodeUniform23 );

	if ( nodeVar75 ) {

		nodeVar76 = nodeVar73;
		nodeVar74 = vec2( nodeVar76.x, 1.0 - nodeVar76.y );

	} else {

		nodeVar74 = nodeVar73;

	}

	nodeVar77 = texture( nodeUniform11, nodeVar74 );
	nodeVar78 = ( SpecularColor * vec3( nodeVar77.xy.x ) );
	nodeVar79 = ( SpecularF90 * nodeVar77.xy.y );
	nodeVar80 = ( nodeVar78 + vec3( nodeVar79 ) );
	nodeVar81 = ( singleScattering + nodeVar80 );
	singleScattering = nodeVar81;
	nodeVar82 = ( vec3( 1.0 ) - SpecularColor );
	nodeVar83 = nodeVar82;
	nodeVar84 = ( nodeVar83 * vec3( 0.047619 ) );
	nodeVar85 = ( SpecularColor + nodeVar84 );
	nodeVar86 = ( nodeVar80 * nodeVar85 );
	nodeVar87 = ( nodeVar77.xy.x + nodeVar77.xy.y );
	nodeVar88 = ( 1.0 - nodeVar87 );
	nodeVar89 = nodeVar88;
	nodeVar90 = ( vec3( nodeVar89 ) * nodeVar85 );
	nodeVar91 = ( vec3( 1.0 ) - nodeVar90 );
	nodeVar92 = nodeVar91;
	nodeVar93 = ( nodeVar86 / nodeVar92 );
	nodeVar94 = ( nodeVar93 * vec3( nodeVar89 ) );
	nodeVar95 = ( multiScattering + nodeVar94 );
	multiScattering = nodeVar95;
	indirectSpecular = vec3( 0.0, 0.0, 0.0 );
	radiance = vec3( 0.0, 0.0, 0.0 );
	nodeVar96 = ( radiance * singleScattering );
	nodeVar97 = ( indirectSpecular + nodeVar96 );
	indirectSpecular = nodeVar97;
	iblIrradiance = vec3( 0.0, 0.0, 0.0 );
	nodeVar98 = ( iblIrradiance * vec3( 0.3183098861837907 ) );
	nodeVar99 = ( multiScattering * nodeVar98 );
	nodeVar100 = ( indirectSpecular + nodeVar99 );
	indirectSpecular = nodeVar100;
	nodeVar101 = ( singleScattering + multiScattering );
	nodeVar102 = max( nodeVar101.x, nodeVar101.y );
	nodeVar103 = max( nodeVar102, nodeVar101.z );
	nodeVar104 = ( 1.0 - nodeVar103 );
	nodeVar105 = nodeVar104;
	nodeVar106 = ( DiffuseColor * vec4( nodeVar105 ) );
	nodeVar107 = ( nodeVar106 * vec4( nodeVar98, 1.0 ) );
	nodeVar108 = ( vec4( indirectDiffuse, 1.0 ) + nodeVar107 );
	indirectDiffuse = nodeVar108.xyz;
	ambientOcclusion = 1.0;
	nodeVar109 = ( indirectDiffuse * vec3( ambientOcclusion ) );
	indirectDiffuse = nodeVar109;
	nodeVar110 = dot( normalView, positionViewDirection );
	nodeVar111 = ( clamp( nodeVar110, 0.0, 1.0 ) + ambientOcclusion );
	nodeVar112 = ( Roughness * -16.0 );
	nodeVar113 = ( 1.0 - nodeVar112 );
	nodeVar114 = nodeVar113;
	nodeVar115 = ( - nodeVar114 );
	nodeVar116 = exp2( nodeVar115 );
	nodeVar117 = pow( nodeVar111, nodeVar116 );
	nodeVar118 = ( 1.0 - nodeVar117 );
	nodeVar119 = nodeVar118;
	nodeVar120 = ( ambientOcclusion - nodeVar119 );
	nodeVar121 = ( indirectSpecular * vec3( clamp( nodeVar120, 0.0, 1.0 ) ) );
	indirectSpecular = nodeVar121;
	nodeVar122 = ( directDiffuse + indirectDiffuse );
	totalDiffuse = nodeVar122;
	nodeVar123 = ( directSpecular + indirectSpecular );
	totalSpecular = nodeVar123;
	nodeVar124 = ( totalDiffuse + totalSpecular );
	outgoingLight = nodeVar124;
	Output = max( vec4( ( outgoingLight + EmissiveColor ), DiffuseColor.w ), 0.0 );
	m0 = Output;
	m1 = vec4( normalView, 1.0 );
	m2 = vec4( 0.0, 0.0, 0.0, 1.0 );
	m3 = vec4( EmissiveColor, 1.0 );

	// result
	

}
