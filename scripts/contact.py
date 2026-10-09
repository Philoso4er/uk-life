# Contact sheet for a frame sequence: python3 scripts/contact.py <glob> <out.png> <idx,idx,...> <secs-per-frame>
import sys, glob
from PIL import Image, ImageDraw
fs = sorted(glob.glob(sys.argv[1]))
idx = [int(x) for x in sys.argv[3].split(',')]
dt = float(sys.argv[4])
ims = [Image.open(fs[i]).convert('RGB') for i in idx]
w, h = ims[0].size
cols = 4
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (w * cols, h * rows), 'white')
for k, im in enumerate(ims):
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, 92, 26), fill=(0, 0, 0))
    d.text((8, 7), f"t = {idx[k] * dt:.1f}s", fill=(255, 255, 255))
    d.rectangle((0, 0, w - 1, h - 1), outline=(255, 255, 255), width=3)
    sheet.paste(im, ((k % cols) * w, (k // cols) * h))
sheet.save(sys.argv[2])
print(sys.argv[2], sheet.size)
