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
@binding( 1 ) @group( 1 ) var nodeUniform4 : texture_2d<f32>;
struct objectStruct {
	nodeUniform0 : f32,
	nodeUniform1 : f32,
	nodeUniform3 : f32,
	nodeUniform5 : mat3x3<f32>,
	nodeUniform15 : mat3x3<f32>
};
@binding( 0 ) @group( 1 )
var<uniform> object : objectStruct;

struct renderStruct {
	cameraViewMatrix : mat4x4<f32>,
	nodeUniform7 : vec3<f32>,
	nodeUniform8 : vec3<f32>,
	nodeUniform9 : vec3<f32>,
	nodeUniform10 : vec3<f32>,
	nodeUniform11 : vec3<f32>,
	nodeUniform14 : vec3<f32>,
	nodeUniform16 : vec3<f32>,
	nodeUniform17 : vec3<f32>,
	nodeUniform18 : f32,
	nodeUniform19 : f32
};
@binding( 0 ) @group( 0 )
var<uniform> render : renderStruct;

// codes
fn tsl_clampWrapping_float( coord: f32 ) -> f32 { return clamp( coord, 0.0, 1.0 ); }
fn tsl_coord_clampS_clamp_2dT( coord : vec2f ) -> vec2f {

	return vec2f(
		tsl_clampWrapping_float( coord.x ),
		tsl_clampWrapping_float( coord.y )
	);

}



