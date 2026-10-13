/* Copperline: deterministic railway economy. Money is in thousands of dollars. */
export const VERSION=1, W=36, H=28, TILE=16, MONTH_SECONDS=6, DEADLINE=120;
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const GOODS={
 passengers:{name:'Passengers',short:'PAX',color:'#efc77a',rate:2.8},
 mail:{name:'Mail',short:'MAIL',color:'#9ec6de',rate:2.1},
 logs:{name:'Logs',short:'LOGS',color:'#bb8959',rate:2.0},
 lumber:{name:'Lumber',short:'WOOD',color:'#e1b97d',rate:3.6},
 grain:{name:'Grain',short:'GRAIN',color:'#e5be56',rate:2.0},
 food:{name:'Food',short:'FOOD',color:'#aac471',rate:3.1},
 ore:{name:'Copper ore',short:'ORE',color:'#b67a65',rate:2.6},
 copper:{name:'Copper',short:'COPPER',color:'#e49a71',rate:4.4}
};
export const ENGINES={
 pioneer:{name:'Pioneer 2-6-0',class:'Mixed service',price:42,speed:7.2,power:1.1,capacity:4,upkeep:.62,color:'#d08b46',available:0,description:'A sound first engine. Low cost and balanced performance.'},
 hauler:{name:'Mastodon 2-8-0',class:'Heavy freight',price:78,speed:6.3,power:2.3,capacity:7,upkeep:1.05,color:'#759f94',available:0,description:'More pulling power. Seven cars and less speed loss on grades.'},
 express:{name:'Kestrel 4-4-2',class:'Fast passenger',price:98,speed:11.5,power:1.3,capacity:5,upkeep:1.3,color:'#c66854',available:30,description:'Fast service for passengers and mail. Available in July 1892.'}
};
export const SITES=[
 {id:'cedar',name:'Cedar Junction',x:7,y:19,type:'town',tag:'VALLEY TOWN',pop:1800,produces:{passengers:2.8,mail:1.1},accepts:['passengers','mail','food'],description:'The valley railway starts here. Passengers and mail need a route to the coast.'},
 {id:'port',name:'Port Alder',x:29,y:22,type:'port',tag:'COASTAL PORT',pop:3200,produces:{passengers:3.6,mail:1.5},accepts:['passengers','mail','lumber','food','copper'],description:'The coastal market. Export lumber and copper here to complete the charter contracts.'},
 {id:'forest',name:'Highpine Camp',x:5,y:6,type:'forest',tag:'LOGGING CAMP',produces:{logs:5.5},accepts:[],description:'Cut timber is ready for transport. Pineworks Sawmill can turn logs into lumber.'},
 {id:'sawmill',name:'Pineworks Sawmill',x:15,y:7,type:'sawmill',tag:'LUMBER INDUSTRY',produces:{},accepts:['logs'],process:{input:'logs',output:'lumber',rate:4.5,ratio:.9},description:'Consumes logs to make lumber. Port Alder pays for the finished product.'},
 {id:'farm',name:'Sunfield Farm',x:5,y:25,type:'farm',tag:'GRAIN FARM',produces:{grain:5},accepts:[],description:'Rich soil produces a steady grain supply. Send grain to Millbrook.'},
 {id:'mill',name:'Millbrook',x:17,y:23,type:'mill',tag:'MILL TOWN',pop:1200,produces:{passengers:1.9,mail:.7},accepts:['passengers','mail','grain'],process:{input:'grain',output:'food',rate:4,ratio:.85},description:'A small town and flour mill. Grain deliveries create food for Cedar Junction and Port Alder.'},
 {id:'mine',name:'Copper Ridge',x:29,y:6,type:'mine',tag:'COPPER MINE',produces:{ore:4.5},accepts:[],description:'The high ridge holds copper ore. A strong engine handles the grade well.'},
 {id:'foundry',name:'Alder Foundry',x:29,y:15,type:'foundry',tag:'COPPER WORKS',produces:{},accepts:['ore'],process:{input:'ore',output:'copper',rate:3.5,ratio:.75},description:'Refines copper ore. Carry the finished copper to Port Alder.'}
];
export const CONTRACTS=[
 {id:'first',title:'The valley connection',text:'Deliver 20 passenger cars.',cargo:'passengers',target:20,reward:30},
 {id:'timber',title:'A harbour built of timber',text:'Deliver 32 lumber cars to Port Alder.',cargo:'lumber',to:'port',target:32,reward:75},
 {id:'harvest',title:'Bread for the coast',text:'Deliver 24 food cars to Port Alder.',cargo:'food',to:'port',target:24,reward:50},
 {id:'metal',title:'The copper contract',text:'Deliver 18 copper cars to Port Alder.',cargo:'copper',to:'port',target:18,reward:85}
];
export const EVENTS=[
 {at:18,end:30,title:'The spring timber order',text:'Lumber fees rise by 30% for one year.',cargo:'lumber',multiplier:1.3},
 {at:40,end:46,title:'Rain over the valley',text:'Heavy rain slows trains by 20% for six months.',speed:.8},
 {at:66,end:78,title:'The coastal exhibition',text:'Passenger and mail fees rise by 35% for one year.',cargo:'passengers',also:'mail',multiplier:1.35},
 {at:90,end:102,title:'Copper export boom',text:'Copper fees rise by 40% for one year.',cargo:'copper',multiplier:1.4}
];
export const riverY=x=>13.4+2.2*Math.sin(x*.21)+.55*Math.sin(x*.61);
const noise=(x,y)=>{const a=Math.sin(x*127.1+y*311.7)*43758.5453;return a-Math.floor(a)};
export function elevation(x,y){
 const river=Math.abs(y-riverY(x));
 let h=2.5+Math.max(0,7-y)*2.8+Math.max(0,x-24)*Math.max(0,13-y)*.17;
 h+=Math.max(0,4-x)*Math.max(0,17-y)*.22;
 h+=Math.sin(x*.33)*1.1+Math.sin(y*.43+x*.12)*1.25;
 h*=clamp((river-1.0)/2.4,0,1);
 for(const s of SITES){const d=Math.hypot(x-s.x,y-s.y);if(d<2.2)h=h*.65+Math.max(1,h)*.35;}
 return Math.max(0,h);
}
export function terrain(x,y){return {x,y,h:elevation(x+.5,y+.5),water:Math.abs(y+.5-riverY(x+.5))<1.05,forest:y<12&&noise(x,y)>.42,noise:noise(x,y)};}
export const MAP=Array.from({length:H},(_,y)=>Array.from({length:W},(_,x)=>terrain(x,y)));
const key=(x,y)=>x+','+y;
const idpair=(a,b)=>[a,b].sort().join(':');
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const validMoney=x=>typeof x==='number'&&Number.isFinite(x);
export class Railway {
 constructor(data){
 this.month=0;this.cash=520;this.debt=100;this.bonds=1;this.shares=100;this.playerShares=60;this.personalCash=25;this.dividend=0;
 this.grants=0;this.revenue=0;this.expenses=0;this.capital=0;this.profit=0;this.lastRevenue=0;this.lastExpenses=0;this.monthRevenue=0;this.monthExpenses=0;
 this.routes=[];this.trains=[];this.delivered={};this.deliveredTo={};this.contracts=[];this.history=[];this.messages=[];this.result=null;this.sandbox=false;this.warnings=[];
 this.sites=SITES.map(s=>({...s,produces:{...s.produces},accepts:[...s.accepts],station:s.id==='cedar'?1:0,service:s.id==='cedar',owned:false,boost:1,stock:Object.fromEntries(Object.keys(GOODS).map(k=>[k,(s.produces[k]||0)*2])),inputs:{},demand:Object.fromEntries(s.accepts.map(k=>[k,1])),received:{}}));
 this.blockOwners={};this.blockQueues={};this.nextTrain=1;this.nextRoute=1;this.lastMonth=0;this.eventsSeen=[];this.notifications=[];
 if(data)this.restore(data);
 }
 site(id){return this.sites.find(s=>s.id===id)}
 notify(title,text,type='info'){const n={id:this.messages.length+1,month:this.month,title,text,type};this.messages.push(n);if(this.messages.length>80)this.messages.shift();this.notifications.push(n);}
 spend(value){if(!validMoney(value)||value<0||this.cash+1e-7<value)throw new Error('The company does not have enough cash.');this.cash-=value;this.capital+=value;}
 income(value,kind='traffic'){this.cash+=value;if(kind==='grant')this.grants+=value;else this.revenue+=value;this.monthRevenue+=value;this.profit=this.revenue-this.expenses;}
 cost(value){this.cash-=value;this.expenses+=value;this.monthExpenses+=value;this.profit=this.revenue-this.expenses;}
 stationPrice(id){const s=this.site(id);return s&&s.station?0:24;}
 buildStation(id){const s=this.site(id);if(!s)throw new Error('Select a valid site.');if(s.station)throw new Error('This site already has a station.');this.spend(24);s.station=1;this.notify('Station opened',s.name+' is ready for a railway connection.','build');return s;}
 upgradeStation(id){const s=this.site(id);if(!s?.station||s.station>=3)throw new Error('This station cannot be upgraded.');this.spend(s.station===1?30:45);s.station++;this.notify('Station expanded',s.name+' can load trains faster and store more cargo.','build');}
 addService(id){const s=this.site(id);if(!s?.station||s.service)throw new Error('Select a station without a service depot.');this.spend(22);s.service=true;this.notify('Service depot ready','Trains can receive automatic service at '+s.name+'.','build');}
 routeCells(){return new Set(this.routes.flatMap(r=>r.path.map(p=>key(p.x,p.y))));}
 survey(from,to,policy='valley',waypoint=null){
 const a=this.site(from),b=this.site(to);if(!a||!b||a.id===b.id)throw new Error('Select two different sites.');
 if(this.routes.some(r=>idpair(r.from,r.to)===idpair(from,to)))throw new Error('These sites already have a direct railway.');
 if(!['valley','direct'].includes(policy))throw new Error('Select a valid survey policy.');
 const occupied=this.routeCells();
 const solve=(start,end)=>{
  const scores=new Map([[key(start.x,start.y),0]]),parent=new Map(),open=[{x:start.x,y:start.y,f:0}],closed=new Set();
  while(open.length){open.sort((a,b)=>a.f-b.f);const c=open.shift(),ck=key(c.x,c.y);if(closed.has(ck))continue;closed.add(ck);
   if(c.x===end.x&&c.y===end.y){let out=[{x:c.x,y:c.y}],k=ck;while(parent.has(k)){const p=parent.get(k);out.push(p);k=key(p.x,p.y);}return out.reverse();}
   for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const x=c.x+dx,y=c.y+dy;if(x<1||x>=W-1||y<1||y>=H-1)continue;
    const t=MAP[y][x],prev=MAP[c.y][c.x],step=Math.hypot(dx,dy),grade=Math.abs(t.h-prev.h);
    let cost=step*(occupied.has(key(x,y))?.5:1.7)+(t.water?4.8:0)+grade*(policy==='valley'?1.8:.15)+(t.forest?.15:0);
    if(policy==='direct')cost=step*3+grade*.1+(t.water?1:0);
    const nk=key(x,y),g=scores.get(ck)+cost;if(g<(scores.get(nk)??Infinity)){scores.set(nk,g);parent.set(nk,{x:c.x,y:c.y});open.push({x,y,f:g+Math.hypot(x-end.x,y-end.y)*.5});}
   }
  }return null;
 };
 let path=waypoint?(()=>{const p=solve(a,waypoint),q=solve(waypoint,b);return p&&q?[...p,...q.slice(1)]:null})():solve(a,b);
 if(!path)throw new Error('No route is available.');
 let rail=0,bridges=0,tunnels=0,length=0,grade=0;
 for(let i=0;i<path.length;i++){const p=path[i],t=MAP[p.y][p.x];p.z=Math.max(1.2,t.h);p.water=t.water;
  if(i){const prev=path[i-1],d=dist(p,prev);length+=d;grade+=Math.abs(p.z-prev.z);}
  if(!occupied.has(key(p.x,p.y))){rail+=1.55;if(t.water){bridges++;rail+=5.2;}if(t.h>13&&policy==='direct'){tunnels++;rail+=3.8;}}
 }
 const stationCost=this.stationPrice(from)+this.stationPrice(to);
 const cost=Math.round((rail+stationCost)*10)/10;
 return {from,to,policy,waypoint,path,cost,railCost:cost-stationCost,stationCost,bridges,tunnels,length,grade:grade/Math.max(length,1),double:false};
 }
 buildRoute(quote){if(!quote||!this.site(quote.from)||!this.site(quote.to))throw new Error('Survey a route first.');
 // Recompute every quote. The UI cannot bypass the economy with a stale price.
 const current=this.survey(quote.from,quote.to,quote.policy,quote.waypoint);this.spend(current.cost);
 for(const id of [current.from,current.to]){const s=this.site(id);if(!s.station)s.station=1;}
 const route={...current,id:'r'+this.nextRoute++};this.routes.push(route);this.notify('Railway opened',this.site(route.from).name+' is now linked to '+this.site(route.to).name+'.','build');return route;
 }
 doubleTrack(id){const r=this.routes.find(r=>r.id===id);if(!r||r.double)throw new Error('Select a single-track route.');this.spend(Math.round(r.railCost*.65));r.double=true;this.notify('Passing capacity added','This route now supports trains in both directions.','build');}
 removeRoute(id){const r=this.routes.find(r=>r.id===id);if(!r)throw new Error('Route not found.');if(this.trains.some(t=>t.journey?.routeIds.includes(id)))throw new Error('A train uses this route. Sell or reroute it first.');
 const rest=this.routes.filter(r=>r.id!==id);const old=this.routes;this.routes=rest;
 if(this.trains.some(t=>t.stops.some((s,i)=>!this.networkPath(s,t.stops[(i+1)%t.stops.length])))){this.routes=old;throw new Error('Removing this route would break a train service.');}
 this.cash+=r.railCost*.35;this.notify('Railway removed','Recovered 35% of the track construction cost.');
 }
 networkPath(from,to){
 if(from===to)return {points:[],routeIds:[],length:0,grade:0};
 const d=new Map([[from,0]]),prev=new Map(),todo=[from];
 while(todo.length){todo.sort((a,b)=>(d.get(a)||0)-(d.get(b)||0));const n=todo.shift();if(n===to)break;
  for(const r of this.routes){const v=r.from===n?r.to:r.to===n?r.from:null;if(!v)continue;const nd=d.get(n)+r.length;if(nd<(d.get(v)??Infinity)){d.set(v,nd);prev.set(v,{n,r});if(!todo.includes(v))todo.push(v);}}
 }
 if(!prev.has(to))return null;
 let cur=to,parts=[];while(cur!==from){const p=prev.get(cur);if(!p)return null;parts.push({route:p.r,reverse:p.r.to===p.n});cur=p.n;}parts.reverse();
 const points=[],routeIds=[],segments=[];let grade=0,len=0;
 for(const p of parts){const cells=p.reverse?[...p.route.path].reverse():p.route.path;for(let i=0;i<cells.length;i++){if(points.length&&i===0)continue;points.push({...cells[i],routeId:p.route.id});}routeIds.push(p.route.id);segments.push({id:p.route.id,start:len,end:len+p.route.length});grade+=p.route.grade*p.route.length;len+=p.route.length;}
 let cumulative=0;for(let i=0;i<points.length;i++){if(i)cumulative+=dist(points[i-1],points[i]);points[i].distance=cumulative;}
 return {points,routeIds,segments,length:cumulative,grade:grade/Math.max(1,len)};
 }
 validateTrain(o){
 const engine=ENGINES[o.engine];if(!engine||this.month<engine.available)throw new Error('This engine is not yet available.');
 if(!Array.isArray(o.stops)||o.stops.length<2||o.stops.length>4||new Set(o.stops).size!==o.stops.length)throw new Error('Choose two to four different stops.');
 for(let i=0;i<o.stops.length;i++){const a=this.site(o.stops[i]),b=this.site(o.stops[(i+1)%o.stops.length]);if(!a?.station||!b?.station)throw new Error('Build stations at every stop.');if(!this.networkPath(a.id,b.id))throw new Error(a.name+' and '+b.name+' need a railway connection.');}
 if(o.cargo!=='auto'&&!GOODS[o.cargo])throw new Error('Choose a valid cargo plan.');if(!['any','half','full'].includes(o.wait))throw new Error('Choose a valid departure rule.');
 return engine;
 }
 buyTrain(o){const engine=this.validateTrain(o);const cars=clamp(Math.floor(Number(o.cars)||engine.capacity),1,engine.capacity);this.spend(engine.price+cars*2);
 const t={id:'t'+this.nextTrain++,name:o.name?.trim().slice(0,32)||('No. '+String(this.nextTrain-1).padStart(2,'0')+' · '+engine.name.split(' ')[0]),engine:o.engine,cars,stops:[...o.stops],cargo:o.cargo,wait:o.wait,stopIndex:0,progress:0,journey:null,load:[],condition:100,hold:false,state:'loading',dwell:0,age:0,revenue:0,costs:0,trips:0,loadedMiles:0,emptyMiles:0,serviceTimer:0};
 this.trains.push(t);this.prepare(t);this.notify('A new train is ready',t.name+' has joined the railway.','train');return t;
 }
 configureTrain(id,o){const t=this.trains.find(t=>t.id===id);if(!t)throw new Error('Train not found.');this.validateTrain({...o,engine:t.engine});if(!o.stops.some(s=>t.stops.includes(s)))throw new Error('New orders must include at least one current stop.');t.pending={stops:[...o.stops],cargo:o.cargo,wait:o.wait};this.notify('New orders received',t.name+' will apply these orders after its next delivery.');}
 sellTrain(id){const t=this.trains.find(t=>t.id===id);if(!t)throw new Error('Train not found.');const value=ENGINES[t.engine].price*.55*(.5+t.condition/200)+t.cars;this.cash+=value;this.releaseBlocks(t);this.trains=this.trains.filter(x=>x.id!==id);this.notify('Engine sold',t.name+' returned $'+Math.round(value)+'k to the company.');return value;}
 serviceTrain(id){const t=this.trains.find(t=>t.id===id);if(!t)throw new Error('Train not found.');this.spend(5);t.condition=100;t.serviceTimer=.35;this.notify('Maintenance crew assigned',t.name+' will return to service in a short time.');}
 prepare(t){const from=t.stops[t.stopIndex],to=t.stops[(t.stopIndex+1)%t.stops.length];t.journey=this.networkPath(from,to);t.progress=0;t.state=t.journey?'loading':'blocked';t.dwell=0;t.load=[];}
 offer(t){const s=this.site(t.stops[t.stopIndex]),dest=this.site(t.stops[(t.stopIndex+1)%t.stops.length]);if(!s||!dest)return [];
 return Object.keys(GOODS).filter(k=>dest.accepts.includes(k)&&s.stock[k]>=.99&&(t.cargo==='auto'||k===t.cargo)).sort((a,b)=>this.fee(b,s,dest,t)-this.fee(a,s,dest,t));}
 fee(cargo,from,to,t){const g=GOODS[cargo],distance=dist(from,to),demand=to.demand[cargo]??1;
 const speed=ENGINES[t.engine].speed,fast=(cargo==='passengers'||cargo==='mail')?clamp(speed/7,.7,1.45):1;
 const event=EVENTS.find(e=>this.month>=e.at&&this.month<e.end&&(e.cargo===cargo||e.also===cargo));
 return g.rate*(.48+Math.sqrt(distance)/4.1)*demand*fast*(event?.multiplier||1);}
 depart(t){const src=this.site(t.stops[t.stopIndex]);let cap=t.cars;t.load=[];
 for(const cargo of this.offer(t)){const amount=Math.min(cap,Math.floor(src.stock[cargo]));if(amount){src.stock[cargo]-=amount;t.load.push({cargo,amount});cap-=amount;}if(!cap)break;}
 t.state='running';t.dwell=0;
 }
 releaseBlocks(t){for(const [id,owner] of Object.entries(this.blockOwners))if(owner===t.id)delete this.blockOwners[id];for(const id of Object.keys(this.blockQueues))this.blockQueues[id]=this.blockQueues[id].filter(x=>x!==t.id);}
 arrive(t){this.releaseBlocks(t);const from=this.site(t.stops[t.stopIndex]),to=this.site(t.stops[(t.stopIndex+1)%t.stops.length]);let earned=0,cars=0;
 for(const item of t.load){if(!to.accepts.includes(item.cargo))continue;const amount=item.amount,cargo=item.cargo,fee=this.fee(cargo,from,to,t)*amount;earned+=fee;cars+=amount;
 this.delivered[cargo]=(this.delivered[cargo]||0)+amount;const k=to.id+':'+cargo;this.deliveredTo[k]=(this.deliveredTo[k]||0)+amount;to.received[cargo]=(to.received[cargo]||0)+amount;
 if(to.process?.input===cargo)to.inputs[cargo]=(to.inputs[cargo]||0)+amount;
 to.demand[cargo]=Math.max(.42,(to.demand[cargo]||1)-amount*.024);
 }
 if(earned){this.income(earned);t.revenue+=earned;t.trips++;this.notifications.push({type:'delivery',title:'Delivery at '+to.name,text:'+$'+earned.toFixed(1)+'k',site:to.id,amount:earned});}
 const miles=t.journey?.length||0;if(cars)t.loadedMiles+=miles;else t.emptyMiles+=miles;
 t.stopIndex=(t.stopIndex+1)%t.stops.length;t.load=[];
 if(to.service&&t.condition<82){t.condition=100;t.serviceTimer=.22;this.cost(1);t.costs+=1;}
 if(t.pending){const p=t.pending;const idx=p.stops.indexOf(to.id);if(idx>=0){Object.assign(t,p);t.stopIndex=idx;t.pending=null;}}
 this.prepare(t);this.checkContracts();
 }
 buyIndustry(id){const s=this.site(id);if(!s||s.pop||s.owned)throw new Error('Select an industry that is for sale.');this.spend(s.process?110:85);s.owned=true;this.notify('Industry acquired',s.name+' now pays production income to your company.','build');}
 upgradeIndustry(id){const s=this.site(id);if(!s?.owned||s.boost>=1.75)throw new Error('Select an owned industry to expand.');this.spend(60);s.boost=1.75;this.notify('Industry expanded',s.name+' now has 75% more production capacity.','build');}
 issueBond(){if(this.debt>=500)throw new Error('The company has reached its $500k debt limit.');this.cash+=100;this.debt+=100;this.bonds++;this.notify('Bond issued','Received $100k. Annual interest is 6%.');}
 repayBond(){if(this.debt<100)throw new Error('The company has no bonds to repay.');this.spend(100);this.debt-=100;this.bonds--;this.notify('Bond repaid','Annual interest falls by $6k.');}
 get stockPrice(){return Math.max(1,this.companyValue/this.shares)}
 issueShares(){if(this.shares>=160)throw new Error('No further shares can be issued.');const value=this.stockPrice*10;this.shares+=10;this.cash+=value;this.notify('Shares issued','New investors added $'+Math.round(value)+'k. Your ownership share fell.');}
 buyShares(){if(this.playerShares+5>this.shares)throw new Error('No public shares remain.');const cost=this.stockPrice*5;if(this.personalCash<cost)throw new Error('Your personal account does not have enough cash.');this.personalCash-=cost;this.playerShares+=5;}
 sellShares(){if(this.playerShares<5)throw new Error('You have no shares to sell.');this.personalCash+=this.stockPrice*5;this.playerShares-=5;}
 setDividend(amount){if(![0,.005,.015].includes(amount))throw new Error('Choose a valid dividend rate.');this.dividend=amount;}
 get companyValue(){return Math.max(0,this.cash-this.debt+this.routes.reduce((a,r)=>a+r.railCost*.85,0)+this.sites.reduce((a,s)=>a+s.station*24+(s.service?18:0)+(s.owned?90:0),0)+this.trains.reduce((a,t)=>a+ENGINES[t.engine].price*.7,0)+Math.max(0,this.lastRevenue-this.lastExpenses)*18);}
 get connected(){if(!this.site('cedar').station)return [];const seen=new Set(['cedar']);let changed=true;while(changed){changed=false;for(const r of this.routes)if(seen.has(r.from)||seen.has(r.to)){if(!seen.has(r.from)||!seen.has(r.to))changed=true;seen.add(r.from);seen.add(r.to);}}return [...seen];}
 get trafficProfit(){return this.revenue-this.expenses;}
 goals(){const towns=this.connected.filter(id=>this.site(id).pop).length;
 const bronze=[{label:'Connect the 3 towns',value:towns,target:3},{label:'Carry 60 passenger cars',value:this.delivered.passengers||0,target:60},{label:'Deliver 32 lumber cars to the port',value:this.deliveredTo['port:lumber']||0,target:32},{label:'Earn $80k operating profit',value:Math.floor(this.profit),target:80}];
 const silver=[{label:'Deliver 24 food cars to the port',value:this.deliveredTo['port:food']||0,target:24},{label:'Deliver 18 copper cars to the port',value:this.deliveredTo['port:copper']||0,target:18},{label:'Build a company worth $850k',value:Math.floor(this.companyValue),target:850}];
 const gold=[{label:'Connect all 8 sites',value:this.connected.length,target:8},{label:'Earn $400k operating profit',value:Math.floor(this.profit),target:400},{label:'Reduce debt to $100k or less',value:this.debt<=100?1:0,target:1}];
 return {bronze,silver,gold};}
 medal(){const g=this.goals(),done=a=>a.every(x=>x.value>=x.target);if(!done(g.bronze)||this.cash<0)return null;if(!done(g.silver))return 'bronze';return done(g.gold)?'gold':'silver';}
 finish(){const medal=this.medal();if(!medal)throw new Error('Complete the bronze charter goals first.');this.result={won:true,medal,month:this.month};this.notify('Charter secured','The valley has awarded your railway a '+medal+' charter.','win');}
 checkContracts(){for(const c of CONTRACTS){const n=c.to?(this.deliveredTo[c.to+':'+c.cargo]||0):(this.delivered[c.cargo]||0);if(n>=c.target&&!this.contracts.includes(c.id)){this.contracts.push(c.id);this.income(c.reward,'grant');this.notify('Contract complete',c.title+' · $'+c.reward+'k awarded.','contract');}}}
 advance(dt){if(!Number.isFinite(dt)||dt<=0||this.result)return;
 this.month+=dt;for(const e of EVENTS){if(this.month>=e.at-3&&!this.eventsSeen.includes('warn'+e.at)){this.eventsSeen.push('warn'+e.at);this.notify('Forecast · '+Math.round(Math.max(0,e.at-this.month))+' months',e.title+'. '+e.text);}}
 if(this.month>=30&&!this.eventsSeen.includes('engine')){this.eventsSeen.push('engine');this.notify('New engine available','The Kestrel is ready for fast passenger service.','train');}
 for(const s of this.sites){
  let produced=0;for(const [k,v] of Object.entries(s.produces)){const before=s.stock[k];s.stock[k]=Math.min(18+18*s.station,s.stock[k]+v*s.boost*dt);produced+=s.stock[k]-before;}
  for(const k of s.accepts)s.demand[k]=Math.min(1.15,s.demand[k]+.022*dt);
  if(s.process){const p=s.process,room=Math.max(0,18+18*s.station-s.stock[p.output]),used=Math.min(s.inputs[p.input]||0,p.rate*s.boost*dt,room/p.ratio),out=used*p.ratio;if(s.stock[p.output]<18+18*s.station){s.inputs[p.input]=Math.max(0,(s.inputs[p.input]||0)-used);s.stock[p.output]=Math.min(18+18*s.station,s.stock[p.output]+out);if(s.owned&&used>0)this.income(used*.45,'industry');}}
  else if(s.owned){this.income(produced*.16,'industry');}
 }
 const infra=this.routes.reduce((a,r)=>a+r.length*.022*(r.double?1.45:1),0)+this.sites.reduce((a,s)=>a+(s.station?.16*s.station:0)+(s.service?.1:0),0);
 this.cost((infra+this.debt*.06/12)*dt);
 for(const t of this.trains){const e=ENGINES[t.engine];t.age+=dt;const upkeep=e.upkeep*(t.hold?.22:1)*dt;this.cost(upkeep);t.costs+=upkeep;
  if(t.hold)continue;if(t.serviceTimer>0){t.serviceTimer-=dt;t.state='service';continue;}if(t.state==='service')t.state=t.progress>0?'running':'loading';
  if(!t.journey){t.journey=this.networkPath(t.stops[t.stopIndex],t.stops[(t.stopIndex+1)%t.stops.length]);if(!t.journey){t.state='blocked';continue;}}
  if(t.state==='loading'){
   t.dwell+=dt;const site=this.site(t.stops[t.stopIndex]),available=this.offer(t).reduce((a,c)=>a+Math.floor(site.stock[c]),0),need=t.wait==='full'?t.cars:t.wait==='half'?Math.ceil(t.cars/2):1;
   if(t.dwell>=.17/Math.max(1,site.station)&&(available>=need||t.dwell>=1.0))this.depart(t);
   continue;
  }
  if(t.state==='blocked')continue;
  // A link keeps its owner until that train leaves. Queues prevent starvation.
  const seg=t.journey.segments?.find(s=>t.progress<s.end-1e-7)||t.journey.segments?.at(-1);
  const route=this.routes.find(r=>r.id===seg?.id);
  if(route&&!route.double){
   const queue=this.blockQueues[route.id]=(this.blockQueues[route.id]||[]).filter(id=>{const train=this.trains.find(t=>t.id===id);return train&&(!train.hold||this.blockOwners[route.id]===id);});
   if(!queue.includes(t.id)&&this.blockOwners[route.id]!==t.id)queue.push(t.id);
   if(!this.blockOwners[route.id]&&queue[0]===t.id){this.blockOwners[route.id]=t.id;queue.shift();}
   if(this.blockOwners[route.id]!==t.id){t.state='signal';continue;}
  }
  if(t.state==='signal')t.state='running';
  t.condition=Math.max(15,t.condition-dt*.65);
  const weather=EVENTS.find(x=>this.month>=x.at&&this.month<x.end&&x.speed)?.speed||1;
  const load=t.load.reduce((a,b)=>a+b.amount,0),grade=t.journey.grade;
  const speed=e.speed/(1+grade*.42/e.power+load*.014/e.power)*clamp(t.condition/80,.48,1)*weather;
  t.progress=Math.min(t.progress+speed*dt,seg?.end??t.journey.length);
  if(seg&&t.progress>=seg.end-1e-7&&this.blockOwners[seg.id]===t.id)delete this.blockOwners[seg.id];
  if(t.progress>=t.journey.length-1e-7)this.arrive(t);
 }
 const month=Math.floor(this.month);if(month>this.lastMonth){this.lastMonth=month;this.lastRevenue=this.monthRevenue;this.lastExpenses=this.monthExpenses;
  this.history.push({month,revenue:this.monthRevenue,expenses:this.monthExpenses,cash:this.cash,value:this.companyValue});if(this.history.length>120)this.history.shift();this.monthRevenue=0;this.monthExpenses=0;
  if(this.dividend&&this.cash>40){const payment=this.stockPrice*this.shares*this.dividend/12;if(this.cash>payment){this.cost(payment);this.personalCash+=payment*this.playerShares/this.shares;}}
  if(this.cash<0&&!this.warnings.includes('cash')){this.warnings.push('cash');this.notify('Cash reserve is empty','Issue a bond, sell an engine, or reduce running costs.','warning');}if(this.cash>20)this.warnings=this.warnings.filter(x=>x!=='cash');
 }
 if(this.cash<=-100){this.result={won:false,reason:'The company exceeded its $100k overdraft.',month:this.month};}
 else if(!this.sandbox&&this.month>=DEADLINE){const medal=this.medal();this.result={won:!!medal,medal,reason:medal?'The charter deadline has arrived.':'The charter goals were not met by January 1900.',month:this.month};}
 }
 position(t){const j=t.journey;if(!j?.points.length){const s=this.site(t.stops[t.stopIndex]);return {x:s?.x||7,y:s?.y||19,z:MAP[s?.y||19][s?.x||7].h,angle:0,routeId:null};}
 const d=clamp(t.progress,0,j.length);let i=1;while(i<j.points.length&&j.points[i].distance<d)i++;i=Math.min(i,j.points.length-1);const a=j.points[i-1]||j.points[0],b=j.points[i],f=clamp((d-a.distance)/Math.max(.01,b.distance-a.distance),0,1);return {x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f,z:a.z+(b.z-a.z)*f,angle:Math.atan2(b.y-a.y,b.x-a.x),routeId:b.routeId};}
 serialize(){const out={};for(const k of ['blockOwners','blockQueues','month','cash','debt','bonds','shares','playerShares','personalCash','dividend','grants','revenue','expenses','capital','profit','lastRevenue','lastExpenses','monthRevenue','monthExpenses','routes','trains','delivered','deliveredTo','contracts','history','messages','result','sandbox','sites','nextTrain','nextRoute','lastMonth','eventsSeen','warnings'])out[k]=this[k];return {version:VERSION,state:structuredClone(out)};}
 restore(data){
 if(data?.version!==VERSION||!data.state)throw new Error('This save file is not a supported Copperline game.');
 const s=data.state,fail=()=>{throw new Error('The save file contains invalid game data.');};
 const fields=['month','cash','debt','bonds','shares','playerShares','personalCash','dividend','grants','revenue','expenses','capital','profit','lastRevenue','lastExpenses','monthRevenue','monthExpenses','nextTrain','nextRoute','lastMonth'];
 for(const k of fields)if(!validMoney(s[k]))fail();
 if(s.month<0||s.debt<0||s.debt>500||s.shares<100||s.shares>160||s.playerShares<0||s.playerShares>s.shares||s.nextTrain<1||s.nextRoute<1)fail();
 if(!Array.isArray(s.sites)||s.sites.length!==SITES.length||new Set(s.sites.map(x=>x.id)).size!==SITES.length||!Array.isArray(s.routes)||s.routes.length>40||!Array.isArray(s.trains)||s.trains.length>60)fail();
 for(const site of s.sites){const def=SITES.find(x=>x.id===site.id);if(![1,1.75].includes(site.boost)||Object.keys(GOODS).some(k=>!validMoney(site.stock?.[k])||site.stock[k]<0))fail();if(!def||site.x!==def.x||site.y!==def.y||!site.stock||!site.inputs||!site.demand||!Array.isArray(site.accepts)||!Number.isInteger(site.station)||site.station<0||site.station>3)fail();for(const o of [site.stock,site.inputs,site.demand,site.received]){if(!o||typeof o!=='object')fail();for(const [k,v] of Object.entries(o))if(!GOODS[k]||!validMoney(v)||v<0)fail();}}
 if(new Set(s.routes.map(r=>r.id)).size!==s.routes.length||new Set(s.trains.map(t=>t.id)).size!==s.trains.length)fail();
 for(const r of s.routes){if(typeof r.id!=='string'||!SITES.some(x=>x.id===r.from)||!SITES.some(x=>x.id===r.to)||r.from===r.to||!Array.isArray(r.path)||r.path.length<2||r.path.length>W*H||!validMoney(r.length)||r.length<=0||!validMoney(r.railCost)||r.railCost<0)fail();for(let i=0;i<r.path.length;i++){const p=r.path[i];if(!Number.isInteger(p.x)||!Number.isInteger(p.y)||p.x<0||p.x>=W||p.y<0||p.y>=H||!validMoney(p.z))fail();if(i&&dist(p,r.path[i-1])>1.42)fail();}}
 for(const t of s.trains){if(typeof t.id!=='string'||!ENGINES[t.engine]||!Array.isArray(t.stops)||t.stops.length<2||t.stops.length>4||new Set(t.stops).size!==t.stops.length||t.stops.some(x=>!SITES.some(s=>s.id===x))||!Number.isInteger(t.stopIndex)||t.stopIndex<0||t.stopIndex>=t.stops.length||!Number.isInteger(t.cars)||t.cars<1||t.cars>ENGINES[t.engine].capacity||!validMoney(t.progress)||t.progress<0||!validMoney(t.condition)||!Array.isArray(t.load))fail();for(const l of t.load)if(!GOODS[l.cargo]||!Number.isInteger(l.amount)||l.amount<0)fail();}
 for(const k of ['contracts','history','messages','eventsSeen','warnings'])if(!Array.isArray(s[k]))fail();
 for(const k of ['delivered','deliveredTo'])if(!s[k]||typeof s[k]!=='object'||Object.values(s[k]).some(v=>!validMoney(v)||v<0))fail();
 if(!s.blockOwners||typeof s.blockOwners!=='object'||Array.isArray(s.blockOwners)||!s.blockQueues||typeof s.blockQueues!=='object'||Array.isArray(s.blockQueues))fail();for(const [id,owner] of Object.entries(s.blockOwners))if(!s.routes.some(r=>r.id===id)||!s.trains.some(t=>t.id===owner))fail();for(const [id,queue] of Object.entries(s.blockQueues))if(!s.routes.some(r=>r.id===id)||!Array.isArray(queue)||new Set(queue).size!==queue.length||queue.some(id=>!s.trains.some(t=>t.id===id)))fail();
 const allowed=[...fields,'routes','trains','delivered','deliveredTo','contracts','history','messages','result','sandbox','sites','eventsSeen','warnings','blockOwners','blockQueues'];
 for(const k of allowed)if(Object.hasOwn(s,k))this[k]=structuredClone(s[k]);
 this.blockOwners=this.blockOwners||{};this.blockQueues=this.blockQueues||{};this.notifications=[];
 for(const t of this.trains){const j=this.networkPath(t.stops[t.stopIndex],t.stops[(t.stopIndex+1)%t.stops.length]);if(!j)fail();t.journey=j;t.progress=Math.min(t.progress,j.length);}
 }
}
