// Three.js r181 - Node System

// global
diagnostic( off, derivative_uniformity );


// structs

struct OutputStruct {
	@location(0) color: vec4<f32>
};
var<private> output : OutputStruct;

// uniforms
@binding( 0 ) @group( 1 ) var nodeUniform0 : texture_depth_2d;
@binding( 2 ) @group( 1 ) var nodeUniform2_sampler : sampler;
@binding( 3 ) @group( 1 ) var nodeUniform2 : texture_2d<f32>;
@binding( 4 ) @group( 1 ) var nodeUniform5 : texture_2d<f32>;
struct objectStruct {
	nodeUniform1 : mat4x4<f32>,
	nodeUniform3 : f32,
	nodeUniform4 : f32,
	nodeUniform6 : mat3x3<f32>,
	nodeUniform7 : vec2<f32>,
	nodeUniform8 : mat4x4<f32>,
	nodeUniform9 : f32,
	nodeUniform10 : f32,
	nodeUniform11 : f32,
	nodeUniform12 : f32,
	nodeUniform13 : f32
};
@binding( 1 ) @group( 1 )
var<uniform> object : objectStruct;

// codes
fn tsl_clampWrapping_float( coord: f32 ) -> f32 { return clamp( coord, 0.0, 1.0 ); }
fn tsl_coord_clampS_clamp_2dT( coord : vec2f ) -> vec2f {

	return vec2f(
		tsl_clampWrapping_float( coord.x ),
		tsl_clampWrapping_float( coord.y )
	);

}

fn tsl_repeatWrapping_float( coord: f32 ) -> f32 { return fract( coord ); }
fn tsl_coord_repeatS_repeat_2dT( coord : vec2f ) -> vec2f {

	return vec2f(
		tsl_repeatWrapping_float( coord.x ),
		tsl_repeatWrapping_float( coord.y )
	);

}



