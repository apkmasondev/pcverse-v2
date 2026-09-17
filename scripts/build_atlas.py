"""PCVerse / Atlas: original realtime exhibit, authored with Blender.
Run: blender --background --python scripts/build_atlas.py
All outputs stay in the project. Units are exhibition units, not millimetres.
"""
import bpy, math, os, random
from mathutils import Vector
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
random.seed(12)
def material(name, color, metal=0, rough=.45):
    m = bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metal; p.inputs['Roughness'].default_value=rough
    return m
navy=material('Graphite enamel',(.025,.032,.035),.35)
pcb=material('Midnight PCB',(.035,.095,.09),.2)
silver=material('Brushed aluminium',(.48,.55,.57),.8,.3)
# Perforated panels are the same painted steel as the shell, just bare enough to catch light.
steel=material('Perforated steel',(.125,.138,.148),.62,.33)
black=material('Ceramic',(.019,.026,.03),.2)
nylon=material('Fan satin polymer',(.012,.015,.018),.05,.32)
sleeve=material('Woven cable sheath',(.009,.012,.014),0,.82)
contact=material('Socket gold alloy',(.52,.35,.12),.75,.4)
orange=material('Safety orange',(.95,.20,.035),.25)
gold=material('Copper contacts',(.65,.37,.11),.75)
white=material('Porcelain',(.79,.80,.74),.25)
groups={}
part='board'
def keep(o,mat):
    o.data.materials.append(mat); groups.setdefault(part,[]).append(o); return o
def box(name,loc,size,mat,bevel=.025):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.name=name
    o.dimensions=size; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        m=o.modifiers.new('Machined edges','BEVEL'); m.width=bevel; m.segments=2
        bpy.ops.object.modifier_apply(modifier=m.name)
        o.modifiers.new('Weighted normals','WEIGHTED_NORMAL'); bpy.ops.object.modifier_apply(modifier=o.modifiers[-1].name)
    return keep(o,mat)
def cyl(name,loc,r,depth,mat,vertices=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=depth,location=loc)
    o=bpy.context.object; o.name=name
    for p in o.data.polygons: p.use_smooth=True
    return keep(o,mat)
def text(body,loc,size,mat):
    c=bpy.data.curves.new('Engraving','FONT'); c.body=body; c.size=size; c.extrude=.0005
    o=bpy.data.objects.new(body,c); bpy.context.collection.objects.link(o); o.location=loc
    bpy.context.view_layer.objects.active=o; o.select_set(True); bpy.ops.object.convert(target='MESH'); o.select_set(False)
    return keep(o,mat)
def tube(name,pts,r,mat):
    c=bpy.data.curves.new(name,'CURVE'); c.dimensions='3D'; c.bevel_depth=r; c.bevel_resolution=2
    s=c.splines.new('POLY'); s.points.add(len(pts)-1)
    for p,v in zip(s.points,pts): p.co=(*v,1)
    o=bpy.data.objects.new(name,c); bpy.context.collection.objects.link(o)
    bpy.context.view_layer.objects.active=o; o.select_set(True); bpy.ops.object.convert(target='MESH'); o.select_set(False)
    return keep(o,mat)

def cable(name,pts,r,mat):
    c=bpy.data.curves.new(name,'CURVE'); c.dimensions='3D'; c.resolution_u=6; c.bevel_depth=r; c.bevel_resolution=1
    s=c.splines.new('BEZIER'); s.bezier_points.add(len(pts)-1)
    for p,v in zip(s.bezier_points,pts):
        p.co=v; p.handle_left_type='AUTO'; p.handle_right_type='AUTO'
    o=bpy.data.objects.new(name,c); bpy.context.collection.objects.link(o)
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active=o
    bpy.ops.object.convert(target='MESH'); o.select_set(False); return keep(o,mat)

def ring(name,center,r,thickness,mat,front=False):
    bpy.ops.mesh.primitive_torus_add(major_segments=64,minor_segments=8,location=center,major_radius=r,minor_radius=thickness)
    o=bpy.context.object;o.name=name
    if front:o.rotation_euler.x=math.pi/2
    for p in o.data.polygons:p.use_smooth=True
    return keep(o,mat)

