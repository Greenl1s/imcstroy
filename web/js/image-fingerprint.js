function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = url;
  });
}

export async function prepareRecognitionPhoto(file) {
  if (!file?.type?.startsWith('image/')) throw new Error('Выберите фотографию');
  const source = URL.createObjectURL(file);
  try {
    const image = await loadImage(source);
    const scale = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', .84);
    return { dataUrl, descriptors: describe(canvas) };
  } finally { URL.revokeObjectURL(source); }
}

function describe(source) {
  const w = source.width, h = source.height;
  const crops = [
    [0,0,1,1], [.12,.12,.76,.76], [0,0,.62,1], [.38,0,.62,1],
    [0,0,1,.62], [0,.38,1,.62], [0,0,.58,.58], [.42,.42,.58,.58], [.21,.21,.58,.58]
  ];
  return crops.map(([x,y,cw,ch]) => descriptor(source, x*w, y*h, cw*w, ch*h));
}

function descriptor(source, sx, sy, sw, sh) {
  const size = 48, canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, size, size);
  const p = ctx.getImageData(0,0,size,size).data;
  const gray = new Float32Array(size*size), vector = new Array(176).fill(0);
  for (let i=0;i<gray.length;i++) gray[i] = .299*p[i*4]+.587*p[i*4+1]+.114*p[i*4+2];
  const counts = new Array(16).fill(0);
  for (let y=0;y<size;y++) for (let x=0;x<size;x++) {
    const i=y*size+x, cell=Math.min(3,y>>4)*4+Math.min(3,x>>4), r=p[i*4],g=p[i*4+1],b=p[i*4+2],sum=r+g+b+1;
    vector[cell*3]+=r/sum; vector[cell*3+1]+=g/sum; vector[cell*3+2]+=b/sum; counts[cell]++;
  }
  for(let c=0;c<16;c++) for(let k=0;k<3;k++) vector[c*3+k]/=counts[c]||1;
  for(let y=1;y<size-1;y++) for(let x=1;x<size-1;x++) {
    const gx=gray[y*size+x+1]-gray[y*size+x-1], gy=gray[(y+1)*size+x]-gray[(y-1)*size+x];
    const mag=Math.hypot(gx,gy), bin=Math.floor(((Math.atan2(gy,gx)+Math.PI)/(2*Math.PI))*8)%8;
    const cell=Math.min(3,y>>4)*4+Math.min(3,x>>4); vector[48+cell*8+bin]+=mag;
  }
  const norm=Math.hypot(...vector)||1;
  return vector.map(v=>Number((v/norm).toFixed(6)));
}
