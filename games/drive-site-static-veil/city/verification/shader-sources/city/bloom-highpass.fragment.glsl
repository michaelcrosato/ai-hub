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


// structs

layout( location = 0 ) out vec4 fragColor;



// uniforms

layout( std140 ) uniform fragment_object {
	uint f_nodeUniform1;
	float f_nodeUniform2;
	float f_nodeUniform3;
};
uniform sampler2D nodeUniform0;

// varyings
in vec2 nodeVarying3;


// codes


void main() {

	// vars
	vec2 nodeVar0;
	vec2 nodeVar1;
	bool nodeVar2;
	vec2 nodeVar3;
	vec4 nodeVar4;

	// flow
	// code

	nodeVar0 = nodeVarying3;
	nodeVar2 = bool( f_nodeUniform1 );

	if ( nodeVar2 ) {

		nodeVar3 = nodeVar0;
		nodeVar1 = vec2( nodeVar3.x, 1.0 - nodeVar3.y );

	} else {

		nodeVar1 = nodeVar0;

	}

	nodeVar4 = texture( nodeUniform0, nodeVar1 );

	// result
	fragColor = mix( vec4( 0.0, 0.0, 0.0, 0.0 ), nodeVar4, smoothstep( f_nodeUniform2, ( f_nodeUniform2 + f_nodeUniform3 ), dot( nodeVar4.xyz, vec3( 0.2126, 0.7152, 0.0722 ) ) ) );

}
