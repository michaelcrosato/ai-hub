// Three.js r181 - Node System

// global
diagnostic( off, derivative_uniformity );


// structs

struct OutputType {
	@location( 0 ) m0 : vec4<f32>,
	@location( 1 ) m1 : vec4<f32>,
	@location( 2 ) m2 : vec4<f32>,
	@location( 3 ) m3 : vec4<f32>,
	
};
var<private> output : OutputType;

// uniforms
@binding( 1 ) @group( 1 ) var nodeUniform11_sampler : sampler;
@binding( 2 ) @group( 1 ) var nodeUniform11 : texture_2d<f32>;
struct objectStruct {
	nodeUniform0 : f32,
	nodeUniform5 : f32,
	nodeUniform6 : f32,
	nodeUniform7 : f32
};
@binding( 0 ) @group( 1 )
var<uniform> object : objectStruct;

struct renderStruct {
	cameraViewMatrix : mat4x4<f32>,
	nodeUniform8 : vec3<f32>,
	nodeUniform9 : vec3<f32>,
	nodeUniform10 : vec3<f32>,
	nodeUniform12 : vec3<f32>,
	nodeUniform13 : vec3<f32>,
	nodeUniform14 : vec3<f32>,
	nodeUniform15 : vec3<f32>,
	nodeUniform16 : vec3<f32>,
	nodeUniform17 : f32,
	nodeUniform18 : f32
};
@binding( 0 ) @group( 0 )
var<uniform> render : renderStruct;

// codes
fn V_GGX_SmithCorrelated ( alpha : f32, dotNL : f32, dotNV : f32 ) -> f32 {

	var nodeVar0 : f32;

	nodeVar0 = ( alpha * alpha );

	return ( 0.5 / max( ( ( dotNL * sqrt( ( nodeVar0 + ( ( 1.0 - nodeVar0 ) * ( dotNV * dotNV ) ) ) ) ) + ( dotNV * sqrt( ( nodeVar0 + ( ( 1.0 - nodeVar0 ) * ( dotNL * dotNL ) ) ) ) ) ), 0.000001 ) );

}

fn D_GGX ( alpha : f32, dotNH : f32 ) -> f32 {

	var nodeVar0 : f32;
	var nodeVar1 : f32;

	nodeVar0 = ( alpha * alpha );
	nodeVar1 = ( 1.0 - ( ( dotNH * dotNH ) * ( 1.0 - nodeVar0 ) ) );

	return ( ( nodeVar0 / ( nodeVar1 * nodeVar1 ) ) * 0.3183098861837907 );

}