@fragment
fn main( @location( 1 ) v_positionView : vec3<f32>,
	@location( 3 ) v_positionWorld : vec3<f32>,
	@location( 4 ) v_normalViewGeometry : vec3<f32>,
	@location( 5 ) nodeVarying5 : vec3<f32>,
	@location( 6 ) nodeVarying6 : f32,
	@location( 7 ) nodeVarying7 : vec3<f32>,
	@builtin( front_facing ) isFront : bool ) -> OutputType {

	// vars
	
	var DiffuseColor : vec4<f32>;
	var EmissiveColor : vec3<f32>;
	var Output : vec4<f32>;
	var directDiffuse : vec3<f32>;
	var nodeVar0 : vec3<f32>;
	var nodeVar1 : vec3<f32>;
	var nodeVar2 : vec4<f32>;
	var nodeVar3 : vec2<u32>;
	var nodeVar4 : vec3<f32>;
	var nodeVar5 : vec3<f32>;
	var nodeVar6 : vec3<f32>;
	var nodeVar7 : vec3<f32>;
	var irradiance : vec3<f32>;
	var normalViewGeometry : vec3<f32>;
	var NORMAL_normalView : vec3<f32>;
	var normalView : vec3<f32>;
	var nodeVar8 : vec4<f32>;
	var nodeVar9 : vec4<f32>;
	var nodeVar10 : vec3<f32>;
	var normalWorld : vec3<f32>;
	var nodeVar11 : f32;
	var nodeVar12 : f32;
	var nodeVar13 : f32;
	var nodeVar14 : vec3<f32>;
	var nodeVar15 : vec3<f32>;
	var nodeVar16 : vec3<f32>;
	var nodeVar17 : vec3<f32>;
	var nodeVar18 : vec4<f32>;
	var nodeVar19 : f32;
	var nodeVar20 : f32;
	var nodeVar21 : f32;
	var nodeVar22 : f32;
	var nodeVar23 : vec3<f32>;
	var nodeVar24 : vec3<f32>;
	var nodeVar25 : vec3<f32>;
	var nodeVar26 : vec3<f32>;
	var nodeVar27 : vec3<f32>;
	var indirectDiffuse : vec3<f32>;
	var nodeVar28 : vec4<f32>;
	var nodeVar29 : vec4<f32>;
	var nodeVar30 : vec4<f32>;
	var ambientOcclusion : f32;
	var nodeVar31 : vec3<f32>;
	var totalDiffuse : vec3<f32>;
	var nodeVar32 : vec3<f32>;
	var totalSpecular : vec3<f32>;
	var directSpecular : vec3<f32>;
	var indirectSpecular : vec3<f32>;
	var nodeVar33 : vec3<f32>;
	var outgoingLight : vec3<f32>;
	var nodeVar34 : vec3<f32>;


	// flow
	// code

	DiffuseColor = vec4<f32>( nodeVarying5, 1.0 );
	DiffuseColor.w = ( DiffuseColor.w * object.nodeUniform0 );
	DiffuseColor.w = 1.0;
	EmissiveColor = ( ( ( nodeVarying5 * vec3<f32>( pow( nodeVarying6, 1.25 ) ) ) * vec3<f32>( 3.4 ) ) * vec3<f32>( ( ( ( sin( ( ( object.nodeUniform1 * 0.75 ) + ( v_positionWorld.x * 0.08 ) ) ) * 0.055 ) * object.nodeUniform3 ) + 1.0 ) ) );
	directDiffuse = vec3<f32>( 0.0, 0.0, 0.0 );
	nodeVar0 = ( render.nodeUniform7 - render.nodeUniform8 );
	nodeVar1 = normalize( ( render.cameraViewMatrix * vec4<f32>( nodeVar0, 0.0 ) ).xyz );
	nodeVar3 = textureDimensions( nodeUniform4, u32( 0 ) );
	nodeVar2 = textureLoad( nodeUniform4, vec2<u32>( tsl_coord_clampS_clamp_2dT( ( object.nodeUniform5 * vec3<f32>( vec2<f32>( ( ( dot( nodeVarying7, nodeVar1 ) * 0.5 ) + 0.5 ), 0.0 ), 1.0 ) ).xy ) * vec2<f32>( nodeVar3 ) ), u32( 0 ) );
	nodeVar4 = ( vec3<f32>( nodeVar2.x ) * render.nodeUniform9 );
	nodeVar5 = ( DiffuseColor.xyz * vec3<f32>( 0.3183098861837907 ) );
	nodeVar6 = ( nodeVar4 * nodeVar5 );
	nodeVar7 = ( directDiffuse + nodeVar6 );
	directDiffuse = nodeVar7;
	irradiance = vec3<f32>( 0.0, 0.0, 0.0 );
	normalViewGeometry = normalize( v_normalViewGeometry );
	NORMAL_normalView = ( normalViewGeometry * vec3<f32>( ( ( f32( isFront ) * 2.0 ) - 1.0 ) ) );
	normalView = NORMAL_normalView;
	nodeVar8 = vec4<f32>( normalView, 0.0 );
	nodeVar9 = ( nodeVar8 * render.cameraViewMatrix );
	nodeVar10 = normalize( nodeVar9.xyz );
	normalWorld = nodeVar10;
	nodeVar11 = dot( normalWorld, normalize( render.nodeUniform14 ) );
	nodeVar12 = ( nodeVar11 * 0.5 );
	nodeVar13 = ( nodeVar12 + 0.5 );
	nodeVar14 = mix( render.nodeUniform10, render.nodeUniform11, nodeVar13 );
	nodeVar15 = ( irradiance + nodeVar14 );
	irradiance = nodeVar15;
	nodeVar16 = ( render.nodeUniform16 - v_positionView );
	nodeVar17 = normalize( nodeVar16 );
	nodeVar18 = textureLoad( nodeUniform4, vec2<u32>( tsl_coord_clampS_clamp_2dT( ( object.nodeUniform15 * vec3<f32>( vec2<f32>( ( ( dot( nodeVarying7, nodeVar17 ) * 0.5 ) + 0.5 ), 0.0 ), 1.0 ) ).xy ) * vec2<f32>( nodeVar3 ) ), u32( 0 ) );

	if ( ( render.nodeUniform18 > 0.0 ) ) {

		nodeVar20 = length( nodeVar16 );
		nodeVar21 = ( nodeVar20 / render.nodeUniform18 );
		nodeVar22 = clamp( ( 1.0 - ( ( ( nodeVar21 * nodeVar21 ) * nodeVar21 ) * nodeVar21 ) ), 0.0, 1.0 );
		nodeVar19 = ( ( 1.0 / max( pow( nodeVar20, render.nodeUniform19 ), 0.01 ) ) * ( nodeVar22 * nodeVar22 ) );

	} else {

		nodeVar19 = ( 1.0 / max( pow( length( nodeVar16 ), render.nodeUniform19 ), 0.01 ) );

	}

	nodeVar23 = ( render.nodeUniform17 * vec3<f32>( nodeVar19 ) );
	nodeVar24 = ( vec3<f32>( nodeVar18.x ) * nodeVar23 );
	nodeVar25 = ( DiffuseColor.xyz * vec3<f32>( 0.3183098861837907 ) );
	nodeVar26 = ( nodeVar24 * nodeVar25 );
	nodeVar27 = ( directDiffuse + nodeVar26 );
	directDiffuse = nodeVar27;
	indirectDiffuse = vec3<f32>( 0.0, 0.0, 0.0 );
	nodeVar28 = ( DiffuseColor * vec4<f32>( 0.3183098861837907 ) );
	nodeVar29 = ( vec4<f32>( irradiance, 1.0 ) * nodeVar28 );
	nodeVar30 = ( vec4<f32>( indirectDiffuse, 1.0 ) + nodeVar29 );
	indirectDiffuse = nodeVar30.xyz;
	ambientOcclusion = 1.0;
	nodeVar31 = ( indirectDiffuse * vec3<f32>( ambientOcclusion ) );
	indirectDiffuse = nodeVar31;
	nodeVar32 = ( directDiffuse + indirectDiffuse );
	totalDiffuse = nodeVar32;
	directSpecular = vec3<f32>( 0.0, 0.0, 0.0 );
	indirectSpecular = vec3<f32>( 0.0, 0.0, 0.0 );
	nodeVar33 = ( directSpecular + indirectSpecular );
	totalSpecular = nodeVar33;
	nodeVar34 = ( totalDiffuse + totalSpecular );
	outgoingLight = nodeVar34;
	Output = max( vec4<f32>( ( outgoingLight + EmissiveColor ), DiffuseColor.w ), vec4<f32>( 0.0 ) );
	output.m0 = Output;
	output.m1 = vec4<f32>( normalView, 1.0 );
	output.m2 = vec4<f32>( 1.0, 0.0, 0.0, 1.0 );
	output.m3 = vec4<f32>( EmissiveColor, 1.0 );

	// result

	return output;

}
