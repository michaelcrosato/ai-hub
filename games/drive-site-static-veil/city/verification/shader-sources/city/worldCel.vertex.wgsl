// Three.js r181 - Node System

// directives


// structs


// uniforms

struct objectStruct {
	nodeUniform2 : mat4x4<f32>,
	nodeUniform13 : mat3x3<f32>
};
@binding( 2 ) @group( 1 )
var<uniform> object : objectStruct;

struct renderStruct {
	cameraViewMatrix : mat4x4<f32>,
	cameraProjectionMatrix : mat4x4<f32>
};
@binding( 1 ) @group( 0 )
var<uniform> render : renderStruct;

// varyings

struct VaryingsStruct {
	@location( 1 ) v_positionView : vec3<f32>,
	@location( 3 ) v_positionWorld : vec3<f32>,
	@location( 4 ) v_normalViewGeometry : vec3<f32>,
	@location( 5 ) nodeVarying5 : vec3<f32>,
	@location( 6 ) nodeVarying6 : f32,
	@location( 7 ) nodeVarying7 : vec3<f32>,
	@builtin( position ) Vertex : vec4<f32>
};
var<private> varyings : VaryingsStruct;

// codes


@vertex
fn main( @location( 0 ) color : vec3<f32>,
	@location( 1 ) glow : f32,
	@location( 2 ) position : vec3<f32>,
	@location( 3 ) normal : vec3<f32> ) -> VaryingsStruct {

	// vars
	
	var normalLocal : vec3<f32>;
	var modelViewMatrix : mat4x4<f32>;
	var nodeVar35 : vec4<f32>;
	var v_modelViewProjection : vec4<f32>;
	var positionLocal : vec3<f32>;


	// flow
	// code

	varyings.nodeVarying5 = color;
	varyings.nodeVarying6 = glow;
	positionLocal = position;
	varyings.v_positionWorld = ( object.nodeUniform2 * vec4<f32>( positionLocal, 1.0 ) ).xyz;
	varyings.nodeVarying7 = normal;
	normalLocal = normal;
	varyings.v_normalViewGeometry = normalize( ( render.cameraViewMatrix * vec4<f32>( ( object.nodeUniform13 * normalLocal ), 0.0 ) ).xyz );
	modelViewMatrix = ( render.cameraViewMatrix * object.nodeUniform2 );
	varyings.v_positionView = ( modelViewMatrix * vec4<f32>( positionLocal, 1.0 ) ).xyz;
	nodeVar35 = ( render.cameraProjectionMatrix * vec4<f32>( varyings.v_positionView, 1.0 ) );
	v_modelViewProjection = nodeVar35;

	// result

	varyings.Vertex = v_modelViewProjection;

	return varyings;

}
