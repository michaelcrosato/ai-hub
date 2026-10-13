#version 300 es

// Three.js r181 - Node System


// extensions


// precision

precision highp float;
precision highp int;
precision highp sampler2D;
precision highp sampler3D;
precision highp samplerCube;
precision highp sampler2DArray;

precision highp usampler2D;
precision highp usampler3D;
precision highp usamplerCube;
precision highp usampler2DArray;

precision highp isampler2D;
precision highp isampler3D;
precision highp isamplerCube;
precision highp isampler2DArray;

precision lowp sampler2DShadow;
precision lowp sampler2DArrayShadow;
precision lowp samplerCubeShadow;


// uniforms

layout( std140 ) uniform vertex_render {
	mat4 v_cameraViewMatrix;
	mat4 v_cameraProjectionMatrix;
};

layout( std140 ) uniform vertex_object {
	mat3 v_nodeUniform2;
	mat4 v_nodeUniform4;
};


// varyings
vec4 v_modelViewProjection;
out vec3 v_positionView;
vec3 positionLocal;
out vec3 v_positionWorld;
out vec3 v_normalViewGeometry;
out vec3 v_positionViewDirection;
out vec3 nodeVarying6;
out float nodeVarying7;


// attributes
layout( location = 0 ) in vec3 color;
layout( location = 1 ) in vec3 normal;
layout( location = 2 ) in vec3 position;
layout( location = 3 ) in float glow;


// codes


void main() {

	// vars
	vec3 normalLocal;
	mat4 modelViewMatrix;
	vec4 nodeVar125;

	// transforms
	

	// flow
	// code

	nodeVarying6 = color;
	normalLocal = normal;
	v_normalViewGeometry = normalize( ( v_cameraViewMatrix * vec4( ( v_nodeUniform2 * normalLocal ), 0.0 ) ).xyz );
	positionLocal = position;
	v_positionWorld = ( v_nodeUniform4 * vec4( positionLocal, 1.0 ) ).xyz;
	nodeVarying7 = glow;
	modelViewMatrix = ( v_cameraViewMatrix * v_nodeUniform4 );
	v_positionView = ( modelViewMatrix * vec4( positionLocal, 1.0 ) ).xyz;
	v_positionViewDirection = ( - v_positionView );
	nodeVar125 = ( v_cameraProjectionMatrix * vec4( v_positionView, 1.0 ) );
	v_modelViewProjection = nodeVar125;

	// result
	gl_Position = v_modelViewProjection;

	gl_PointSize = 1.0;

}
