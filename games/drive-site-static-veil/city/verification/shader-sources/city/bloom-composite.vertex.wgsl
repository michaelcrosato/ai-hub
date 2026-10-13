// Three.js r181 - Node System

// directives


// structs


// uniforms

struct renderStruct {
	cameraProjectionMatrix : mat4x4<f32>,
	cameraViewMatrix : mat4x4<f32>
};
@binding( 0 ) @group( 0 )
var<uniform> render : renderStruct;

struct objectStruct {
	nodeUniform16 : mat4x4<f32>
};
@binding( 13 ) @group( 1 )
var<uniform> object : objectStruct;

// varyings

struct VaryingsStruct {
	@location( 3 ) nodeVarying3 : vec2<f32>,
	@builtin( position ) Vertex : vec4<f32>
};
var<private> varyings : VaryingsStruct;

// codes


@vertex
fn main( @location( 0 ) uv : vec2<f32>,
	@location( 1 ) position : vec3<f32> ) -> VaryingsStruct {

	// vars
	
	var modelViewMatrix : mat4x4<f32>;
	var nodeVar5 : vec4<f32>;
	var v_modelViewProjection : vec4<f32>;
	var v_positionView : vec3<f32>;
	var positionLocal : vec3<f32>;


	// flow
	// code

	varyings.nodeVarying3 = uv;
	positionLocal = position;
	modelViewMatrix = ( render.cameraViewMatrix * object.nodeUniform16 );
	v_positionView = ( modelViewMatrix * vec4<f32>( positionLocal, 1.0 ) ).xyz;
	nodeVar5 = ( render.cameraProjectionMatrix * vec4<f32>( v_positionView, 1.0 ) );
	v_modelViewProjection = nodeVar5;

	// result

	varyings.Vertex = v_modelViewProjection;

	return varyings;

}
