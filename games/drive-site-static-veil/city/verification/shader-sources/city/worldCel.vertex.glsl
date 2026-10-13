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

layout( std140 ) uniform vertex_object {
	mat4 v_nodeUniform2;
	mat3 v_nodeUniform14;
};

layout( std140 ) uniform vertex_render {
	mat4 v_cameraViewMatrix;
	mat4 v_cameraProjectionMatrix;
};


// varyings
vec4 v_modelViewProjection;
out vec3 v_positionView;
vec3 positionLocal;
out vec3 v_positionWorld;
out vec3 v_normalViewGeometry;
out vec3 nodeVarying5;
out float nodeVarying6;
out vec3 nodeVarying7;


// attributes
layout( location = 0 ) in vec3 color;
layout( location = 1 ) in float glow;
layout( location = 2 ) in vec3 position;
layout( location = 3 ) in vec3 normal;


// codes


void main() {

	// vars
	vec3 normalLocal;
	mat4 modelViewMatrix;
	vec4 nodeVar42;

	// transforms
	

	// flow
	// code

	nodeVarying5 = color;
	nodeVarying6 = glow;
	positionLocal = position;
	v_positionWorld = ( v_nodeUniform2 * vec4( positionLocal, 1.0 ) ).xyz;
	nodeVarying7 = normal;
	normalLocal = normal;
	v_normalViewGeometry = normalize( ( v_cameraViewMatrix * vec4( ( v_nodeUniform14 * normalLocal ), 0.0 ) ).xyz );
	modelViewMatrix = ( v_cameraViewMatrix * v_nodeUniform2 );
	v_positionView = ( modelViewMatrix * vec4( positionLocal, 1.0 ) ).xyz;
	nodeVar42 = ( v_cameraProjectionMatrix * vec4( v_positionView, 1.0 ) );
	v_modelViewProjection = nodeVar42;

	// result
	gl_Position = v_modelViewProjection;

	gl_PointSize = 1.0;

}
