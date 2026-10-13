// Three.js r181 - Node System

// global
diagnostic( off, derivative_uniformity );


// structs

struct OutputStruct {
	@location(0) color: vec4<f32>
};
var<private> output : OutputStruct;

// uniforms
@binding( 0 ) @group( 1 ) var nodeUniform0_sampler : sampler;
@binding( 1 ) @group( 1 ) var nodeUniform0 : texture_2d<f32>;
@binding( 2 ) @group( 1 ) var nodeUniform1_sampler : sampler;
@binding( 3 ) @group( 1 ) var nodeUniform1 : texture_2d<f32>;
@binding( 5 ) @group( 1 ) var nodeUniform5 : texture_depth_2d;
@binding( 6 ) @group( 1 ) var nodeUniform7_sampler : sampler;
@binding( 7 ) @group( 1 ) var nodeUniform7 : texture_2d<f32>;
@binding( 8 ) @group( 1 ) var nodeUniform8_sampler : sampler;
@binding( 9 ) @group( 1 ) var nodeUniform8 : texture_2d<f32>;
@binding( 10 ) @group( 1 ) var nodeUniform9_sampler : sampler;
@binding( 11 ) @group( 1 ) var nodeUniform9 : texture_2d<f32>;
struct objectStruct {
	nodeUniform2 : vec2<f32>,
	nodeUniform3 : f32,
	nodeUniform4 : f32,
	nodeUniform6 : f32
};
@binding( 4 ) @group( 1 )
var<uniform> object : objectStruct;

// codes
fn tsl_clampWrapping_float( coord: f32 ) -> f32 { return clamp( coord, 0.0, 1.0 ); }
fn tsl_coord_clampS_clamp_2dT( coord : vec2f ) -> vec2f {

	return vec2f(
		tsl_clampWrapping_float( coord.x ),
		tsl_clampWrapping_float( coord.y )
	);

}



@fragment
fn main( @location( 3 ) nodeVarying3 : vec2<f32> ) -> OutputStruct {

	// vars
	
	var nodeVar0 : vec4<f32>;
	var nodeVar1 : vec4<f32>;
	var nodeVar2 : vec4<f32>;
	var nodeVar3 : vec4<f32>;
	var nodeVar4 : f32;
	var nodeVar5 : vec2<u32>;
	var nodeVar6 : f32;
	var nodeVar7 : f32;
	var nodeVar8 : f32;
	var nodeVar9 : f32;
	var nodeVar10 : vec4<f32>;
	var nodeVar11 : vec4<f32>;
	var nodeVar12 : vec4<f32>;


	// flow
	// code

	nodeVar0 = textureSample( nodeUniform0, nodeUniform0_sampler, nodeVarying3 );
	nodeVar1 = textureSample( nodeUniform1, nodeUniform1_sampler, ( nodeVarying3 + ( vec2<f32>( 1.0, 0.0 ) / object.nodeUniform2 ) ) );
	nodeVar2 = textureSample( nodeUniform1, nodeUniform1_sampler, nodeVarying3 );
	nodeVar3 = textureSample( nodeUniform1, nodeUniform1_sampler, ( nodeVarying3 + ( vec2<f32>( 0.0, 1.0 ) / object.nodeUniform2 ) ) );
	nodeVar5 = textureDimensions( nodeUniform5, u32( 0 ) );
	nodeVar4 = textureLoad( nodeUniform5, vec2<u32>( tsl_coord_clampS_clamp_2dT( ( nodeVarying3 + ( vec2<f32>( 1.0, 0.0 ) / object.nodeUniform2 ) ) ) * vec2<f32>( nodeVar5 ) ), u32( 0 ) );
	nodeVar6 = textureLoad( nodeUniform5, vec2<u32>( tsl_coord_clampS_clamp_2dT( nodeVarying3 ) * vec2<f32>( nodeVar5 ) ), u32( 0 ) );
	nodeVar7 = ( ( object.nodeUniform3 * object.nodeUniform4 ) / ( ( ( object.nodeUniform4 - object.nodeUniform3 ) * nodeVar6 ) - object.nodeUniform4 ) );
	nodeVar8 = textureLoad( nodeUniform5, vec2<u32>( tsl_coord_clampS_clamp_2dT( ( nodeVarying3 + ( vec2<f32>( 0.0, 1.0 ) / object.nodeUniform2 ) ) ) * vec2<f32>( nodeVar5 ) ), u32( 0 ) );
	nodeVar10 = textureLoad( nodeUniform7, vec2<i32>( clamp( floor( ( nodeVarying3 * object.nodeUniform2 ) ), vec2<f32>( 0.0, 0.0 ), ( object.nodeUniform2 - vec2<f32>( 1.0 ) ) ) ), u32( 0u ) );

	if ( ( ( object.nodeUniform6 == 1.0 ) || ( ( object.nodeUniform6 == 2.0 ) && ( nodeVar10.x > 0.5 ) ) ) ) {

		nodeVar9 = 0.52;

	} else {

		nodeVar9 = 0.0;

	}

	nodeVar11 = textureSample( nodeUniform8, nodeUniform8_sampler, nodeVarying3 );
	nodeVar12 = textureSample( nodeUniform9, nodeUniform9_sampler, nodeVarying3 );

	// result

	output.color = vec4<f32>( ( ( ( nodeVar0.xyz * vec3<f32>( ( 1.0 - ( max( smoothstep( 0.18, 0.55, max( length( ( nodeVar1.xyz - nodeVar2.xyz ) ), length( ( nodeVar3.xyz - nodeVar2.xyz ) ) ) ), smoothstep( 0.012, 0.05, ( max( abs( ( ( ( object.nodeUniform3 * object.nodeUniform4 ) / ( ( ( object.nodeUniform4 - object.nodeUniform3 ) * nodeVar4 ) - object.nodeUniform4 ) ) - nodeVar7 ) ), abs( ( ( ( object.nodeUniform3 * object.nodeUniform4 ) / ( ( ( object.nodeUniform4 - object.nodeUniform3 ) * nodeVar8 ) - object.nodeUniform4 ) ) - nodeVar7 ) ) ) / max( abs( nodeVar7 ), 1.0 ) ) ) ) * nodeVar9 ) ) ) ) * vec3<f32>( mix( 1.0, nodeVar11.x, 0.5 ) ) ) + nodeVar12.xyz ), 1.0 );

	return output;

}
