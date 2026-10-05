from PIL import Image, ImageDraw, ImageFont
import math, os
fonts=["/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf","/System/Library/Fonts/Supplemental/Arial Bold.ttf","/System/Library/Fonts/Helvetica.ttc"]
def font(sz):
    for f in fonts:
        if os.path.exists(f):
            try: return ImageFont.truetype(f,sz)
            except Exception: pass
    return ImageFont.load_default()
def make(n,path):
    S=n*4
    im=Image.new("RGB",(S,S),"#ffffff")
    # white rounded square on faint grey so rounding is visible
    bg=Image.new("RGBA",(S,S),(0,0,0,0)); d=ImageDraw.Draw(bg)
    d.rounded_rectangle([0,0,S-1,S-1],radius=int(S*0.225),fill="#ffffff")
    base=Image.new("RGBA",(S,S),"#ffffff"); base.alpha_composite(bg)
    d=ImageDraw.Draw(base)
    f=font(int(S*0.72))
    bb=d.textbbox((0,0),"s",font=f)
    w,h=bb[2]-bb[0],bb[3]-bb[1]
    x=(S-w)/2-bb[0]-S*0.04; y=(S-h)/2-bb[1]+S*0.02
    d.text((x,y),"s",font=f,fill="#111111")
    # four-point star
    cx,cy,R,r=S*0.74,S*0.27,S*0.11,S*0.032
    pts=[]
    for i in range(8):
        a=math.pi/2*i/2-math.pi/2
        rad=R if i%2==0 else r
        pts.append((cx+rad*math.cos(a),cy+rad*math.sin(a)))
    d.polygon(pts,fill="#111111")
    base.convert("RGB").resize((n,n),Image.LANCZOS).save(path)
here=os.path.dirname(os.path.abspath(__file__))
make(192,here+"/icon-192.png"); make(512,here+"/icon-512.png"); make(180,here+"/apple-touch-icon.png")
