"""Final export/optimization, also runnable against the saved atlas.blend."""
import bpy, os, math
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Connector finishing is idempotent and can be run on the saved model directly.
plug_root=bpy.data.objects.get('gpuWiring')
assert plug_root is not None, 'Rebuild the model with build_atlas.py before finishing connectors'
if plug_root and not plug_root.get('connector_finish'):
    batches={}
    def plug_box(name,loc,size,mat):
        bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
        o=bpy.context.object;o.name=name;o.dimensions=size
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        bevel=o.modifiers.new('Connector moulding','BEVEL');bevel.width=.006;bevel.segments=2
        bpy.ops.object.modifier_apply(modifier=bevel.name)
        o.data.materials.append(bpy.data.materials[mat]);o.parent=plug_root
        batches.setdefault(mat,[]).append(o)
    for x in [1.46,1.88]:
        plug_box('PCIe plug locking arm',(x,-.565,2.77),(.13,.065,.23),'Fan satin polymer')
        plug_box('PCIe latch hook',(x,-.593,2.662),(.13,.095,.045),'Fan satin polymer')
        for j in range(3):
            plug_box('Connector grip rib',(x,-.901,2.71+j*.055),(.27,.025,.016),'Graphite enamel')
        for i in range(8):
            xx=x+(i%4-1.5)*.065;yy=-.76+(-.035 if i<4 else .035)
            plug_box('Individual wire boot',(xx,yy,2.924),(.052,.055,.077),'Ceramic')
    for mat,objects in batches.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join()
        bpy.context.object.name='gpu_plug_'+mat
    plug_root['connector_finish']=True
# Colour maps tolerate high-quality JPEG. Normal/roughness maps stay PNG.
for img in bpy.data.images:
    if img.colorspace_settings.name == 'sRGB' and img.source == 'FILE':
        img.filepath_raw=os.path.join(ROOT,'art','textures',os.path.splitext(os.path.basename(img.filepath_raw))[0]+'.jpg')
# Font outlines are otherwise disproportionately dense for submillimetre labels.
for obj in bpy.data.objects:
    if obj.type=='MESH' and ('silkscreen' in obj.name or 'Porcelain' in obj.name):
        mod=obj.modifiers.new('Planar lettering optimization','DECIMATE')
        mod.decimate_type='DISSOLVE';mod.angle_limit=math.radians(1)
        bpy.context.view_layer.objects.active=obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
    if obj.type=='MESH' and 'Warm white silkscreen' in obj.name and not obj.get('lettering_optimized'):
        mod=obj.modifiers.new('Subpixel type contours','DECIMATE');mod.ratio=.55
        bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=mod.name)
        obj['lettering_optimized']=True
    if obj.type=='MESH' and obj.name=='psu_Porcelain' and not obj.get('label_optimized'):
        # Small enclosure lettering needs legible contours, not dense font tessellation.
        mod=obj.modifiers.new('Enclosure label contours','DECIMATE');mod.ratio=.50
        bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=mod.name)
        obj['label_optimized']=True
# Rotate the installed board assembly as one unit. Roots stay at the origin:
# the web scene applies disassembly translations to them every frame.
# PSU translation is baked into its children (including the rotor pivot).
for name in ['board','cpu','cooler','gpu','gpuWiring','ram','ssd','wiringFan']:
    bpy.data.objects[name].rotation_euler.z=math.pi
for name in ['psu','wiringPcie']:
    root=bpy.data.objects[name]
    if not root.get('outward_io_layout'):
        for child in root.children:child.location.x-=.75
        root['outward_io_layout']=True
bpy.context.view_layer.update()
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'art','atlas.blend'))
# Raw export; `npm run model:optimize` writes the compressed public/models/atlas.glb.
os.makedirs(os.path.join(ROOT,'art','export'),exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT,'art','export','atlas.raw.glb'),export_format='GLB',export_yup=True,export_image_format='AUTO',export_jpeg_quality=90,export_extras=True)
