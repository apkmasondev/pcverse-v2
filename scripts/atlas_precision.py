"""Real panel details and physically scaled surface UVs, before material batching."""

# SSD has its own solder-mask artwork, independent of motherboard contact AO.

part='psu'
# Real slits cut through both side walls. Text is geometry and has no baked light.
for side in [-1,1]:
    y=.35+side*1.5
    for i in range(9):cut(psu_shell,(-5.18+i*.07,y,.75),(.029,.19,1.14))
    for x in [-5.36,-3.08]:
        for z in [.02,1.44]:
            o=cyl('PSU panel screw seat',(x,y+side*.006,z),.052,.012,black,20);o.rotation_euler.x=math.pi/2
            o=cyl('PSU panel screw',(x,y+side*.010,z),.033,.014,silver,16);o.rotation_euler.x=math.pi/2
            for angle in [0,math.pi/2]:
                o=box('PSU panel screw drive',(x,y+side*.019,z),(.047,.003,.009),black,0);o.rotation_euler.y=angle
    # Real folded lid joint, on the enclosure rather than painted into the albedo.
    box('PSU lid joint',(-4.22,y+side*.001,1.36),(2.40,.004,.012),black,.001)
    def side_text(body,x,z,size,mat=white):
        o=text(body,(x,y+side*.005,z),size,mat)
        o.rotation_euler=(math.pi/2,0,0 if side<0 else math.pi)
        return o
    side_text('PCVERSE',-4.48 if side<0 else -3.10,.96,.19)
    side_text('650 W',-4.48 if side<0 else -3.10,.63,.28)
    side_text('MODULAR / ATX',-4.46 if side<0 else -3.12,.43,.065)
    side_text('DC OUTPUT  /  +12V',-4.46 if side<0 else -3.12,.30,.046,ink)
    box('PSU accent rule',(-3.82,y+side*.007,.23),(1.25,.008,.012),gold,.001)

part='gpu'
# The backplate is a stamped panel with shallow ribs and recessed screw seats.
# Keep the same outer envelope and connector positions for the existing harness.
for x in [-2.26,-.5,1.25,2.98]:
    for z in [.59,2.35]:
        drill(back,(x,-.494,z),.062,.022,axis='Y',sides=20)
        o=cyl('Backplate screw seat',(x,-.498,z),.056,.010,black,20);o.rotation_euler.x=math.pi/2
        for angle in [0,math.pi/2]:
            o=box('Backplate screw drive',(x,-.481,z),(.054,.003,.01),black,0);o.rotation_euler.y=angle
for x in [-2.0,-1.81,2.54,2.73]:
    o=box('Backplate pressed rib',(x,-.482,1.46),(.033,.027,1.35),gf,.011)
    o.rotation_euler.y=-.24 if x<0 else .24
o=text('PCVERSE',(.90,-.486,1.67),.19,ink);o.rotation_euler=(math.pi/2,0,math.pi)
o=text('GRAPHICS / PCIE',(.88,-.486,1.46),.068,ink);o.rotation_euler=(math.pi/2,0,math.pi)
o=text('01  /  PERFORMANCE',(.88,-.486,1.29),.047,ink);o.rotation_euler=(math.pi/2,0,math.pi)
# Thin stepped rails add silhouette and catch reflections without moving fan rims.
for z in [.435,2.465]:
    box('Shroud folded edge',(.35,-1.291,z),(5.40,.038,.045),navy,.012)
for x in [-.585,1.285]:
    for z in [.54,2.36]:
        web=box('Shroud raised web',(x,-1.294,z),(.16,.024,.16),navy,.018)
        drill(web,(x,-1.30,z),.043,.08,axis='Y',sides=20)
for x in [-2.30,-.59,1.29,3.0]:
    for z in [.53,2.37]:
        for angle in [0,math.pi/2]:
            o=box('Shroud screw drive',(x,-1.312,z),(.045,.003,.008),black,0);o.rotation_euler.y=angle

# Secondary UVs: one microstructure tile per exhibition unit, independent of
# label artwork and mesh size. Principal-axis projection preserves brush direction.
bpy.context.view_layer.update()
for objects in groups.values():
    for obj in objects:
        if obj.type!='MESH':continue
        if not obj.data.uv_layers:obj.data.uv_layers.new(name='Artwork')
        layer=obj.data.uv_layers.new(name='Microstructure')
        transform=obj.matrix_world
        normal_transform=transform.to_3x3().inverted().transposed()
        for poly in obj.data.polygons:
            normal=normal_transform @ poly.normal
            axis=max(range(3),key=lambda i:abs(normal[i]))
            for index in poly.loop_indices:
                p=transform @ obj.data.vertices[obj.data.loops[index].vertex_index].co
                layer.data[index].uv=(p.y,p.z) if axis==0 else (p.x,p.z) if axis==1 else (p.x,p.y)
        obj.data.uv_layers.active_index=0

# CPU_FAN and SYS_FAN are single-row 4-pin headers; USB/F_PANEL stay dual-row.
for label in ['CPU_FAN','SYS_FAN']:
    assert sum(o.name.split('.')[0]==label+' pin' for o in groups['board'])==4
assert not any(' cavity' in o.name for objects in groups.values() for o in objects if 'fan' in o.name.lower())