def cut(o,center,size):
    bpy.ops.mesh.primitive_cube_add(size=1,location=center);cutter=bpy.context.object
    cutter.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    mod=o.modifiers.new('Panel opening','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter
    bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter,do_unlink=True)

def drill(o,center,r,depth,axis='Y',sides=64):
    bpy.ops.mesh.primitive_cylinder_add(vertices=sides,radius=r,depth=depth,location=center)
    cutter=bpy.context.object
    if axis=='Y':cutter.rotation_euler.x=math.pi/2
    elif axis=='X':cutter.rotation_euler.y=math.pi/2
    mod=o.modifiers.new('Machined opening','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter
    bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter,do_unlink=True)

def project_gpu_uv(o):
    layer=o.data.uv_layers.active or o.data.uv_layers.new()
    for loop in o.data.loops:
        v=o.matrix_world @ o.data.vertices[loop.vertex_index].co
        layer.data[loop.index].uv=((v.x+2.46)/5.62,(v.z-.385)/2.13)
def textured(name, filename, metal=.25, rough=.5):
    m=material(name,(1,1,1),metal,rough)
    img=bpy.data.images.load(os.path.join(ROOT,filename),check_existing=True)
    if max(img.size)>1400:
        scale=1400/max(img.size); img.scale(int(img.size[0]*scale),int(img.size[1]*scale))
    img.pack()
    n=m.node_tree.nodes.new('ShaderNodeTexImage'); n.image=img
    m.node_tree.links.new(n.outputs['Color'],m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
    return m

def surface(name, vertices, mat, uv=None):
    mesh=bpy.data.meshes.new(name); mesh.from_pydata(vertices,[],[(0,1,2,3)]); mesh.update()
    layer=mesh.uv_layers.new()
    for loop,coord in zip(layer.data,uv or [(0,0),(1,0),(1,1),(0,1)]):loop.uv=coord
    o=bpy.data.objects.new(name,mesh); bpy.context.collection.objects.link(o); return keep(o,mat)

def top(name,x,y,z,w,h,mat):
    return surface(name,[(x-w/2,y-h/2,z),(x+w/2,y-h/2,z),(x+w/2,y+h/2,z),(x-w/2,y+h/2,z)],mat)

def fan(name,center,r,front=False,axis=None):
    # One geometric impeller: no photograph of another fan under the blades.
    # axis is the rotation axis in Blender space; blades pitch towards the outer face.
    axis=axis or ('Y' if front else 'Z')
    x,y,z=center
    def place(u,v,w):
        if axis=='Z':return (x+u,y+v,z+w)
        if axis=='Y':return (x+u,y-w,z+v)
        return (x+w,y+u,z+v)
    def orient(o):
        if axis=='Y':o.rotation_euler.x=math.pi/2
        elif axis=='X':o.rotation_euler.y=math.pi/2
        return o
    orient(cyl(name+' cavity',center,r,.035,black,48))
    orient(ring(name+' inlet rim',place(0,0,.015),r,.023,navy))
    rotor_start=len(groups[part])
    for i in range(9):
        a=i*math.tau/9; verts=[]; faces=[]
        for j in range(11):
            t=j/10; rr=r*(.23+.72*t)
            for k in range(5):
                u=k/4; ang=a+.60*t+(u-.5)*(.85-.28*t)
                pitch=.04+(.08*u-.02)*math.sin(t*math.pi*.8)
                verts.append(place(rr*math.cos(ang),rr*math.sin(ang),pitch))
        for j in range(10):
            for k in range(4):
                n=j*5+k;faces.append((n,n+5,n+6,n+1))
        mesh=bpy.data.meshes.new(name+' airfoil');mesh.from_pydata(verts,[],faces);mesh.update()
        for p in mesh.polygons:p.use_smooth=True
        o=bpy.data.objects.new(name+' airfoil',mesh);bpy.context.collection.objects.link(o);keep(o,nylon)
        mod=o.modifiers.new('Airfoil thickness','SOLIDIFY');mod.thickness=.012
        bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
    orient(cyl(name+' hub',place(0,0,.045),r*.23,.08,black,32))
    orient(cyl(name+' badge',place(0,0,.09),r*.12,.012,silver,24))
    for o in groups[part][rotor_start:]:
        o['rotor']=name+str(center); o['pivot']=center; o['rotorAxis']={'Z':'y','Y':'z','X':'x'}[axis]

mb= textured('Motherboard silkscreen','art/textures/pcb-laminate-v4.png',.12,.68)
pt= textured('PCVerse powder coated PSU','art/textures/psu-side-v2.png',.25,.6)
gf= textured('GPU machined metal','art/textures/gpu-metal-v3.png',.5,.42)
ct= textured('CPU laser etching','art/textures/cpu-ihs-v3.png',.55,.4)
rt= textured('PCVerse memory spreader','art/textures/ram-side-v2.png',.45,.4)
part='base'
box('Exhibit tray',(-1.525,0,-.32),(10.25,8.0,.25),white,.12)
box('Graphite edge',(-1.525,0,-.5),(10.05,7.8,.14),navy,.08)
for x in [-6.15,3.1]:
    for y in [-2.9,2.9]:cyl('Rubber foot',(x,y,-.6),.2,.12,black)
text('P C V / 0 2',(3.1,3.88,-.18),.16,navy).rotation_euler.z=math.pi
text('OPEN BENCH / HARDWARE ATLAS',(-1.3,3.88,-.18),.12,navy).rotation_euler.z=math.pi
part='board'
box('ATX motherboard',(0,0,0),(4.88,6.1,.13),pcb,.025)
top('PCB surface',0,0,.067,4.88,6.1,mb)
for x in [-2.2,2.2]:
    for y in [-2.8,-.85,2.8]:
        cyl('Standoff',(x,y,-.12),.065,.15,gold,12)
        cyl('Screw',(x,y,.085),.08,.025,silver)
        for angle in [0,math.pi/2]:
            o=box('Cross recess',(x,y,.101),(.108,.014,.008),black,0);o.rotation_euler.z=angle
box('AM5 socket',(0,1.1,.17),(1.48,1.65,.19),black)
box('Socket contact bed',(0,1.1,.245),(1.11,1.11,.045),black,.008)
# Open retention frame, not a photo containing a second motherboard.
for x in [-.66,.66]:box('Socket side rail',(x,1.1,.27),(.12,1.48,.065),silver,.015)
for y in [.40,1.80]:box('Socket end rail',(0,y,.27),(1.2,.12,.065),silver,.015)
for x in [-.62,.62]:
    for y in [.42,1.78]:
        cyl('Socket screw',(x,y,.312),.04,.022,black,12)
pin_vertices=[];pin_faces=[]
for i in range(28):
    for j in range(28):
        x=-.486+i*.036;y=.614+j*.036
        if abs(x)<.14 and abs(y-1.1)<.14:continue
        n=len(pin_vertices)
        pin_vertices.extend([(x+dx,y+dy,.276+dz) for dz in [-.0085,.0085] for dy in [-.0115,.0115] for dx in [-.0055,.0055]])
        pin_faces.extend([tuple(n+k for k in face) for face in [(0,2,3,1),(4,5,7,6),(0,1,5,4),(2,6,7,3),(0,4,6,2),(1,3,7,5)]])
pin_mesh=bpy.data.meshes.new('LGA spring array');pin_mesh.from_pydata(pin_vertices,[],pin_faces);pin_mesh.update()
pin_object=bpy.data.objects.new('LGA spring array',pin_mesh);bpy.context.collection.objects.link(pin_object);keep(pin_object,contact)
tube('Socket lever',[(.73,.3,.26),(.73,1.8,.26),(.65,1.9,.27)],.025,silver)
for y in [-.57,-1.95]:
    box('PCIe outer slot',(-.15,y,.16),(2.8,.18,.19),silver,.01)
    box('PCIe groove',(-.15,y,.255),(2.64,.07,.01),black,0)
    box('PCIe latch',(1.33,y,.24),(.19,.24,.18),black)
for x in [1.35,1.58,1.81,2.04]:
    box('DIMM slot',(x,1.25,.17),(.13,2.9,.2),black,.008)
    for y in [-.24,2.74]:box('DIMM retaining clip',(x,y,.25),(.16,.16,.22),silver,.015)
for x in [-1.85,-1.65,-1.45,-1.25,-1.05,-.85,-.65,-.45]:
    box('VRM fin',(x,2.40,.36),(.08,.45,.55),navy,.009)
# Rear I/O is constructed with recessed ports in atlas_details.py.
box('Chipset heatsink',(1.35,-2.61,.22),(1.18,.68,.3),navy)
for i in range(10):box('Chipset ribs',(.86+i*.11,-2.61,.39),(.035,.58,.04),silver,.004)
text('CHIPSET',(.91,-2.88,.418),.085,white)
box('ATX 24 pin',(2.27,.65,.23),(.23,1.07,.31),black,.014)
box('EPS 8 pin',(-.95,2.83,.20),(.50,.23,.25),black,.012)
text('CPU_PWR',(-1.23,2.59,.074),.074,white)
text('ATX_PWR',(1.8,.01,.074),.07,white)
part='cpu'
box('CPU substrate',(0,1.1,.315),(1.12,1.12,.055),pcb)
box('CPU heat spreader',(0,1.1,.37),(1.02,1.02,.065),silver,.045)
surface('CPU markings',[(-.51,.59,.404),(.51,.59,.404),(.51,1.61,.404),(-.51,1.61,.404)],ct,[(.21,.21),(.79,.21),(.79,.79),(.21,.79)])
part='cooler'
# Tower cooler: horizontal fin stack, U-shaped heatpipes rising through it and a 120 mm fan
# on the intake side. Air therefore flows between the fins towards the rear I/O.
FIN_DEPTH,FIN_WIDTH=.74,1.44
fin_edge=FIN_DEPTH/2
box('Thermal interface',(0,1.1,.41),(.84,.84,.012),silver,.01)
box('Copper contact base',(0,1.1,.455),(.8,.8,.08),gold,.012)
box('Heatpipe clamp block',(0,1.1,.56),(.9,.94,.13),silver,.02)
cooler_pipes=[(.80,.27),(.96,.13),(1.24,.27),(1.40,.13)]
for y,xa in cooler_pipes:
    cable('Heatpipe',[(-xa,y,2.44),(-xa,y,.9),(-xa,y,.68),(-xa*.45,y,.575),(xa*.45,y,.575),(xa,y,.68),(xa,y,.9),(xa,y,2.44)],.034,gold)
cooler_fins=[.9+i*.041 for i in range(38)]
for z in cooler_fins:box('Aluminium fin',(0,1.1,z),(FIN_DEPTH,FIN_WIDTH,.012),silver,.003)
box('Tower top cover',(0,1.1,2.47),(FIN_DEPTH+.06,FIN_WIDTH+.06,.06),navy,.02)
text('PCVERSE',(-.19,1.07,2.502),.07,white)
box('Mounting bridge',(0,1.1,.66),(1.76,.14,.06),silver,.015)
for x in [-.82,.82]:cyl('Bridge post',(x,1.1,.57),.04,.13,silver,16)
fan_x=fin_edge+.13
cpu_frame=box('Fan frame',(fan_x,1.1,1.66),(.22,1.5,1.5),navy,.04)
drill(cpu_frame,(fan_x,1.1,1.66),.7,.5,axis='X')
fan('CPU fan',(fan_x,1.1,1.66),.67,axis='X')
for y in [.43,1.77]:
    for z in [.99,2.33]:
        o=cyl('Fan anti-vibration pad',(fan_x+.117,y,z),.045,.018,black,16);o.rotation_euler.y=math.pi/2
    tube('Fan retention wire',[(fan_x+.12,y+(.03 if y<1 else -.03),2.33),(fan_x+.14,y,2.54),(fin_edge-.02,y,2.54),(fin_edge-.02,y,2.5)],.011,silver)
    tube('Fan retention wire',[(fan_x+.12,y+(.03 if y<1 else -.03),.99),(fan_x+.14,y,.87),(fin_edge-.02,y,.87),(fin_edge-.02,y,.885)],.011,silver)
box('Fan cable outlet',(fan_x,1.87,.98),(.1,.07,.08),black,.01)
part='ram'
for x in [1.58,2.04]:
    box('Memory PCB',(x,1.25,.61),(.06,2.68,.80),pcb,.008)
    box('RAM heat spreader',(x,1.25,.75),(.12,2.68,.64),navy,.025)
    for side in [-1,1]:
        xx=x+side*.062
        surface('Memory surface',[(xx,-.09,.43),(xx,2.59,.43),(xx,2.59,1.07),(xx,-.09,1.07)],rt)
    box('Copper top trim',(x,1.25,1.08),(.135,2.64,.028),gold,.007)
    for i in range(42):
        yy=-.035+i*.062
        if abs(yy-1.05)>.045:box('RAM contact',(x,yy,.245),(.065,.036,.10),gold,.001)
part='gpu'
# Card plane XZ is perpendicular to motherboard XY. PCIe fingers seat at Z=.21.
box('GPU PCB',(.35,-.57,1.42),(5.6,.06,2.15),pcb,.015)
back=box('Backplate',(.35,-.515,1.48),(5.6,.045,2.08),gf,.03)
project_gpu_uv(back)
for x in [-2.26,-.5,1.25,2.98]:
    for z in [.59,2.35]:
        o=cyl('Backplate screw',(x,-.48,z),.04,.025,silver,16);o.rotation_euler.x=math.pi/2
box('GPU heatsink contact plate',(.35,-.665,1.45),(5.5,.08,2.04),silver,.015)
for i in range(58):box('GPU cooling fin',(-2.35+i*.094,-.94,1.45),(.026,.50,1.99),silver,.003)
shroud=box('GPU machined fan frame',(.35,-1.21,1.45),(5.62,.15,2.13),gf,.045)
fan_centers=[-1.52,.35,2.22]
for x in fan_centers:
    drill(shroud,(x,-1.21,1.45),.867,.7)
    fan('GPU fan',(x,-1.245,1.45),.84,True)
project_gpu_uv(shroud)
for x in [-2.30,-.59,1.29,3.0]:
    for z in [.53,2.37]:
        o=cyl('Shroud fastener',(x,-1.298,z),.035,.025,silver,16);o.rotation_euler.x=math.pi/2
for y in [-1.19,-.60]:box('GPU top rail',(.35,y,2.52),(5.5,.075,.06),navy,.012)
box('GPU side nameplate',(-.40,-.94,2.54),(2.3,.39,.055),navy,.015)
text('P C V E R S E',(-1.36,-1.00,2.571),.19,white)
for x in [-1.65,-.8,.15,.95,2.4]:
    cable('GPU copper heatpipe',[(x,-1.08,.52),(x,-.95,.40),(x,-.73,.51),(x,-.72,2.42)],.033,gold)
# PCIe key interrupts the contacts; only the connector enters the slot.
box('PCIe connector substrate',(-.15,-.57,.285),(2.54,.062,.27),pcb,.004)
for i in range(42):
    x=-1.38+i*.06
    if abs(x+.93)>.035:box('PCIe gold finger',(x,-.57,.245),(.035,.068,.14),gold,.001)
box('Rear expansion bracket',(-2.50,-.9,1.41),(.065,.85,2.42),silver,.015)
for z in [.65,1.1,1.55,2.0]:box('Display output',(-2.54,-.91,z),(.045,.15,.34),black,.012)
for x in [1.46,1.88]:
    box('GPU 8 pin housing',(x,-.76,2.56),(.36,.27,.19),black,.015)
    for i in range(4):
        for j in range(2):
            box('GPU power pin opening',(x-.126+i*.084,-.82+j*.12,2.659),(.057,.078,.009),sleeve,.005)
            box('GPU power pin',(x-.126+i*.084,-.82+j*.12,2.663),(.019,.025,.01),gold,.001)
    box('GPU plug latch',(x,-.59,2.56),(.12,.07,.09),nylon,.012)
part='ssd'
box('NVMe PCB',(-.2,-1.43,.18),(1.78,.48,.055),pcb,.008)
surface('SSD solder mask',[(-1.09,-1.67,.211),(.69,-1.67,.211),(.69,-1.19,.211),(-1.09,-1.19,.211)],mb,[(.2,.2),(.56,.2),(.56,.28),(.2,.28)])
part='board'
box('M2 socket',(.74,-1.43,.20),(.12,.51,.13),black)
part='ssd'
cyl('M2 securing screw',(-1.04,-1.43,.23),.055,.035,silver,16)
part='psu'
psu_shell=box('PSU steel enclosure',(-4.22,.35,.72),(2.6,3.0,1.8),navy,.07)
drill(psu_shell,(-4.22,.35,1.64),1.06,.35,axis='Z')
surface('PSU side label',[(-5.5,-1.153,-.15),(-2.94,-1.153,-.15),(-2.94,-1.153,1.59),(-5.5,-1.153,1.59)],pt)
surface('PSU side label',[(-2.94,1.853,-.15),(-5.5,1.853,-.15),(-5.5,1.853,1.59),(-2.94,1.853,1.59)],pt)
fan('PSU fan',(-4.22,.35,1.51),1.05)
for radius in [.25,.43,.61,.79,.97,1.07]:ring('PSU wire grille',(-4.22,.35,1.655),radius,.014,navy)
for a in [math.pi/4,-math.pi/4]:
    o=box('Grille brace',(-4.22,.35,1.635),(2.18,.032,.028),silver,.009);o.rotation_euler.z=a
for a in [math.pi/4,3*math.pi/4,5*math.pi/4,7*math.pi/4]:
    cyl('Grille mounting boss',(-4.22+1.07*math.cos(a),.35+1.07*math.sin(a),1.636),.035,.035,silver,16)
for x in [-5.38,-3.06]:
    for y in [-.99,1.69]:
        cyl('PSU screw',(x,y,1.63),.045,.03,silver,16)
        for angle in [0,math.pi/2]:
            o=box('Cross recess',(x,y,1.646),(.062,.009,.006),black,0);o.rotation_euler.z=angle
box('PSU rating',(-4.22,-.93,1.63),(1.4,.27,.025),black)
text('PCV / 650 W',(-4.72,-.99,1.65),.14,white)
box('ATX PSU modular socket',(-2.90,-.50,.82),(.12,.77,.31),black,.02)
box('EPS PSU modular socket',(-2.90,1.15,.82),(.12,.38,.28),black,.02)
for count,cy,pitch in [(12,-.50,.055),(4,1.15,.07)]:
    for i in range(count):
        for z in [.76,.88]:
            box('PSU socket chamber',(-2.836,cy+(i-(count-1)/2)*pitch,z),(.008,.038,.058),sleeve,.003)
# Two separate sleeved harnesses. Their hosts do not move in exploded view.
# Each has its own plugs, latch, strain relief and combs. PSU/MB use no false printed plugs.
# Separate harness roots let the assembly mode connect each plug on its own.
part='wiringAtx'
box('ATX PSU plug',(-3.53,-.50,.82),(.24,.70,.27),nylon,.018)
box('ATX board plug',(-2.27,-.65,.48),(.25,1.04,.26),nylon,.018)
box('ATX locking tab',(-2.42,-.65,.43),(.065,.24,.16),black,.008)
for i in range(12):
    d=(i-5.5)*.045
    for layer in [-1,1]:
        dz=layer*.026
        cable('ATX 24 sleeved wire',[
            (-3.41,-.50+d,.82+dz),(-3.14,-.54+d,1.04+dz),
            (-2.73,-.65+d*1.7,1.09+dz),(-2.27+dz,-.65+d*1.7,.84),
            (-2.27+dz,-.65+d*1.7,.61)],.021,sleeve)
box('ATX cable comb',(-2.73,-.65,1.09),(.075,.96,.12),navy,.018)
part='wiringEps'
box('EPS PSU plug',(-3.53,1.15,.82),(.24,.34,.24),nylon,.018)
box('EPS board plug',(.95,-2.83,.39),(.49,.25,.18),nylon,.015)
box('EPS locking tab',(.95,-2.66,.35),(.16,.055,.11),black,.008)
for i in range(4):
    d=(i-1.5)*.06
    for layer in [-1,1]:
        dz=layer*.028
        cable('EPS 8 sleeved wire',[
            (-3.41,1.15+d,.82+dz),(-3.34,1.55+d,.54+dz),(-3.34,.35+d,.14+dz),
            (-3.34,-2.80+d,.14+dz),(-2.90,-3.40+d,.14+dz),(.35,-3.40+d,.23+dz),
            (.95+d,-3.27,.56+dz),(.95+d,-3.08,.62+dz),(.95+d,-2.83+dz,.48)],.024,sleeve)
box('EPS cable comb',(-1.70,-3.40,.16),(.07,.28,.13),navy,.012)
part='base'
text('CPU / EPS',(-1.9,-3.72,-.175),.09,white)
# Deterministic assembly checks run before export; a regression must fail the build.
assert -2.61+.68/2 < -1.95-.18/2, 'Chipset must clear the second PCIe slot'
assert 2.40+.45/2 < 2.83-.25/2, 'VRM fins must clear the EPS plug'
assert min(b-a for a,b in zip(fan_centers,fan_centers[1:])) > .867*2, 'GPU fan openings overlap'
assert fan_centers[0]-.867 > -2.46 and fan_centers[-1]+.867 < 3.16, 'GPU fan openings leave the shroud'
assert abs((.37+.065/2)-(.41-.012/2)) < .002, 'Cooler must meet CPU heat spreader'
assert all(abs(y-1.1)-.034 > .07 for y,_ in cooler_pipes), 'Heatpipes must clear the mounting bridge'
assert max(x for _,x in cooler_pipes)+.034 < fin_edge-.05, 'Heatpipes must stay inside the fin stack depth'
assert fan_x-.11 > fin_edge and fan_x+.11 < 1.58-.06-.3, 'Tower fan sits between fins and the first DIMM with finger room'
assert cooler_fins[0]-.006 > .625 and cooler_fins[-1]+.006 < 2.44, 'Fin stack between clamp and cover'
# Shared deterministic material maps and detailed geometry.
exec(compile(open(os.path.join(ROOT,'scripts','atlas_details.py'),encoding='utf-8').read(),'atlas_details.py','exec'))
# Merge static geometry by material, retain independently pivoted fan rotors.
for key,objects in groups.items():
    parent=bpy.data.objects.new(key,None); bpy.context.collection.objects.link(parent)
    batches={}
    rotors={}
    for o in objects:batches.setdefault((o.data.materials[0],o.get('rotor','')),[]).append(o)
    for (mat,rotor),batch in batches.items():
        target=parent
        if rotor:
            if rotor not in rotors:
                target=bpy.data.objects.new('rotor_'+str(len(rotors)),None);bpy.context.collection.objects.link(target)
                target.parent=parent;target.location=batch[0]['pivot'];target['rotorAxis']=batch[0]['rotorAxis']
                rotors[rotor]=target
            target=rotors[rotor]
        bpy.ops.object.select_all(action='DESELECT')
        for o in batch:o.select_set(True)
        bpy.context.view_layer.objects.active=batch[0]
        if len(batch)>1:bpy.ops.object.join()
        o=bpy.context.object;o.name=key+'_'+mat.name
        world=o.matrix_world.copy();o.parent=target;o.matrix_world=world
os.makedirs(os.path.join(ROOT,'public','models'),exist_ok=True)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.outliner.orphans_purge(do_recursive=True)
exec(compile(open(os.path.join(ROOT,'scripts','finish_atlas.py'),encoding='utf-8').read(),'finish_atlas.py','exec'))
print('ATLAS_EXPORT_COMPLETE / GPU perpendicular; PCIe contacts Z=.175..315; CPU surface .404 / cooler interface .404')

