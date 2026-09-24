from heapq import heappush, heappop
from math import hypot, ceil

R=0.52
bounds=(-38,62,-39,49)
rects=[]; circles=[]
def rect(x,z,w,d,tag='wall'): rects.append([x,z,w,d,tag,True])
def circle(x,z,r,tag='rock'): circles.append([x,z,r,tag,True])

def house(x,z,s=1): rect(x,z,5*s,4*s,'house')
def tree(x,z,s=1): circle(x,z,.55*s,'tree')

def cliff(points):
    for x,z,s in points: circle(x,z,1.55*s,'cliff')

# Geometry-matched collision model from src/main.js.
rect(-28,17,67,4.2,'water'); rect(28,17,33,4.2,'water')
house(-19,32,.92); house(-9,36,.82); house(-24,24,.76)
circle(-2,27,.35,'sign'); circle(12,10,.35,'sign')
for t in [(-31,35,1.2),(-29,28,.9),(-3,38,1), (1,31,.8),(-16,15,.85),(-8,11,.9),(-14,4,.85),(16,21,.92),(28,16,.84),(31,6,.9)]: tree(*t)
cliff([
(-34,5,1.15),(-31,1,1),(-27,-2,1.1),(-22,-5,.95),(-17,-8,1),(-12,-10,.92),
(4,-9,.9),(9,-10,.92),(14,-10,.9),(19,-9,.92),(24,-8,1),(29,-7,1.1),
(32,-3,1),(34,2,1),(35,8,1.1),(35,13,1.1),
(30,31,1.1),(25,35,1.05),(20,39,1.1),(12,42,1.15),(4,44,1.2),(-5,46,1.1),(-16,47,1.05),(-27,45,1.15),(-35,40,1.1),
(33,-15,1),(35,-19,1),(37,-22,.95),(39,-31,1),(44,-36,1.05),(50,-38,1),(57,-35,1.1),(60,-29,1.05),(61,-22,1),(59,-15,1.05),(55,-11,1),(50,-10,.95)
])
circle(21,4,2.7,'mill')
rect(17.3,4.3,1.1,1.0,'console')
rect(31.2,-8.4,1.1,13.0,'seal')
rect(31.2,23.5,1.2,51.0,'ridgeNorth'); rect(31.2,-27.0,1.2,24.0,'ridgeSouth')
circle(37.2,-12.5,.6,'chest');circle(-20.5,-2.2,.6,'chest')
rect(42.2,-17.5,17.0,1.15,'rune')
rect(32.45,-17.5,2.5,1.4,'runeBankWest'); rect(56.35,-17.5,11.3,1.4,'runeBankEast')
for i in range(14):
    import math
    a=i/14*math.pi*2;x=48+math.cos(a)*13.8;z=-25+math.sin(a)*13.8;circle(x,z,.8,'arena')
for x,z in [(24,10),(29,-4),(39,-10),(48,-31),(54,-21)]: circle(x,z,.38,'crystal')

def blocked(x,z,disabled_tags=set()):
    if not (bounds[0]+R<=x<=bounds[1]-R and bounds[2]+R<=z<=bounds[3]-R): return True
    for cx,cz,w,d,tag,active in rects:
        if tag in disabled_tags: continue
        nx=max(cx-w/2,min(x,cx+w/2));nz=max(cz-d/2,min(z,cz+d/2))
        if (x-nx)**2+(z-nz)**2<R*R:return True
    for cx,cz,rr,tag,active in circles:
        if tag in disabled_tags: continue
        if hypot(x-cx,z-cz)<R+rr:return True
    return False

STEP=.55
DIRS=[(1,0),(-1,0),(0,1),(0,-1),(1,1),(1,-1),(-1,1),(-1,-1)]
def node(p): return (round(p[0]/STEP),round(p[1]/STEP))
def world(n): return n[0]*STEP,n[1]*STEP

def path(start,goal,disabled_tags=set()):
    s=node(start);g=node(goal);pq=[(0,s)];cost={s:0};prev={}
    while pq:
        _,cur=heappop(pq)
        if hypot(cur[0]-g[0],cur[1]-g[1])<=2:
            # reconstruct
            out=[]
            while cur in prev: out.append(world(cur));cur=prev[cur]
            out.append(world(s));out.reverse();return out,cost[node(out[-1])] if node(out[-1]) in cost else 0
        for dx,dz in DIRS:
            nxt=(cur[0]+dx,cur[1]+dz);x,z=world(nxt)
            if blocked(x,z,disabled_tags):continue
            nc=cost[cur]+(1.414 if dx and dz else 1)
            if nc<cost.get(nxt,1e9):cost[nxt]=nc;prev[nxt]=cur;heappush(pq,(nc+hypot(nxt[0]-g[0],nxt[1]-g[1]),nxt))
    return None,None

checks=[
('start → keeper',(-15,33),(14,7),set()),
('keeper → field raider',(14,7),(3,7),set()),
('field → mill console',(3,7),(17.3,4.3),set()),
('mill → core, seal active',(16,4),(36.0,-12.5),set()),
('mill → core, seal open',(16,4),(36.0,-12.5),{'seal'}),
('core → boss, rune active',(36.0,-12.5),(48,-25),{'seal'}),
('core → boss, rune broken',(36.0,-12.5),(48,-25),{'seal','rune'}),
('start → optional armor',(-15,33),(-19.2,-2.2),set()),
]
for name,a,b,disabled in checks:
    p,c=path(a,b,disabled);print(f'{name}:', 'OPEN' if p else 'BLOCKED', f'~{len(p)*STEP:.1f}m' if p else '')
