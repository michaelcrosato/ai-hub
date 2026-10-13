// Three.js r181 - Node System

// directives


// structs


// uniforms

struct renderStruct {
	cameraViewMatrix : mat4x4<f32>,
	cameraProjectionMatrix : mat4x4<f32>
};
@binding( 1 ) @group( 0 )
var<uniform> render : renderStruct;

struct objectStruct {
	nodeUniform2 : mat3x3<f32>,
	nodeUniform4 : mat4x4<f32>
};
@binding( 3 ) @group( 1 )
var<uniform> object : objectStruct;

// varyings

struct VaryingsStruct {
	@location( 1 ) v_positionView : vec3<f32>,
	@location( 3 ) v_positionWorld : vec3<f32>,
	@location( 4 ) v_normalViewGeometry : vec3<f32>,
	@location( 5 ) v_positionViewDirection : vec3<f32>,
	@location( 6 ) nodeVarying6 : vec3<f32>,
	@location( 7 ) nodeVarying7 : f32,
	@builtin( position ) Vertex : vec4<f32>
};
var<private> varyings : VaryingsStruct;

// codes


@vertex
fn main( @location( 0 ) color : vec3<f32>,
	@location( 1 ) normal : vec3<f32>,
	@location( 2 ) position : vec3<f32>,
	@location( 3 ) glow : f32 ) -> VaryingsStruct {

	// vars
	
	var normalLocal : vec3<f32>;
	var modelViewMatrix : mat4x4<f32>;
	var nodeVar105 : vec4<f32>;
	var v_modelViewProjection : vec4<f32>;
	var positionLocal : vec3<f32>;


	// flow
	// code

	varyings.nodeVarying6 = color;
	normalLocal = normal;
	varyings.v_normalViewGeometry = normalize( ( render.cameraViewMatrix * vec4<f32>( ( object.nodeUniform2 * normalLocal ), 0.0 ) ).xyz );
	positionLocal = position;
	varyings.v_positionWorld = ( object.nodeUniform4 * vec4<f32>( positionLocal, 1.0 ) ).xyz;
	varyings.nodeVarying7 = glow;
	modelViewMatrix = ( render.cameraViewMatrix * object.nodeUniform4 );
	varyings.v_positionView = ( modelViewMatrix * vec4<f32>( positionLocal, 1.0 ) ).xyz;
	varyings.v_positionViewDirection = ( - varyings.v_positionView );
	nodeVar105 = ( render.cameraProjectionMatrix * vec4<f32>( varyings.v_positionView, 1.0 ) );
	v_modelViewProjection = nodeVar105;

	// result

	varyings.Vertex = v_modelViewProjection;

	return varyings;

}
