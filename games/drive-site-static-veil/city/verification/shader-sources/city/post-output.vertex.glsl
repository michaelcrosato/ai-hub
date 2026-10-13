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
	mat4 v_cameraProjectionMatrix;
	mat4 v_cameraViewMatrix;
};

layout( std140 ) uniform vertex_object {
	mat4 v_nodeUniform11;
};


// varyings
vec4 v_modelViewProjection;
vec3 v_positionView;
vec3 positionLocal;
out vec2 nodeVarying3;


// attributes
layout( location = 0 ) in vec2 uv;
layout( location = 1 ) in vec3 position;


// codes


void main() {

	// vars
	mat4 modelViewMatrix;
	vec4 nodeVar19;

	// transforms
	

	// flow
	// code

	nodeVarying3 = uv;
	positionLocal = position;
	modelViewMatrix = ( v_cameraViewMatrix * v_nodeUniform11 );
	v_positionView = ( modelViewMatrix * vec4( positionLocal, 1.0 ) ).xyz;
	nodeVar19 = ( v_cameraProjectionMatrix * vec4( v_positionView, 1.0 ) );
	v_modelViewProjection = nodeVar19;

	// result
	gl_Position = v_modelViewProjection;

	gl_PointSize = 1.0;

}
