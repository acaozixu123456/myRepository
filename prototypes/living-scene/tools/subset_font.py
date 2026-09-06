from pathlib import Path
from fontTools import subset
import sys
root=Path(__file__).resolve().parents[1]
text=(root/'index.html').read_text()+(root/'src/main.js').read_text()
options=subset.Options(); options.flavor='woff2'
font=subset.load_font(sys.argv[1],options)
s=subset.Subsetter(options=options);s.populate(text=text);s.subset(font)
subset.save_font(font,str(root/'public/scene/noto-jp-subset.woff2'),options)
