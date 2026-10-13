/* Static Veil extensions for my-3D2dge 0.8.1. Original game code. */
(function(E){
  'use strict';
  E.veilVersion='1.0.0';
  /** A height-aware ray for sight, hacking, and cover. World z is height. */
  E.clearSight=function(map,a,b,step=3){
    const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/step));
    for(let i=1;i<n;i++){
      const t=i/n,x=E.lerp(a.x,b.x,t),y=E.lerp(a.y,b.y,t),z=E.lerp(a.z||0,b.z||0,t);
      if(map.heightAt(x,y)>=z)return false;
    }
    return true;
  };
  /** A door changes navigation even when the destination has not moved. */
  E.VersionedFlowField=class extends E.FlowField{
    update(x,y){if(this.mapVersion!==this.map.version){this.tx=this.ty=-1;this.mapVersion=this.map.version;}super.update(x,y);}
  };
  /** Keep the engine's bullet pool and drawing. Sweep movement in <= 2-unit steps. */
  E.SweptBullets=class extends E.Bullets{
    updateSwept(dt,map,targets,onHit){
      for(const b of this.list){
        if(b.dead)continue;
        b.t+=dt;if(b.t>=b.life){b.dead=true;continue;}
        b.vz-=b.grav*dt;
        const n=Math.max(1,Math.ceil(Math.hypot(b.vx,b.vy)*dt/2));
        for(let i=0;i<n&&!b.dead;i++){
          b.x+=b.vx*dt/n;b.y+=b.vy*dt/n;b.z+=b.vz*dt/n;
          if(map.heightAt(b.x,b.y)>b.z){
            b.dead=true;this.game.particles.sparks(b.x,b.y,b.z,3,null,{color:b.color});
            if(b.onWall)b.onWall(b);break;
          }
          for(const t of targets){
            if(!t||t.dead||t.team===b.team||t.hp<=0)continue;
            const rad=b.r+(t.r||5);
            const low=(t.z||0)+(t.kind==='camera'?32:0),high=(t.z||0)+(t.kind==='camera'?47:t.crouch?17:34);
            if(Math.hypot(b.x-t.x,b.y-t.y)<=rad&&b.z>=low&&b.z<=high){
              onHit(b,t);b.dead=true;break;
            }
          }
        }
      }
      E.prune(this.list,b=>b.dead);
    }
  };
})(My3D2dge);
