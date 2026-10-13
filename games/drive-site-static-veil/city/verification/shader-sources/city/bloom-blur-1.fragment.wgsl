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
struct NodeBuffer_3882Struct {
	value : array< vec4<f32>, 10 >
};
@binding( 3 ) @group( 1 )
var<uniform> NodeBuffer_3882 : NodeBuffer_3882Struct;
struct objectStruct {
	nodeUniform1 : mat3x3<f32>,
	nodeUniform3 : mat3x3<f32>,
	nodeUniform4 : vec2<f32>,
	nodeUniform5 : vec2<f32>,
	nodeUniform6 : mat3x3<f32>
};
@binding( 2 ) @group( 1 )
var<uniform> object : objectStruct;

// codes


@fragment
fn main( @location( 3 ) nodeVarying3 : vec2<f32> ) -> OutputStruct {

	// vars
	
	var nodeVar0 : vec4<f32>;
	var nodeVar1 : vec3<f32>;
	var nodeVar2 : vec2<f32>;
	var nodeVar3 : vec4<f32>;
	var nodeVar4 : vec4<f32>;


	// flow
	// code

	nodeVar0 = textureSample( nodeUniform0, nodeUniform0_sampler, ( object.nodeUniform1 * vec3<f32>( nodeVarying3, 1.0 ) ).xy );
	nodeVar1 = ( nodeVar0.xyz * vec3<f32>( NodeBuffer_3882.value[ 0u ].x ) );

	for ( var i : i32 = 1; i < 10; i ++ ) {

		nodeVar2 = ( ( object.nodeUniform4 * object.nodeUniform5 ) * vec2<f32>( f32( i ) ) );
		nodeVar3 = textureSample( nodeUniform0, nodeUniform0_sampler, ( object.nodeUniform3 * vec3<f32>( ( nodeVarying3 + nodeVar2 ), 1.0 ) ).xy );
		nodeVar4 = textureSample( nodeUniform0, nodeUniform0_sampler, ( object.nodeUniform6 * vec3<f32>( ( nodeVarying3 - nodeVar2 ), 1.0 ) ).xy );
		nodeVar1 = ( nodeVar1 + ( ( nodeVar3.xyz + nodeVar4.xyz ) * vec3<f32>( NodeBuffer_3882.value[ i ].x ) ) );

	}


	// result

	output.color = vec4<f32>( nodeVar1, 1.0 );

	return output;

}
