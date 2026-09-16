"""Deterministic manufacturing details. Executed by build_atlas.py before batching.
All coordinates here are Blender Z-up. Reusable PBR maps are mathematical
material microstructure, independent of the AI-generated PCB base colour.
"""
import numpy as np

def micro_material(mat, kind, strength=.12):
    size=256
    yy,xx=np.mgrid[0:size,0:size]
    rng=np.random.default_rng(42)
    grain=rng.random((size,size))
    if kind=='brushed': height=.5+.17*np.sin(yy*1.7)+.10*grain
    elif kind=='woven': height=.5+.18*np.sin((xx+yy)*.5)*np.sin((xx-yy)*.5)+.04*grain
    else: height=.5+.11*grain
    dx=(np.roll(height,-1,1)-np.roll(height,1,1))*strength
    dy=(np.roll(height,-1,0)-np.roll(height,1,0))*strength
    normal=np.stack([-dx,-dy,np.ones_like(dx)],axis=-1)
    normal/=np.linalg.norm(normal,axis=-1,keepdims=True)
    rgba=np.ones((size,size,4),dtype=np.float32);rgba[:,:,:3]=normal*.5+.5
    def bitmap(suffix,pixels):
        img=bpy.data.images.new(kind+suffix,width=size,height=size,alpha=False)
        img.colorspace_settings.name='Non-Color';img.pixels.foreach_set(pixels.ravel());img.pack()
        return img
    nodes=mat.node_tree.nodes;links=mat.node_tree.links;p=nodes.get('Principled BSDF')
    tex=nodes.new('ShaderNodeTexImage');tex.image=bitmap(' normal',rgba)
    n=nodes.new('ShaderNodeNormalMap');links.new(tex.outputs['Color'],n.inputs['Color']);links.new(n.outputs['Normal'],p.inputs['Normal'])
    rough=p.inputs['Roughness'].default_value
    rgba[:,:,:3]=np.clip(rough+(grain[:,:,None]-.5)*.14,.08,.98)
    tex=nodes.new('ShaderNodeTexImage');tex.image=bitmap(' roughness',rgba)
    links.new(tex.outputs['Color'],p.inputs['Roughness'])

for mat,kind,strength in [(silver,'brushed',.28),(gold,'brushed',.15),(navy,'powder',.5),(nylon,'polymer',.28),(black,'polymer',.22),(sleeve,'woven',.7),(pcb,'laminate',.18),(mb,'laminate',.16),(gf,'brushed',.2),(pt,'powder',.25),(rt,'brushed',.18),(ct,'brushed',.14)]:
    micro_material(mat,kind,strength)

ink=material('Warm white silkscreen',(.52,.58,.55),0,.85)
chip=material('Moulded silicon packages',(.018,.022,.024),.04,.8)
blue=material('USB blue insert',(.015,.13,.3),0,.52)
tan=material('Ceramic capacitor body',(.24,.16,.095),0,.78)

def smd(x,y,z=.105,scale=1):
    box('SMD ceramic',(x,y,z),(.072*scale,.036*scale,.033*scale),tan,.002)
    for d in [-1,1]:box('Solder termination',(x+d*.039*scale,y,z),(.014*scale,.041*scale,.035*scale),silver,0)

def screw(x,y,z,r=.038):
    cyl('Machined screw',(x,y,z),r,.026,silver,12)
    for angle in [0,math.pi/2]:
        o=box('Cross recess',(x,y,z+.014),(r*1.35,.012,.003),black,0);o.rotation_euler.z=angle

def header(label,x,y,cols=4):
    box(label+' housing',(x,y,.135),(cols*.085+.06,.19,.12),black,.008)
    for i in range(cols):
        for j in [-1,1]:box(label+' pin',(x+(i-(cols-1)/2)*.085,y+j*.045,.23),(.024,.024,.16),gold,.002)
    text(label,(x-cols*.043,y-.22,.075),.06,ink)

part='board'
# A second VRM heatsink fills the channel between rear I/O and the power stages.
box('VRM side heat spreader',(-1.63,1.16,.27),(.40,1.64,.32),navy,.025)
for x in [-1.78,-1.68,-1.58,-1.48]:
    box('VRM side cooling fin',(x,1.16,.51),(.045,1.56,.22),silver,.007)
# Rear IO metal housings, recessed insulators, individual contacts and latches.
for y in [.25,.79,1.33]:
    box('USB stack housing',(-2.15,y,.39),(.56,.45,.58),silver,.018)
    for z in [.25,.51]:
        box('USB black recessed opening',(-2.436,y,z),(.014,.36,.17),black,.009)
        box('USB 3 tongue',(-2.447,y,z-.027),(.021,.29,.035),blue,.004)
        for i in range(4):box('USB contact',(-2.46,y-.105+i*.07,z-.003),(.008,.022,.015),gold,0)
