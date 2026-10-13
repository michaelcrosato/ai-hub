// Three.js r181 - Node System

// global
diagnostic( off, derivative_uniformity );


// structs

struct OutputStruct {
	@location(0) color: vec4<f32>
};
var<private> output : OutputStruct;

// uniforms
@binding( 1 ) @group( 1 ) var nodeUniform1_sampler : sampler;
@binding( 2 ) @group( 1 ) var nodeUniform1 : texture_2d<f32>;
@binding( 3 ) @group( 1 ) var nodeUniform4_sampler : sampler;
@binding( 4 ) @group( 1 ) var nodeUniform4 : texture_2d<f32>;
struct objectStruct {
	nodeUniform0 : f32,
	nodeUniform2 : vec2<f32>,
	nodeUniform3 : f32
};
@binding( 0 ) @group( 1 )
var<uniform> object : objectStruct;

// codes
fn sRGBTransferOETF ( color : vec3<f32> ) -> vec3<f32> {




	return mix( ( ( pow( color, vec3<f32>( 0.41666 ) ) * vec3<f32>( 1.055 ) ) - vec3<f32>( 0.055 ) ), ( color * vec3<f32>( 12.92 ) ), vec3<f32>( ( color <= vec3<f32>( 0.0031308 ) ) ) );

}



@fragment
fn main( @location( 3 ) nodeVarying3 : vec2<f32> ) -> OutputStruct {

	// vars
	
	var nodeVar0 : vec4<f32>;
	var nodeVar1 : vec2<f32>;
	var nodeVar2 : vec4<f32>;
	var nodeVar3 : vec2<f32>;
	var nodeVar4 : vec4<f32>;
	var nodeVar5 : vec4<f32>;
	var nodeVar6 : vec4<f32>;


	// flow
	// code

	nodeVar1 = clamp( floor( ( nodeVarying3 * object.nodeUniform2 ) ), vec2<f32>( 0.0, 0.0 ), ( object.nodeUniform2 - vec2<f32>( 1.0 ) ) );
	nodeVar2 = textureLoad( nodeUniform1, vec2<i32>( nodeVar1 ), u32( 0u ) );
	nodeVar3 = min( ( ( floor( ( nodeVar1 / vec2<f32>( object.nodeUniform3 ) ) ) * vec2<f32>( object.nodeUniform3 ) ) + vec2<f32>( floor( ( object.nodeUniform3 * 0.5 ) ) ) ), ( object.nodeUniform2 - vec2<f32>( 1.0 ) ) );
	nodeVar4 = textureLoad( nodeUniform1, vec2<i32>( nodeVar3 ), u32( 0u ) );

	if ( ( ( object.nodeUniform0 == 1.0 ) || ( ( ( object.nodeUniform0 == 2.0 ) && ( nodeVar2.x > 0.5 ) ) && ( nodeVar4.x > 0.5 ) ) ) ) {

		nodeVar5 = textureLoad( nodeUniform4, vec2<i32>( nodeVar3 ), u32( 0u ) );
		nodeVar0 = nodeVar5;

	} else {

		nodeVar6 = textureLoad( nodeUniform4, vec2<i32>( nodeVar1 ), u32( 0u ) );
		nodeVar0 = nodeVar6;

	}


	// result

	output.color = vec4<f32>( sRGBTransferOETF( nodeVar0.xyz ), nodeVar0.w );

	return output;

}