@fragment
fn main( @location( 1 ) v_positionView : vec3<f32>,
	@location( 3 ) v_positionWorld : vec3<f32>,
	@location( 4 ) v_normalViewGeometry : vec3<f32>,
	@location( 5 ) v_positionViewDirection : vec3<f32>,
	@location( 6 ) nodeVarying6 : vec3<f32>,
	@location( 7 ) nodeVarying7 : f32,
	@builtin( front_facing ) isFront : bool ) -> OutputType {

	// vars
	
	var DiffuseColor : vec4<f32>;
	var Metalness : f32;
	var normalViewGeometry : vec3<f32>;
	var NORMAL_normalView : vec3<f32>;
	var normalView : vec3<f32>;
	var normalWorld : vec3<f32>;
	var nodeVar0 : f32;
	var Roughness : f32;
	var nodeVar1 : vec3<f32>;
	var SpecularColor : vec3<f32>;
	var SpecularF90 : f32;
	var EmissiveColor : vec3<f32>;
	var Output : vec4<f32>;
	var directDiffuse : vec3<f32>;
	var nodeVar2 : vec3<f32>;
	var nodeVar3 : vec4<f32>;
	var nodeVar4 : vec4<f32>;
	var nodeVar5 : vec3<f32>;
	var nodeVar6 : vec3<f32>;
	var nodeVar7 : f32;
	var nodeVar8 : vec3<f32>;
	var nodeVar9 : vec3<f32>;
	var nodeVar10 : vec3<f32>;
	var nodeVar11 : vec3<f32>;
	var directSpecular : vec3<f32>;
	var positionViewDirection : vec3<f32>;
	var nodeVar12 : vec3<f32>;
	var nodeVar13 : f32;
	var nodeVar14 : f32;
	var nodeVar15 : f32;
	var nodeVar16 : vec4<f32>;
	var nodeVar17 : vec4<f32>;
	var nodeVar18 : vec3<f32>;
	var nodeVar19 : f32;
	var nodeVar20 : f32;
	var nodeVar21 : vec3<f32>;
	var nodeVar22 : vec3<f32>;
	var nodeVar23 : vec3<f32>;
	var irradiance : vec3<f32>;
	var nodeVar24 : f32;
	var nodeVar25 : f32;
	var nodeVar26 : f32;
	var nodeVar27 : vec3<f32>;
	var nodeVar28 : vec3<f32>;
	var nodeVar29 : vec3<f32>;
	var nodeVar30 : vec3<f32>;
	var nodeVar31 : f32;
	var nodeVar32 : f32;
	var nodeVar33 : f32;
	var nodeVar34 : f32;
	var nodeVar35 : f32;
	var nodeVar36 : vec3<f32>;
	var nodeVar37 : vec3<f32>;
	var nodeVar38 : vec3<f32>;
	var nodeVar39 : vec3<f32>;
	var nodeVar40 : vec3<f32>;
	var nodeVar41 : vec3<f32>;
	var nodeVar42 : f32;
	var nodeVar43 : f32;
	var nodeVar44 : f32;
	var nodeVar45 : vec4<f32>;
	var nodeVar46 : vec4<f32>;
	var nodeVar47 : vec3<f32>;
	var nodeVar48 : f32;
	var nodeVar49 : f32;
	var nodeVar50 : vec3<f32>;
	var nodeVar51 : vec3<f32>;
	var nodeVar52 : vec3<f32>;
	var indirectDiffuse : vec3<f32>;
	var nodeVar53 : vec4<f32>;
	var nodeVar54 : vec4<f32>;
	var nodeVar55 : vec4<f32>;
	var singleScattering : vec3<f32>;
	var multiScattering : vec3<f32>;
	var nodeVar56 : f32;
	var nodeVar57 : vec4<f32>;
	var nodeVar58 : vec3<f32>;
	var nodeVar59 : f32;
	var nodeVar60 : vec3<f32>;
	var nodeVar61 : vec3<f32>;
	var nodeVar62 : vec3<f32>;
	var nodeVar63 : vec3<f32>;
	var nodeVar64 : vec3<f32>;
	var nodeVar65 : vec3<f32>;
	var nodeVar66 : vec3<f32>;
	var nodeVar67 : f32;
	var nodeVar68 : f32;
	var nodeVar69 : f32;
	var nodeVar70 : vec3<f32>;
	var nodeVar71 : vec3<f32>;
	var nodeVar72 : vec3<f32>;
	var nodeVar73 : vec3<f32>;
	var nodeVar74 : vec3<f32>;
	var nodeVar75 : vec3<f32>;
	var indirectSpecular : vec3<f32>;
	var radiance : vec3<f32>;
	var nodeVar76 : vec3<f32>;
	var nodeVar77 : vec3<f32>;
	var iblIrradiance : vec3<f32>;
	var nodeVar78 : vec3<f32>;
	var nodeVar79 : vec3<f32>;
	var nodeVar80 : vec3<f32>;
	var nodeVar81 : vec3<f32>;
	var nodeVar82 : f32;
	var nodeVar83 : f32;
	var nodeVar84 : f32;
	var nodeVar85 : f32;
	var nodeVar86 : vec4<f32>;
	var nodeVar87 : vec4<f32>;
	var nodeVar88 : vec4<f32>;
	var ambientOcclusion : f32;
	var nodeVar89 : vec3<f32>;
	var nodeVar90 : f32;
	var nodeVar91 : f32;
	var nodeVar92 : f32;
	var nodeVar93 : f32;
	var nodeVar94 : f32;
	var nodeVar95 : f32;
	var nodeVar96 : f32;
	var nodeVar97 : f32;
	var nodeVar98 : f32;
	var nodeVar99 : f32;
	var nodeVar100 : f32;
	var nodeVar101 : vec3<f32>;
	var totalDiffuse : vec3<f32>;
	var nodeVar102 : vec3<f32>;
	var totalSpecular : vec3<f32>;
	var nodeVar103 : vec3<f32>;
	var outgoingLight : vec3<f32>;
	var nodeVar104 : vec3<f32>;


	// flow
	// code

	DiffuseColor = vec4<f32>( nodeVarying6, 1.0 );
	DiffuseColor.w = ( DiffuseColor.w * object.nodeUniform0 );
	DiffuseColor.w = 1.0;
	normalViewGeometry = normalize( v_normalViewGeometry );
	NORMAL_normalView = ( normalViewGeometry * vec3<f32>( ( ( f32( isFront ) * 2.0 ) - 1.0 ) ) );
	normalView = NORMAL_normalView;
	normalWorld = normalize( ( vec4<f32>( normalView, 0.0 ) * render.cameraViewMatrix ).xyz );
	nodeVar0 = ( ( smoothstep( 0.78, 0.98, normalWorld.z ) * smoothstep( 0.25, 0.8, ( ( ( sin( ( v_positionWorld.x * 0.31 ) ) * cos( ( v_positionWorld.y * 0.23 ) ) ) * 0.5 ) + 0.5 ) ) ) * object.nodeUniform5 );
	Metalness = mix( 0.12, 0.36, nodeVar0 );
	nodeVar1 = max( abs( dpdx( normalViewGeometry ) ), abs( - dpdy( normalViewGeometry ) ) );
	Roughness = min( ( max( mix( 0.78, 0.2, nodeVar0 ), 0.0525 ) + max( max( nodeVar1.x, nodeVar1.y ), nodeVar1.z ) ), 1.0 );
	SpecularColor = mix( vec3<f32>( 0.04, 0.04, 0.04 ), DiffuseColor.xyz, Metalness );
	SpecularF90 = 1.0;
	DiffuseColor = vec4<f32>( ( DiffuseColor.xyz * vec3<f32>( ( 1.0 - mix( 0.12, 0.36, nodeVar0 ) ) ) ), DiffuseColor.w );
	EmissiveColor = ( ( ( nodeVarying6 * vec3<f32>( pow( nodeVarying7, 1.25 ) ) ) * vec3<f32>( 3.4 ) ) * vec3<f32>( ( ( ( sin( ( ( object.nodeUniform6 * 0.75 ) + ( v_positionWorld.x * 0.08 ) ) ) * 0.055 ) * object.nodeUniform7 ) + 1.0 ) ) );
	directDiffuse = vec3<f32>( 0.0, 0.0, 0.0 );
	nodeVar2 = ( render.nodeUniform8 - render.nodeUniform9 );
	nodeVar3 = vec4<f32>( nodeVar2, 0.0 );
	nodeVar4 = ( render.cameraViewMatrix * nodeVar3 );
	nodeVar5 = normalize( nodeVar4.xyz );
	nodeVar6 = nodeVar5;
	nodeVar7 = dot( normalView, nodeVar6 );
	nodeVar8 = ( vec3<f32>( clamp( nodeVar7, 0.0, 1.0 ) ) * render.nodeUniform10 );
	nodeVar9 = ( DiffuseColor.xyz * vec3<f32>( 0.3183098861837907 ) );
	nodeVar10 = ( nodeVar8 * nodeVar9 );
	nodeVar11 = ( directDiffuse + nodeVar10 );
	directDiffuse = nodeVar11;
	directSpecular = vec3<f32>( 0.0, 0.0, 0.0 );
	positionViewDirection = normalize( v_positionViewDirection );
	nodeVar12 = normalize( ( nodeVar6 + positionViewDirection ) );
	nodeVar13 = clamp( dot( positionViewDirection, nodeVar12 ), 0.0, 1.0 );
	nodeVar14 = exp2( ( ( ( nodeVar13 * -5.55473 ) - 6.98316 ) * nodeVar13 ) );
	nodeVar15 = ( Roughness * Roughness );
	nodeVar16 = textureSample( nodeUniform11, nodeUniform11_sampler, vec2<f32>( Roughness, clamp( dot( normalView, positionViewDirection ), 0.0, 1.0 ) ) );
	nodeVar17 = textureSample( nodeUniform11, nodeUniform11_sampler, vec2<f32>( Roughness, clamp( dot( normalView, nodeVar6 ), 0.0, 1.0 ) ) );
	nodeVar18 = ( SpecularColor + ( ( vec3<f32>( 1.0 ) - SpecularColor ) * vec3<f32>( 0.047619 ) ) );
	nodeVar19 = ( 1.0 - ( nodeVar16.xy.x + nodeVar16.xy.y ) );
	nodeVar20 = ( 1.0 - ( nodeVar17.xy.x + nodeVar17.xy.y ) );
	nodeVar21 = ( ( ( ( ( SpecularColor * vec3<f32>( ( 1.0 - nodeVar14 ) ) ) + vec3<f32>( ( 1.0 * nodeVar14 ) ) ) * vec3<f32>( V_GGX_SmithCorrelated( nodeVar15, clamp( dot( normalView, nodeVar6 ), 0.0, 1.0 ), clamp( dot( normalView, positionViewDirection ), 0.0, 1.0 ) ) ) ) * vec3<f32>( D_GGX( nodeVar15, clamp( dot( normalView, nodeVar12 ), 0.0, 1.0 ) ) ) ) + ( ( ( ( ( ( SpecularColor * vec3<f32>( nodeVar16.xy.x ) ) + vec3<f32>( ( 1.0 * nodeVar16.xy.y ) ) ) * ( ( SpecularColor * vec3<f32>( nodeVar17.xy.x ) ) + vec3<f32>( ( 1.0 * nodeVar17.xy.y ) ) ) ) * nodeVar18 ) / ( ( vec3<f32>( 1.0 ) - ( ( vec3<f32>( ( nodeVar19 * nodeVar20 ) ) * nodeVar18 ) * nodeVar18 ) ) + vec3<f32>( 0.000001 ) ) ) * vec3<f32>( ( nodeVar19 * nodeVar20 ) ) ) );
	nodeVar22 = ( nodeVar8 * nodeVar21 );
	nodeVar23 = ( directSpecular + nodeVar22 );
	directSpecular = nodeVar23;
	irradiance = vec3<f32>( 0.0, 0.0, 0.0 );
	nodeVar24 = dot( normalWorld, normalize( render.nodeUniform14 ) );
	nodeVar25 = ( nodeVar24 * 0.5 );
	nodeVar26 = ( nodeVar25 + 0.5 );
	nodeVar27 = mix( render.nodeUniform12, render.nodeUniform13, nodeVar26 );
	nodeVar28 = ( irradiance + nodeVar27 );
	irradiance = nodeVar28;
	nodeVar29 = ( render.nodeUniform15 - v_positionView );
	nodeVar30 = normalize( nodeVar29 );
	nodeVar31 = dot( normalView, nodeVar30 );

	if ( ( render.nodeUniform17 > 0.0 ) ) {

		nodeVar33 = length( nodeVar29 );
		nodeVar34 = ( nodeVar33 / render.nodeUniform17 );
		nodeVar35 = clamp( ( 1.0 - ( ( ( nodeVar34 * nodeVar34 ) * nodeVar34 ) * nodeVar34 ) ), 0.0, 1.0 );
		nodeVar32 = ( ( 1.0 / max( pow( nodeVar33, render.nodeUniform18 ), 0.01 ) ) * ( nodeVar35 * nodeVar35 ) );

	} else {

		nodeVar32 = ( 1.0 / max( pow( length( nodeVar29 ), render.nodeUniform18 ), 0.01 ) );

	}

	nodeVar36 = ( render.nodeUniform16 * vec3<f32>( nodeVar32 ) );
	nodeVar37 = ( vec3<f32>( clamp( nodeVar31, 0.0, 1.0 ) ) * nodeVar36 );
	nodeVar38 = ( DiffuseColor.xyz * vec3<f32>( 0.3183098861837907 ) );
	nodeVar39 = ( nodeVar37 * nodeVar38 );
	nodeVar40 = ( directDiffuse + nodeVar39 );
	directDiffuse = nodeVar40;
	nodeVar41 = normalize( ( nodeVar30 + positionViewDirection ) );
	nodeVar42 = clamp( dot( positionViewDirection, nodeVar41 ), 0.0, 1.0 );
	nodeVar43 = exp2( ( ( ( nodeVar42 * -5.55473 ) - 6.98316 ) * nodeVar42 ) );
	nodeVar44 = ( Roughness * Roughness );
	nodeVar45 = textureSample( nodeUniform11, nodeUniform11_sampler, vec2<f32>( Roughness, clamp( dot( normalView, positionViewDirection ), 0.0, 1.0 ) ) );
	nodeVar46 = textureSample( nodeUniform11, nodeUniform11_sampler, vec2<f32>( Roughness, clamp( dot( normalView, nodeVar30 ), 0.0, 1.0 ) ) );
	nodeVar47 = ( SpecularColor + ( ( vec3<f32>( 1.0 ) - SpecularColor ) * vec3<f32>( 0.047619 ) ) );
	nodeVar48 = ( 1.0 - ( nodeVar45.xy.x + nodeVar45.xy.y ) );
	nodeVar49 = ( 1.0 - ( nodeVar46.xy.x + nodeVar46.xy.y ) );
	nodeVar50 = ( ( ( ( ( SpecularColor * vec3<f32>( ( 1.0 - nodeVar43 ) ) ) + vec3<f32>( ( 1.0 * nodeVar43 ) ) ) * vec3<f32>( V_GGX_SmithCorrelated( nodeVar44, clamp( dot( normalView, nodeVar30 ), 0.0, 1.0 ), clamp( dot( normalView, positionViewDirection ), 0.0, 1.0 ) ) ) ) * vec3<f32>( D_GGX( nodeVar44, clamp( dot( normalView, nodeVar41 ), 0.0, 1.0 ) ) ) ) + ( ( ( ( ( ( SpecularColor * vec3<f32>( nodeVar45.xy.x ) ) + vec3<f32>( ( 1.0 * nodeVar45.xy.y ) ) ) * ( ( SpecularColor * vec3<f32>( nodeVar46.xy.x ) ) + vec3<f32>( ( 1.0 * nodeVar46.xy.y ) ) ) ) * nodeVar47 ) / ( ( vec3<f32>( 1.0 ) - ( ( vec3<f32>( ( nodeVar48 * nodeVar49 ) ) * nodeVar47 ) * nodeVar47 ) ) + vec3<f32>( 0.000001 ) ) ) * vec3<f32>( ( nodeVar48 * nodeVar49 ) ) ) );
	nodeVar51 = ( nodeVar37 * nodeVar50 );
	nodeVar52 = ( directSpecular + nodeVar51 );
	directSpecular = nodeVar52;
	indirectDiffuse = vec3<f32>( 0.0, 0.0, 0.0 );
	nodeVar53 = ( DiffuseColor * vec4<f32>( 0.3183098861837907 ) );
	nodeVar54 = ( vec4<f32>( irradiance, 1.0 ) * nodeVar53 );
	nodeVar55 = ( vec4<f32>( indirectDiffuse, 1.0 ) + nodeVar54 );
	indirectDiffuse = nodeVar55.xyz;
	singleScattering = vec3<f32>( 0.0, 0.0, 0.0 );
	multiScattering = vec3<f32>( 0.0, 0.0, 0.0 );
	nodeVar56 = dot( normalView, positionViewDirection );
	nodeVar57 = textureSample( nodeUniform11, nodeUniform11_sampler, vec2<f32>( Roughness, clamp( nodeVar56, 0.0, 1.0 ) ) );
	nodeVar58 = ( SpecularColor * vec3<f32>( nodeVar57.xy.x ) );
	nodeVar59 = ( SpecularF90 * nodeVar57.xy.y );
	nodeVar60 = ( nodeVar58 + vec3<f32>( nodeVar59 ) );
	nodeVar61 = ( singleScattering + nodeVar60 );
	singleScattering = nodeVar61;
	nodeVar62 = ( vec3<f32>( 1.0 ) - SpecularColor );
	nodeVar63 = nodeVar62;
	nodeVar64 = ( nodeVar63 * vec3<f32>( 0.047619 ) );
	nodeVar65 = ( SpecularColor + nodeVar64 );
	nodeVar66 = ( nodeVar60 * nodeVar65 );
	nodeVar67 = ( nodeVar57.xy.x + nodeVar57.xy.y );
	nodeVar68 = ( 1.0 - nodeVar67 );
	nodeVar69 = nodeVar68;
	nodeVar70 = ( vec3<f32>( nodeVar69 ) * nodeVar65 );
	nodeVar71 = ( vec3<f32>( 1.0 ) - nodeVar70 );
	nodeVar72 = nodeVar71;
	nodeVar73 = ( nodeVar66 / nodeVar72 );
	nodeVar74 = ( nodeVar73 * vec3<f32>( nodeVar69 ) );
	nodeVar75 = ( multiScattering + nodeVar74 );
	multiScattering = nodeVar75;
	indirectSpecular = vec3<f32>( 0.0, 0.0, 0.0 );
	radiance = vec3<f32>( 0.0, 0.0, 0.0 );
	nodeVar76 = ( radiance * singleScattering );
	nodeVar77 = ( indirectSpecular + nodeVar76 );
	indirectSpecular = nodeVar77;
	iblIrradiance = vec3<f32>( 0.0, 0.0, 0.0 );
	nodeVar78 = ( iblIrradiance * vec3<f32>( 0.3183098861837907 ) );
	nodeVar79 = ( multiScattering * nodeVar78 );
	nodeVar80 = ( indirectSpecular + nodeVar79 );
	indirectSpecular = nodeVar80;
	nodeVar81 = ( singleScattering + multiScattering );
	nodeVar82 = max( nodeVar81.x, nodeVar81.y );
	nodeVar83 = max( nodeVar82, nodeVar81.z );
	nodeVar84 = ( 1.0 - nodeVar83 );
	nodeVar85 = nodeVar84;
	nodeVar86 = ( DiffuseColor * vec4<f32>( nodeVar85 ) );
	nodeVar87 = ( nodeVar86 * vec4<f32>( nodeVar78, 1.0 ) );
	nodeVar88 = ( vec4<f32>( indirectDiffuse, 1.0 ) + nodeVar87 );
	indirectDiffuse = nodeVar88.xyz;
	ambientOcclusion = 1.0;
	nodeVar89 = ( indirectDiffuse * vec3<f32>( ambientOcclusion ) );
	indirectDiffuse = nodeVar89;
	nodeVar90 = dot( normalView, positionViewDirection );
	nodeVar91 = ( clamp( nodeVar90, 0.0, 1.0 ) + ambientOcclusion );
	nodeVar92 = ( Roughness * -16.0 );
	nodeVar93 = ( 1.0 - nodeVar92 );
	nodeVar94 = nodeVar93;
	nodeVar95 = ( - nodeVar94 );
	nodeVar96 = exp2( nodeVar95 );
	nodeVar97 = pow( nodeVar91, nodeVar96 );
	nodeVar98 = ( 1.0 - nodeVar97 );
	nodeVar99 = nodeVar98;
	nodeVar100 = ( ambientOcclusion - nodeVar99 );
	nodeVar101 = ( indirectSpecular * vec3<f32>( clamp( nodeVar100, 0.0, 1.0 ) ) );
	indirectSpecular = nodeVar101;
	nodeVar102 = ( directDiffuse + indirectDiffuse );
	totalDiffuse = nodeVar102;
	nodeVar103 = ( directSpecular + indirectSpecular );
	totalSpecular = nodeVar103;
	nodeVar104 = ( totalDiffuse + totalSpecular );
	outgoingLight = nodeVar104;
	Output = max( vec4<f32>( ( outgoingLight + EmissiveColor ), DiffuseColor.w ), vec4<f32>( 0.0 ) );
	output.m0 = Output;
	output.m1 = vec4<f32>( normalView, 1.0 );
	output.m2 = vec4<f32>( 0.0, 0.0, 0.0, 1.0 );
	output.m3 = vec4<f32>( EmissiveColor, 1.0 );

	// result

	return output;

}