box('RJ45 shield',(-2.15,1.91,.42),(.56,.49,.64),silver,.018)
box('RJ45 cavity',(-2.438,1.91,.44),(.016,.38,.39),black,.008)
box('RJ45 latch notch',(-2.449,1.91,.21),(.01,.16,.08),black,0)
for i in range(8):box('RJ45 spring',(-2.452,1.785+i*.035,.55),(.012,.014,.12),gold,.002)
for y in [1.72,2.1]:box('Link indicator',(-2.457,y,.66),(.012,.055,.027),trace,.003)
for y in [-.13,-.37]:
    o=cyl('Audio jack collar',(-2.448,y,.31),.088,.025,silver,24);o.rotation_euler.y=math.pi/2
    o=cyl('Audio jack bore',(-2.464,y,.31),.057,.008,black,24);o.rotation_euler.y=math.pi/2
    box('Audio jack body',(-2.13,y,.25),(.54,.18,.27),black,.01)

# Capacitors and chokes occupy explicit free regions, never the PCIe keep-outs.
for x,y in [(-1.02,.52),(-1.02,.87),(-1.02,1.22),(-1.02,1.57),(-1.02,1.92),(-1.65,2.03),(-1.28,2.03),(-.90,2.03),(-.52,2.03)]:
    box('VRM ferrite choke',(x,y,.205),(.23,.25,.26),navy,.015)
    text('R22',(x-.077,y-.028,.337),.064,ink)
    cyl('Solid polymer capacitor',(x-.19,y,.21),.065,.28,black,16)
    cyl('Capacitor aluminium cap',(x-.19,y,.353),.060,.012,silver,16)
    smd(x+.15,y)
for x in [-1.86,-1.66,-1.46]:
    for y in [-2.42,-2.7]:
        cyl('Audio capacitor',(x,y,.19),.063,.23,black,16)
        cyl('Audio capacitor cap',(x,y,.31),.059,.01,gold,16)
cyl('CMOS cell holder',(-1.72,-1.19,.145),.255,.14,black,40)
cyl('CR2032 cell',(-1.72,-1.19,.219),.222,.035,silver,40)
text('+',(-1.82,-1.28,.24),.16,ink)
text('CR2032',(-1.86,-1.16,.24),.056,ink)
box('Battery spring',(-1.49,-1.19,.24),(.09,.08,.04),silver,.008)
for x,y in [(-.9,-2.46),(.02,-2.55),(.75,-.94)]:
    box('Board controller',(x,y,.12),(.32,.29,.07),chip,.009)
    for side in [-1,1]:
        for i in range(7):box('Controller gullwing lead',(x-.12+i*.04,y+side*.17,.10),(.018,.075,.03),silver,.002)
    for i in range(4):smd(x-.13+i*.085,y-.27)
header('USB_2',-.32,-2.88,5)
header('F_PANEL',.48,-2.88,5)
header('CPU_FAN',.72,2.43,4)
header('SYS_FAN',2.22,-2.53,3)
for y in [-1.18,-1.58]:
    box('SATA right angle header',(2.16,y,.18),(.43,.30,.22),black,.015)
    box('SATA port cavity',(2.382,y,.18),(.012,.22,.115),sleeve,.004)
    for i in range(7):box('SATA pin',(2.391,y-.08+i*.027,.18),(.009,.012,.052),gold,0)
text('PCVERSE  /  ATX',(-.89,-2.24,.078),.11,ink)
text('DDR5',(.97,2.77,.078),.085,ink)
text('PCIe  x16',(-1.34,-.79,.078),.075,ink)
text('M.2  /  NVMe',(-.83,-1.79,.078),.073,ink)
for x in [-.82,.82]:
    for y in [.38,1.82]:
        cyl('Cooler mounting standoff',(x,y,.22),.072,.30,black,16)
        screw(x,y,.385)
# Underside is inspectable: solder pads, retention backplate, traces.
bottom=top('PCB underside',0,0,-.067,4.88,6.1,mb)
for p in bottom.data.polygons:p.flip()
box('Socket steel backplate',(0,1.1,-.12),(1.82,1.77,.08),navy,.1)
for x in [-.82,.82]:
    for y in [.38,1.82]:screw(x,y,-.171)
for x in [1.35,1.58,1.81,2.04]:
    for i in range(28):cyl('DIMM solder pad',(x,.03+i*.086,-.075),.018,.006,silver,8)

part='ssd'
for x in [-.72,-.22]:
    box('NAND flash package',(x,-1.43,.259),(.40,.34,.092),chip,.008)
    text('PCV NAND',(x-.17,-1.45,.307),.05,ink)
    text('256G  TLC',(x-.16,-1.53,.307),.036,ink)
box('NVMe controller',(.24,-1.43,.255),(.28,.29,.084),chip,.008)
text('PCV',(.14,-1.43,.299),.065,ink)
text('CTRL',(.14,-1.51,.299),.047,ink)
for x in [-.89,-.61,-.32,-.03,.24,.47]:
    for y in [-1.635,-1.22]:smd(x,y,.24,.6)
