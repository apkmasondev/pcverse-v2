"""Detailed PCB laminate with contact occlusion aligned to the geometry.

The etched laminate artwork contains no fake components or sockets.
The AO map is deterministic; fixed board components alone cast baked
contact occlusion, so removed CPU/RAM/GPU parts never leave painted shadows.
Executed inside build_atlas.py after the geometry/material helpers.
"""
import numpy as np

def packed_bitmap(name, pixels, colour=False):
    h,w=pixels.shape[:2]
    rgba=np.ones((h,w,4),dtype=np.float32)
    rgba[:,:,:3]=pixels[:,:,None] if pixels.ndim==2 else pixels
    img=bpy.data.images.new(name,width=w,height=h,alpha=False)
    img.colorspace_settings.name='sRGB' if colour else 'Non-Color'
    img.pixels.foreach_set(rgba.ravel())
    img.filepath_raw=os.path.join(ROOT,'art','textures',name+'.png')
    img.file_format='PNG';img.save();img.pack()
    return img

def board_material():
    w,h=1024,1280
    yy,xx=np.mgrid[0:h,0:w]
    xx=(xx+.5)/w*4.88-2.44;yy=(yy+.5)/h*6.1-3.05
    # Broad, soft contact falloff from fixed packages. The AO map is independent
    # of albedo and only modulates indirect illumination in the renderer.
    occlusion=np.ones((h,w),np.float32)
    footprints=[(0,1.1,1.48,1.65),(-1.63,1.16,.4,1.64),(1.35,-2.61,1.18,.68)]
    footprints += [(x,1.25,.13,2.9) for x in [1.35,1.58,1.81,2.04]]
    footprints += [(-.15,y,2.8,.18) for y in [-.57,-1.95]]
    footprints += [(-2.15,y,.56,.45) for y in [.25,.79,1.33,1.91,2.45]]
    footprints += [(x,y,.32,.29) for x,y in [(-.9,-2.46),(.02,-2.55),(.75,-.94)]]
    for x,y,sx,sy in footprints:
        d=np.hypot(np.maximum(np.abs(xx-x)-sx/2,0),np.maximum(np.abs(yy-y)-sy/2,0))
        occlusion=np.minimum(occlusion,1-.30*np.exp(-d/.035))
    mat=material('Motherboard silkscreen',(1,1,1),0,.68)
    nodes=mat.node_tree.nodes;links=mat.node_tree.links;p=nodes.get('Principled BSDF')
    # Restore the detailed, component-free laminate artwork. Its vias and etched
    # tracks remain visible at normal viewing distance; all sockets stay 3D.
    tex=nodes.new('ShaderNodeTexImage')
    tex.image=bpy.data.images.load(os.path.join(ROOT,'art','textures','pcb-laminate-v4.png'),check_existing=True)
    tex.image.pack()
    links.new(tex.outputs['Color'],p.inputs['Base Color'])
    group=bpy.data.node_groups.new('glTF Material Output','ShaderNodeTree')
    group.interface.new_socket(name='Occlusion',in_out='INPUT',socket_type='NodeSocketFloat')
    out=nodes.new('ShaderNodeGroup');out.node_tree=group
    tex=nodes.new('ShaderNodeTexImage');tex.image=packed_bitmap('pcb-contact-ao-v5',occlusion)
    links.new(tex.outputs['Color'],out.inputs['Occlusion'])
    return mat
