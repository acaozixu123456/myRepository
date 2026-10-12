"""Technical full-canvas export for A12: no art/alpha edits; native1254 ->512.

Run with provenance JSON path and a separate output directory. Raw paths refer
to preserved original image_gen PNGs in the author workspace. If unavailable,
retrieve the originals by the exact hashes in provenance rather than upscaling.
The 588-byte timestamped ICC is reused from one current final to reproduce bytes.
"""
import argparse, json, pathlib, hashlib
from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument('provenance', type=pathlib.Path)
parser.add_argument('output_directory', type=pathlib.Path)
args = parser.parse_args()
data = json.loads(args.provenance.read_text())
repo = args.provenance.resolve().parents[3]
first_final = repo / data['assets'][0]['source_path']
icc = Image.open(first_final).info['icc_profile']
assert hashlib.sha256(icc).hexdigest() == data['assets'][0]['icc_sha256']
args.output_directory.mkdir(parents=True, exist_ok=True)
for record in data['assets']:
    raw = pathlib.Path(record['raw_path'])
    assert hashlib.sha256(raw.read_bytes()).hexdigest() == record['raw_sha256']
    image = Image.open(raw)
    assert list(image.size) == record['raw_size'] and image.mode == record['raw_mode']
    image = image.convert('RGBA').resize((512, 512), Image.Resampling.LANCZOS)
    output = args.output_directory / pathlib.Path(record['source_path']).name
    image.save(output, 'WEBP', lossless=True, quality=100, method=6,
               exact=True, icc_profile=icc)
    actual = hashlib.sha256(output.read_bytes()).hexdigest()
    assert actual == record['source_sha256'], (record['id'], actual)
    print(record['id'], actual)
