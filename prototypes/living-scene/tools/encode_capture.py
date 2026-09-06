"""Encode genuine Chrome screencast frames; Blender's bundled FFmpeg is used offline.
blender -b --python encode_capture.py -- CAPTURE_DIR OUTPUT.mp4
No synthetic frames or UI reconstruction; nearest preceding captured frame by timestamp.
"""
import bpy,sys,json,math
from pathlib import Path
args=sys.argv[sys.argv.index('--')+1:]
source=Path(args[0]);output=Path(args[1]);frames=json.loads((source/'timestamps.json').read_text())
scene=bpy.context.scene
scene.render.engine='BLENDER_WORKBENCH'
scene.render.resolution_x=1600;scene.render.resolution_y=900;scene.render.resolution_percentage=100
scene.render.fps=15;scene.render.image_settings.file_format='FFMPEG'
scene.render.ffmpeg.format='MPEG4';scene.render.ffmpeg.codec='H264';scene.render.ffmpeg.constant_rate_factor='HIGH';scene.render.ffmpeg.ffmpeg_preset='GOOD'
scene.render.filepath=str(output);scene.render.use_sequencer=True
scene.view_settings.view_transform='Standard';scene.view_settings.look='None'
editor=scene.sequence_editor_create()
start=frames[0]['timestamp'];duration=frames[-1]['timestamp']-start
scene.frame_start=1;scene.frame_end=math.ceil(duration*15)
# Optional actual Web Audio capture from the same browser tour; preserve its measured offset.
if len(args)>2:
    audio=Path(args[2]);offset=float(args[3]) if len(args)>3 else 0
    editor.strips.new_sound('Browser Web Audio output',str(audio),channel=2,frame_start=1+round(offset*15))
    scene.render.ffmpeg.audio_codec='AAC';scene.render.ffmpeg.audio_bitrate=192
index=0
for f in range(scene.frame_end):
    t=start+f/15
    while index+1<len(frames) and frames[index+1]['timestamp']<=t:index+=1
    strip=editor.strips.new_image(f'Chrome frame {index}',str(source/f'frame-{index:05}.jpg'),channel=1,frame_start=f+1)
    strip.frame_final_duration=1
bpy.ops.render.render(animation=True)
print(json.dumps({'output':str(output),'fps':15,'frames':scene.frame_end,'duration':duration,'sourceFrames':len(frames)}))