for i in range(17):
    y=-1.639+i*.025
    if i not in [4,5]:box('M2 gold contact',(.633,y,.214),(.105,.016,.014),gold,.001)
screw(-1.04,-1.43,.25,.049)
for x in [-.65,-.05]:box('Underside NAND',(x,-1.43,.132),(.4,.32,.04),chip,.006)

part='cpu'
for i in range(24):
    for j in range(24):
        if 8<i<15 and 8<j<15:continue
        cyl('CPU land pad',(-.49+i*.042,.61+j*.042,.283),.012,.006,gold,8)
for x in [-.09,0,.09]:
    for y in [1.01,1.1,1.19]:smd(x,y,.278,.65)

part='cooler'
for x in [-.82,.82]:
    box('Cooler retention arm',(x,1.1,.48),(.12,1.52,.07),silver,.018)
    for y in [.38,1.82]:
        cyl('Spring mounting screw',(x,y,.52),.045,.26,silver,16)
        for i in range(5):ring('Retention spring',(x,y,.43+i*.032),.06,.010,silver)
        screw(x,y,.66,.06)

part='gpu'
# Port shells face the bracket exterior; DP has a single clipped corner.
for index,z in enumerate([.65,1.1,1.55,2.0]):
    yy=-.91;hh=.085;ww=.19
    outline=[(-ww,-hh),(ww,-hh),(ww,hh),(-ww+.06,hh),(-ww,hh-.045)] if index else [(-ww+.05,-hh),(ww-.05,-hh),(ww,hh),(-ww,hh)]
    tube('DisplayPort shell' if index else 'HDMI shell',[(-2.576,yy-b,z+a) for a,b in outline+[outline[0]]],.016,silver)
    box('Display output tongue',(-2.571,yy,z),(.016,.028,.25),nylon,.004)
    for i in range(9):box('Display contact',(-2.582,yy-.018,z-.1+i*.025),(.005,.013,.011),gold,0)
for z in [.42,.88,1.33,1.78,2.24]:
    for y in [-1.15,-.67]:box('Bracket ventilation slot',(-2.539,y,z),(.008,.095,.065),black,.008)
part='gpuWiring'
for x in [1.46,1.88]:
    box('GPU connected 8 pin plug',(x,-.76,2.76),(.35,.26,.23),nylon,.018)
    box('GPU cable strain relief',(x,-.76,2.884),(.29,.21,.05),black,.01)
# Support arm rests on the bench without intersecting fans.
part='base'
box('GPU support foot',(2.82,-.70,-.125),(.32,.48,.14),navy,.025)
cyl('GPU support post',(2.82,-.70,.145),.055,.40,silver,16)
box('GPU rubber saddle',(2.82,-.70,.37),(.29,.22,.07),black,.012)

part='psu'
for y in [.03,.44]:box('PCIe PSU modular socket',(-2.90,y,.40),(.13,.33,.27),black,.018)
# ATX layout: modular sockets face the board (+X), so the rear wall is the opposite -X face.
# It carries the recessed IEC inlet, rocker switch, perforated exhaust and four mounting screws.
PSU_BACK=-5.52
box('IEC inlet flange',(PSU_BACK-.023,1.2,.52),(.045,.77,.61),black,.04)
box('IEC recessed opening',(PSU_BACK-.049,1.2,.52),(.012,.59,.41),sleeve,.045)
for y,z in [(1.02,.48),(1.38,.48),(1.2,.65)]:box('IEC earth and mains pin',(PSU_BACK-.06,y,z),(.09,.055,.12),silver,.009)
box('Power rocker bezel',(PSU_BACK-.033,.55,.52),(.055,.35,.5),black,.025)
o=box('Power rocker',(PSU_BACK-.071,.55,.52),(.075,.25,.36),nylon,.02);o.rotation_euler.y=-.13
box('Power on mark',(PSU_BACK-.118,.55,.61),(.003,.016,.07),ink,.001)
# Real perforated grille built from a shallow panel with repeated openings.
vent=box('PSU rear ventilation',(PSU_BACK-.023,-.45,.75),(.025,1.1,1.34),silver,.015)
for y in [-.85,-.65,-.45,-.25,-.05]:
    for z in [.22,.40,.58,.76,.94,1.12,1.30]:drill(vent,(PSU_BACK-.025,y,z),.059,.10,axis='X')
for y in [-.98,1.68]:
    for z in [-.03,1.47]:
        o=cyl('PSU rear mounting screw',(PSU_BACK-.012,y,z),.045,.025,silver,16);o.rotation_euler.y=math.pi/2
part='wiringPcie'
for y in [.03,.44]:box('PCIe PSU cable plug',(-2.77,y,.40),(.23,.29,.23),nylon,.015)
part='wiringFan'
box('CPU fan cable plug',(.72,2.43,.28),(.34,.16,.17),nylon,.012)

# PBR non-colour maps must remain lossless in glTF; export AUTO preserves PNG.
assert len([o for objects in groups.values() for o in objects if o.get('rotor')])==55
