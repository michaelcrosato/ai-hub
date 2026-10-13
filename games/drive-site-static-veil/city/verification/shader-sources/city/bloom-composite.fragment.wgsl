// Three.js r181 - Node System

// global
diagnostic( off, derivative_uniformity );


// structs

struct OutputStruct {
	@location(0) color: vec4<f32>
};
var<private> output : OutputStruct;

// uniforms
@binding( 3 ) @group( 1 ) var nodeUniform3_sampler : sampler;
@binding( 4 ) @group( 1 ) var nodeUniform3 : texture_2d<f32>;
@binding( 5 ) @group( 1 ) var nodeUniform5_sampler : sampler;
@binding( 6 ) @group( 1 ) var nodeUniform5 : texture_2d<f32>;
@binding( 7 ) @group( 1 ) var nodeUniform7_sampler : sampler;
@binding( 8 ) @group( 1 ) var nodeUniform7 : texture_2d<f32>;
@binding( 9 ) @group( 1 ) var nodeUniform9_sampler : sampler;
@binding( 10 ) @group( 1 ) var nodeUniform9 : texture_2d<f32>;
@binding( 11 ) @group( 1 ) var nodeUniform11_sampler : sampler;
@binding( 12 ) @group( 1 ) var nodeUniform11 : texture_2d<f32>;
struct NodeBuffer_3921Struct {
	value : array< vec4<f32>, 5 >
};
@binding( 0 ) @group( 1 )
var<uniform> NodeBuffer_3921 : NodeBuffer_3921Struct;

struct NodeBuffer_3922Struct {
	value : array< vec4<f32>, 5 >
};
@binding( 2 ) @group( 1 )
var<uniform> NodeBuffer_3922 : NodeBuffer_3922Struct;
struct objectStruct {
	nodeUniform1 : f32,
	nodeUniform4 : mat3x3<f32>,
	nodeUniform6 : mat3x3<f32>,
	nodeUniform8 : mat3x3<f32>,
	nodeUniform10 : mat3x3<f32>,
	nodeUniform12 : mat3x3<f32>,
	nodeUniform13 : f32
};
@binding( 1 ) @group( 1 )
var<uniform> object : objectStruct;

// codes
fn lerpBloomFactor ( factor : f32, radius : f32 ) -> f32 {




	return mix( factor, ( 1.2 - factor ), radius );

}



@fragment
fn main( @location( 3 ) nodeVarying3 : vec2<f32> ) -> OutputStruct {

	// vars
	
	var nodeVar0 : vec4<f32>;
	var nodeVar1 : vec4<f32>;
	var nodeVar2 : vec4<f32>;
	var nodeVar3 : vec4<f32>;
	var nodeVar4 : vec4<f32>;


	// flow
	// code

	nodeVar0 = textureSample( nodeUniform3, nodeUniform3_sampler, ( object.nodeUniform4 * vec3<f32>( nodeVarying3, 1.0 ) ).xy );
	nodeVar1 = textureSample( nodeUniform5, nodeUniform5_sampler, ( object.nodeUniform6 * vec3<f32>( nodeVarying3, 1.0 ) ).xy );
	nodeVar2 = textureSample( nodeUniform7, nodeUniform7_sampler, ( object.nodeUniform8 * vec3<f32>( nodeVarying3, 1.0 ) ).xy );
	nodeVar3 = textureSample( nodeUniform9, nodeUniform9_sampler, ( object.nodeUniform10 * vec3<f32>( nodeVarying3, 1.0 ) ).xy );
	nodeVar4 = textureSample( nodeUniform11, nodeUniform11_sampler, ( object.nodeUniform12 * vec3<f32>( nodeVarying3, 1.0 ) ).xy );

	// result

	output.color = ( ( ( ( ( ( ( vec4<f32>( lerpBloomFactor( NodeBuffer_3921.value[ 0u ].x, object.nodeUniform1 ) ) * vec4<f32>( NodeBuffer_3922.value[ 0u ].xyz, 1.0 ) ) * nodeVar0 ) + ( ( vec4<f32>( lerpBloomFactor( NodeBuffer_3921.value[ 1u ].x, object.nodeUniform1 ) ) * vec4<f32>( NodeBuffer_3922.value[ 1u ].xyz, 1.0 ) ) * nodeVar1 ) ) + ( ( vec4<f32>( lerpBloomFactor( NodeBuffer_3921.value[ 2u ].x, object.nodeUniform1 ) ) * vec4<f32>( NodeBuffer_3922.value[ 2u ].xyz, 1.0 ) ) * nodeVar2 ) ) + ( ( vec4<f32>( lerpBloomFactor( NodeBuffer_3921.value[ 3u ].x, object.nodeUniform1 ) ) * vec4<f32>( NodeBuffer_3922.value[ 3u ].xyz, 1.0 ) ) * nodeVar3 ) ) + ( ( vec4<f32>( lerpBloomFactor( NodeBuffer_3921.value[ 4u ].x, object.nodeUniform1 ) ) * vec4<f32>( NodeBuffer_3922.value[ 4u ].xyz, 1.0 ) ) * nodeVar4 ) ) * vec4<f32>( object.nodeUniform13 ) );

	return output;

}