@fragment
fn main( @location( 3 ) nodeVarying3 : vec2<f32> ) -> OutputStruct {

	// vars
	
	var nodeVar0 : f32;
	var nodeVar1 : vec2<u32>;
	var nodeVar2 : f32;
	var nodeVar3 : vec3<f32>;
	var nodeVar4 : vec4<f32>;
	var nodeVar5 : vec3<f32>;
	var nodeVar6 : f32;
	var nodeVar7 : f32;
	var nodeVar8 : f32;
	var nodeVar9 : f32;
	var nodeVar10 : f32;
	var nodeVar11 : vec4<f32>;
	var nodeVar12 : vec2<u32>;
	var nodeVar13 : vec4<f32>;
	var nodeVar14 : vec3<f32>;
	var nodeVar15 : vec3<f32>;
	var nodeVar16 : vec3<f32>;
	var nodeVar17 : vec3<f32>;
	var nodeVar18 : vec3<f32>;
	var nodeVar19 : vec3<f32>;
	var nodeVar20 : vec2<f32>;
	var nodeVar21 : vec3<f32>;
	var nodeVar22 : vec4<f32>;
	var nodeVar23 : vec2<f32>;
	var nodeVar24 : vec2<f32>;
	var nodeVar25 : f32;
	var nodeVar26 : f32;
	var nodeVar27 : vec3<f32>;
	var nodeVar28 : vec3<f32>;
	var nodeVar29 : vec4<f32>;
	var nodeVar30 : vec2<f32>;
	var nodeVar31 : vec2<f32>;
	var nodeVar32 : f32;
	var nodeVar33 : f32;
	var nodeVar34 : vec3<f32>;
	var nodeVar35 : vec3<f32>;
	var nodeVar36 : vec2<f32>;


	// flow
	// code

	nodeVar1 = textureDimensions( nodeUniform0, u32( 0 ) );
	nodeVar0 = textureLoad( nodeUniform0, vec2<u32>( tsl_coord_clampS_clamp_2dT( nodeVarying3 ) * vec2<f32>( nodeVar1 ) ), u32( 0 ) );
	nodeVar2 = nodeVar0;

	if ( ( nodeVar2 >= 1.0 ) ) {

		discard;
		

	}

	nodeVar3 = ( ( object.nodeUniform1 * vec4<f32>( vec3<f32>( ( ( vec2<f32>( nodeVarying3.x, ( 1.0 - nodeVarying3.y ) ) * vec2<f32>( 2.0 ) ) - vec2<f32>( 1.0 ) ), nodeVar2 ), 1.0 ) ).xyz / vec3<f32>( ( object.nodeUniform1 * vec4<f32>( vec3<f32>( ( ( vec2<f32>( nodeVarying3.x, ( 1.0 - nodeVarying3.y ) ) * vec2<f32>( 2.0 ) ) - vec2<f32>( 1.0 ) ), nodeVar2 ), 1.0 ) ).w ) );
	nodeVar4 = textureSample( nodeUniform2, nodeUniform2_sampler, nodeVarying3 );
	nodeVar5 = normalize( nodeVar4.xyz );

	if ( ( object.nodeUniform3 < 30.0 ) ) {

		nodeVar6 = 3.0;

	} else {

		nodeVar6 = 5.0;

	}

	nodeVar7 = nodeVar6;
	nodeVar8 = ( ( object.nodeUniform3 + ( nodeVar7 - 1.0 ) ) / nodeVar7 );
	nodeVar9 = 0.0;

	for ( var i : i32 = 0; i < i32( nodeVar7 ); i ++ ) {

		nodeVar10 = ( ( ( f32( i ) / nodeVar7 ) * 3.141592653589793 ) + object.nodeUniform4 );
		nodeVar12 = textureDimensions( nodeUniform5, u32( 0 ) );
		nodeVar11 = textureLoad( nodeUniform5, vec2<u32>( tsl_coord_repeatS_repeat_2dT( ( object.nodeUniform6 * vec3<f32>( ( vec2<f32>( nodeVarying3.x, ( 1.0 - nodeVarying3.y ) ) * ( object.nodeUniform7 / vec2<f32>( textureDimensions( nodeUniform5, 0 ) ) ) ), 1.0 ) ).xy ) * vec2<f32>( nodeVar12 ) ), u32( 0 ) );
		nodeVar13 = vec4<f32>( cos( nodeVar10 ), sin( nodeVar10 ), 0.0, ( 0.5 + ( 0.5 * nodeVar11.w ) ) );
		nodeVar14 = normalize( vec3<f32>( ( ( nodeVar11.xyz * vec3<f32>( 2.0 ) ) - vec3<f32>( 1.0 ) ).xy, 0.0 ) );
		nodeVar15 = normalize( ( mat3x3<f32>( nodeVar14, vec3<f32>( ( nodeVar14.y * -1.0 ), nodeVar14.x, 0.0 ), vec3<f32>( 0.0, 0.0, 1.0 ) ) * nodeVar13.xyz ) );
		nodeVar13.x = nodeVar15[ 0 ];
		nodeVar13.y = nodeVar15[ 1 ];
		nodeVar13.z = nodeVar15[ 2 ];
		nodeVar16 = normalize( ( - nodeVar3 ) );
		nodeVar17 = normalize( cross( nodeVar13.xyz, nodeVar16 ) );
		nodeVar18 = normalize( ( nodeVar5 - ( nodeVar17 * vec3<f32>( dot( nodeVar5, nodeVar17 ) ) ) ) );
		nodeVar19 = cross( nodeVar18, nodeVar17 );
		nodeVar20 = vec2<f32>( dot( nodeVar16, nodeVar19 ), dot( nodeVar16, ( - nodeVar19 ) ) );

		for ( var j : i32 = 0; j < i32( nodeVar8 ); j ++ ) {

			nodeVar21 = ( ( ( nodeVar13.xyz * vec3<f32>( object.nodeUniform9 ) ) * vec3<f32>( nodeVar13.w ) ) * vec3<f32>( pow( ( ( f32( j ) + 1.0 ) / nodeVar8 ), object.nodeUniform10 ) ) );
			nodeVar22 = ( object.nodeUniform8 * vec4<f32>( ( nodeVar3 + nodeVar21 ), 1.0 ) );
			nodeVar23 = ( ( ( nodeVar22.xy / vec2<f32>( nodeVar22.w ) ) * vec2<f32>( 0.5 ) ) + vec2<f32>( 0.5 ) );
			nodeVar24 = vec2<f32>( nodeVar23.x, ( 1.0 - nodeVar23.y ) );
			nodeVar25 = textureLoad( nodeUniform0, vec2<u32>( tsl_coord_clampS_clamp_2dT( nodeVar24 ) * vec2<f32>( nodeVar1 ) ), u32( 0 ) );
			nodeVar26 = nodeVar25;
			nodeVar27 = ( ( object.nodeUniform1 * vec4<f32>( vec3<f32>( ( ( vec2<f32>( nodeVar24.x, ( 1.0 - nodeVar24.y ) ) * vec2<f32>( 2.0 ) ) - vec2<f32>( 1.0 ) ), nodeVar26 ), 1.0 ) ).xyz / vec3<f32>( ( object.nodeUniform1 * vec4<f32>( vec3<f32>( ( ( vec2<f32>( nodeVar24.x, ( 1.0 - nodeVar24.y ) ) * vec2<f32>( 2.0 ) ) - vec2<f32>( 1.0 ) ), nodeVar26 ), 1.0 ) ).w ) );
			nodeVar28 = ( nodeVar27 - nodeVar3 );

			if ( ( abs( nodeVar28.z ) < object.nodeUniform11 ) ) {

				nodeVar20.x = ( nodeVar20.x + max( 0.0, ( ( dot( nodeVar16, normalize( nodeVar28 ) ) - nodeVar20.x ) * mix( 1.0, ( 2.0 / ( f32( j ) + 2.0 ) ), object.nodeUniform12 ) ) ) );
				

			}

			nodeVar29 = ( object.nodeUniform8 * vec4<f32>( ( nodeVar3 - nodeVar21 ), 1.0 ) );
			nodeVar30 = ( ( ( nodeVar29.xy / vec2<f32>( nodeVar29.w ) ) * vec2<f32>( 0.5 ) ) + vec2<f32>( 0.5 ) );
			nodeVar31 = vec2<f32>( nodeVar30.x, ( 1.0 - nodeVar30.y ) );
			nodeVar32 = textureLoad( nodeUniform0, vec2<u32>( tsl_coord_clampS_clamp_2dT( nodeVar31 ) * vec2<f32>( nodeVar1 ) ), u32( 0 ) );
			nodeVar33 = nodeVar32;
			nodeVar34 = ( ( object.nodeUniform1 * vec4<f32>( vec3<f32>( ( ( vec2<f32>( nodeVar31.x, ( 1.0 - nodeVar31.y ) ) * vec2<f32>( 2.0 ) ) - vec2<f32>( 1.0 ) ), nodeVar33 ), 1.0 ) ).xyz / vec3<f32>( ( object.nodeUniform1 * vec4<f32>( vec3<f32>( ( ( vec2<f32>( nodeVar31.x, ( 1.0 - nodeVar31.y ) ) * vec2<f32>( 2.0 ) ) - vec2<f32>( 1.0 ) ), nodeVar33 ), 1.0 ) ).w ) );
			nodeVar35 = ( nodeVar34 - nodeVar3 );

			if ( ( abs( nodeVar35.z ) < object.nodeUniform11 ) ) {

				nodeVar20.y = ( nodeVar20.y + max( 0.0, ( ( dot( nodeVar16, normalize( nodeVar35 ) ) - nodeVar20.y ) * mix( 1.0, ( 2.0 / ( f32( j ) + 2.0 ) ), object.nodeUniform12 ) ) ) );
				

			}


		}

		nodeVar36 = sqrt( ( vec2<f32>( 1.0 ) - ( nodeVar20 * nodeVar20 ) ) );
		nodeVar9 = ( nodeVar9 + ( ( dot( nodeVar18, cross( nodeVar17, nodeVar16 ) ) * ( 0.5 * ( ( acos( nodeVar20.y ) - acos( nodeVar20.x ) ) + ( ( nodeVar36.x * nodeVar20.x ) - ( nodeVar36.y * nodeVar20.y ) ) ) ) ) + ( dot( nodeVar18, nodeVar16 ) * ( 0.5 * ( ( 2.0 - ( nodeVar20.x * nodeVar20.x ) ) - ( nodeVar20.y * nodeVar20.y ) ) ) ) ) );

	}

	nodeVar9 = clamp( ( nodeVar9 / nodeVar7 ), 0.0, 1.0 );
	nodeVar9 = pow( nodeVar9, object.nodeUniform13 );

	// result

	output.color = vec4<f32>( nodeVar9 );

	return output;

}
