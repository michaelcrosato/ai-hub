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
struct objectStruct {
	nodeUniform1 : f32,
	nodeUniform2 : f32
};
@binding( 2 ) @group( 1 )
var<uniform> object : objectStruct;

// codes


@fragment
fn main( @location( 3 ) nodeVarying3 : vec2<f32> ) -> OutputStruct {

	// vars
	
	var nodeVar0 : vec4<f32>;


	// flow
	// code

	nodeVar0 = textureSample( nodeUniform0, nodeUniform0_sampler, nodeVarying3 );

	// result

	output.color = mix( vec4<f32>( 0.0, 0.0, 0.0, 0.0 ), nodeVar0, smoothstep( object.nodeUniform1, ( object.nodeUniform1 + object.nodeUniform2 ), dot( nodeVar0.xyz, vec3<f32>( 0.2126, 0.7152, 0.0722 ) ) ) );

	return output;

}
