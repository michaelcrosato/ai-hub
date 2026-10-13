(function(root){
    'use strict';
    const E=root.My3D2dge,D=root.HARBOR_DATA,P=E.px,W=root.HarborWorld.prototype;
    const drawProp=W.drawProp;
    W.drawProp=function(r,g,o,t,state){
        if(o.type!=='bus') return drawProp.call(this,r,g,o,t,state);
        this.box(r,g,o.x-1,o.y-1,0,3,3,48,'#5a797c');
        const q=r.w(o.x,o.y,43);P.rect(g,q[0]-10,q[1]-8,21,18,'#d5be84');P.rect(g,q[0]-8,q[1]-6,17,10,'#3a686d');E.font.text(g,'BUS',q[0],q[1]-3,'#efe4bf',{align:'center',font:'tiny',shadow:false,outline:false});
    };
    W.drawDistrict=function(r,state,t,night){
        for(const o of D.scenery){
            if(!r.visible(o.x,o.y,0,100,80,160))continue;
            const {x,y,type}=o;
            if(type==='pond'){
                r.decal(g=>{this.poly(r,g,[[x-38,y-11,.2],[x+42,y-11,.2],[x+42,y+13,.2],[x-38,y+13,.2]],'#a3a28a');this.poly(r,g,[[x-33,y-7,.3],[x+37,y-7,.3],[x+37,y+9,.3],[x-33,y+9,.3]],'#497d7f');for(let i=0;i<4;i++)this.line(r,g,[x-28+i*15,y+Math.sin(t+i)*3,.4],[x-17+i*15,y+Math.sin(t+i)*3,.4],'#9db3a0');});continue;
            }
            r.queue(x,y,0,g=>{
                if(type==='tree'||type==='planter'){
                    const tall=type==='tree';this.box(r,g,x-6,y-6,0,12,12,8,'#9b8970');this.box(r,g,x-2,y-2,4,4,4,tall?42:10,'#5d6856');const q=r.w(x,y,tall?47:20);P.disc(g,q[0],q[1],tall?25:10,'#456f5b');P.disc(g,q[0]-9,q[1]-12,tall?18:7,'#668b69');P.disc(g,q[0]+14,q[1]-3,tall?17:7,'#7a986d');
                }else if(type==='lamp'){
                    this.box(r,g,x,y,0,3,3,61,'#4a6467');const q=r.w(x+1,y+1,59);P.rect(g,q[0]-6,q[1]-6,13,12,'#415a5c');P.rect(g,q[0]-4,q[1]-4,9,8,'#e5c28c');r.glowDisc(g,q[0],q[1],22,'#edbd7e',.06+night*.13);
                }else if(type==='bench') drawProp.call(this,r,g,{x,y,type:'bench'},t,state);
                else if(type==='net'){
                    for(const xx of[x-16,x+16])this.box(r,g,xx,y,0,2,3,30,'#a09672');for(let z=5;z<=28;z+=4)this.line(r,g,[x-16,y+1,z],[x+17,y+1,z],'#b2b191');for(let dx=-14;dx<17;dx+=4)this.line(r,g,[x+dx,y+1,5],[x+dx,y+1,29],'#8ba08d');
                }else if(type==='stall'){
                    this.box(r,g,x-23,y-10,0,46,22,15,'#a49069');for(const dx of[-21,21])this.box(r,g,x+dx,y-8,15,2,2,29,'#7c795c');this.poly(r,g,[[x-27,y-15,44],[x+27,y-15,44],[x+27,y+18,37],[x-27,y+18,37]],'#a96951');for(let i=0;i<8;i++){const q=r.w(x-17+i*5,y+5,18);P.disc(g,q[0],q[1],3,i%2?'#caa764':'#b88049');}
                }else if(type==='flags'){
                    this.line(r,g,[x-40,y,58],[x+40,y,55],'#53645c');for(let i=0;i<6;i++){const q=r.w(x-35+i*14,y,56);P.poly(g,[[q[0],q[1]],[q[0]+9,q[1]+1],[q[0]+4,q[1]+12]],i%2?'#be8062':'#d2b786');}
                }else if(type==='bikes'){
                    for(let i=0;i<3;i++){const q=r.w(x+i*12,y,7);g.strokeStyle='#adc1b0';g.lineWidth=2;g.beginPath();g.arc(q[0]-7,q[1],6,0,Math.PI*2);g.arc(q[0]+8,q[1],6,0,Math.PI*2);g.stroke();P.line(g,q[0]-7,q[1],q[0]+1,q[1]-12,'#526f79',2);P.line(g,q[0]+8,q[1],q[0]+1,q[1]-12,'#526f79',2);P.line(g,q[0]-1,q[1]-13,q[0]+7,q[1]-13,'#293f44',2);}
                }else if(type==='bus'){
                    this.box(r,g,x-36,y-15,4,76,29,29,'#a8b4a2','#7e988b');this.box(r,g,x-36,y-15,33,76,29,4,'#b58a64');this.poly(r,g,[[x-31,y+14,18],[x+34,y+14,18],[x+34,y+14,30],[x-31,y+14,30]],'#30565e');for(let i=0;i<5;i++)this.line(r,g,[x-31+i*14,y+14.5,18],[x-31+i*14,y+14.5,30],'#a8b4a2',2);for(const dx of[-22,23]){const q=r.w(x+dx,y+16,6);P.disc(g,q[0],q[1],7,'#253d43');P.disc(g,q[0],q[1],3,'#92a595');}
                }
            });
        }
        for(const a of D.activityDefs){if(!r.visible(a.x,a.y,0,40,60,110))continue;const done=state.case.flags['side-'+a.id];r.textAt(a.x,a.y,58,done?'*':'+',done?'#9fc8b2':'#e6bb7d',{align:'center',shadow:'#173a42'});}
    };
    W.drawMap=function(canvas,state,large=false){
        const g=canvas.getContext('2d'),w=canvas.width,h=canvas.height,B=D.bounds;
        const spanX=large?B.maxX-B.minX+72:470,spanY=large?B.maxY-B.minY+72:315;
        const left=large?B.minX-36:state.player.x-spanX/2,top=large?B.minY-36:state.player.y-spanY/2;
        const scale=Math.min(w/spanX,h/spanY),ox=(w-spanX*scale)/2-left*scale,oy=(h-spanY*scale)/2-top*scale;
        const xy=(x,y)=>[ox+x*scale,oy+y*scale];canvas.harborMap={scale,ox,oy};
        g.clearRect(0,0,w,h);g.fillStyle='#17363e';g.fillRect(0,0,w,h);
        for(const d of D.districts){g.fillStyle=E.shade(d.color,-.43);g.fillRect(...xy(d.x,d.y),d.w*scale,d.d*scale);}
        g.fillStyle='#688577';for(const a of D.roads)g.fillRect(...xy(a.x,a.y),a.w*scale,a.d*scale);
        g.fillStyle='#688577';g.fillRect(...xy(34,310),770*scale,85*scale);
        for(const b of this.buildings){g.fillStyle='#91a08b';g.fillRect(...xy(b.x,b.y),b.w*scale,b.d*scale);}
        for(const n of this.npcs){const [x,y]=xy(n.x,n.y);if(x<0||x>w||y<0||y>h)continue;g.fillStyle=n.activity?'#f0c283':'#add4c1';g.beginPath();g.arc(x,y,n.activity?3:large?1.5:2,0,Math.PI*2);g.fill();}
        if(large){g.textAlign='center';g.font='bold 13px Arial';for(const d of D.districts){const q=xy(d.center[0],d.center[1]);g.fillStyle='#16333c';g.fillRect(q[0]-58,q[1]-9,116,20);g.fillStyle='#e4dbc2';g.fillText(d.name,q[0],q[1]+5);}g.font='bold 10px Arial';for(const b of D.busStops){const q=xy(b.x,b.y);g.fillStyle='#b5d2d0';g.fillText('B',q[0],q[1]-7);}}
        const target=state.targetFor(D.objectives[state.case.stage].target);
        const ring=(p,color,size)=>{if(!p)return;const [x,y]=xy(p.x,p.y);g.strokeStyle=color;g.lineWidth=2;g.beginPath();g.arc(x,y,size,0,Math.PI*2);g.stroke();};
        ring(target,'#efb976',large?9:6);for(const p of state.activities?.targets()||[])ring(p,'#9be0c8',large?5:4);
        if(state.path?.length)ring(state.path[state.path.length-1],'#f2e9cf',5);
        const [x,y]=xy(state.player.x,state.player.y);g.save();g.translate(x,y);g.rotate(state.player.facing+Math.PI/2);g.fillStyle='#fff4d6';g.beginPath();g.moveTo(0,-7);g.lineTo(5,5);g.lineTo(0,2);g.lineTo(-5,5);g.closePath();g.fill();g.restore();
        if(!large){g.fillStyle='#f5e6c7';g.font='bold 10px Arial';g.textAlign='right';g.fillText('N ↑',w-8,14);}
    };
})(window);
