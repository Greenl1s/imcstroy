function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = url;
  });
}

function canvas(width, height) {
  const node = document.createElement('canvas');
  node.width = Math.max(1, Math.round(width)); node.height = Math.max(1, Math.round(height));
  return node;
}

/**
 * Подготавливает одно и то же изображение и для эталонной базы, и для поиска.
 * Фон оценивается по краям кадра, размывается на сохраняемой фотографии и
 * полностью исключается из числовых признаков.
 */
export async function prepareRecognitionPhoto(file) {
  if (!file?.type?.startsWith('image/')) throw new Error('Выберите фотографию');
  const source = URL.createObjectURL(file);
  try {
    const image = await loadImage(source);
    const scale = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight));
    const original = canvas(image.naturalWidth * scale, image.naturalHeight * scale);
    original.getContext('2d').drawImage(image, 0, 0, original.width, original.height);

    const subject = makeSubjectMask(original);
    const processed = renderFocusedPhoto(original, subject.mask);
    return {
      dataUrl: processed.toDataURL('image/jpeg', .86),
      descriptors: describe(original, subject.mask, subject.bounds),
      foregroundRatio: subject.ratio,
      usedFallbackMask: subject.fallback
    };
  } finally { URL.revokeObjectURL(source); }
}

/** Строит мягкую маску объекта. Предполагается, что прибор находится в рамке. */
function makeSubjectMask(source) {
  const maxSide = 192;
  const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
  const small = canvas(source.width * scale, source.height * scale);
  const ctx = small.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, small.width, small.height);
  const { width: w, height: h } = small;
  const rgba = ctx.getImageData(0, 0, w, h).data;
  const palette = borderPalette(rgba, w, h);
  let mask = new Uint8Array(w * h);

  // Отличие от цветов на границе + контур. Небольшой центральный приоритет
  // помогает не принять случайный яркий предмет в углу за основной объект.
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x, p = i * 4;
    const r = rgba[p], g = rgba[p + 1], b = rgba[p + 2];
    let distance = Infinity;
    for (const color of palette) {
      const dr = r - color[0], dg = g - color[1], db = b - color[2];
      distance = Math.min(distance, Math.sqrt(dr * dr + dg * dg + db * db));
    }
    const left = p - 4, right = p + 4, up = p - w * 4, down = p + w * 4;
    const edge = Math.abs(rgba[right] - rgba[left]) + Math.abs(rgba[right + 1] - rgba[left + 1]) +
      Math.abs(rgba[down] - rgba[up]) + Math.abs(rgba[down + 1] - rgba[up + 1]);
    const nx = Math.abs((x + .5) / w - .5) * 2, ny = Math.abs((y + .5) / h - .5) * 2;
    const center = Math.max(0, 1 - Math.max(nx, ny));
    if (distance > 45 - center * 12 || (distance > 27 && edge > 72)) mask[i] = 1;
  }

  mask = dilate(mask, w, h, 2);
  mask = erode(mask, w, h, 1);
  mask = keepCentralComponents(mask, w, h);
  let bounds = maskBounds(mask, w, h);
  let count = mask.reduce((sum, value) => sum + value, 0);
  let ratio = count / (w * h);
  let fallback = false;

  // Если автоматическое отделение неуверенное, берём содержимое рамки.
  if (!bounds || ratio < .045 || ratio > .82) {
    fallback = true;
    mask = new Uint8Array(w * h);
    const x0 = Math.round(w * .12), x1 = Math.round(w * .88);
    const y0 = Math.round(h * .12), y1 = Math.round(h * .88);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) mask[y * w + x] = 1;
    bounds = { x0, y0, x1, y1 };
    ratio = (x1 - x0) * (y1 - y0) / (w * h);
  }

  const rawMask = canvas(w, h);
  const imageData = rawMask.getContext('2d').createImageData(w, h);
  for (let i = 0; i < mask.length; i++) {
    imageData.data[i * 4] = imageData.data[i * 4 + 1] = imageData.data[i * 4 + 2] = 255;
    imageData.data[i * 4 + 3] = mask[i] ? 255 : 0;
  }
  rawMask.getContext('2d').putImageData(imageData, 0, 0);

  const fullMask = canvas(source.width, source.height);
  const fullCtx = fullMask.getContext('2d');
  fullCtx.filter = `blur(${Math.max(3, Math.round(Math.max(source.width, source.height) / 190))}px)`;
  fullCtx.drawImage(rawMask, 0, 0, source.width, source.height);
  fullCtx.filter = 'none';
  return {
    mask: fullMask,
    ratio,
    fallback,
    bounds: {
      x0: bounds.x0 / w * source.width, y0: bounds.y0 / h * source.height,
      x1: bounds.x1 / w * source.width, y1: bounds.y1 / h * source.height
    }
  };
}

function borderPalette(data, w, h) {
  const colors = [], zones = 5, band = Math.max(2, Math.round(Math.min(w, h) * .055));
  const average = (x0, y0, x1, y1) => {
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) {
      const p = (y * w + x) * 4; r += data[p]; g += data[p + 1]; b += data[p + 2]; n++;
    }
    return [r / n, g / n, b / n];
  };
  for (let z = 0; z < zones; z++) {
    const x0 = Math.floor(z * w / zones), x1 = Math.ceil((z + 1) * w / zones);
    const y0 = Math.floor(z * h / zones), y1 = Math.ceil((z + 1) * h / zones);
    colors.push(average(x0, 0, x1, band), average(x0, h - band, x1, h));
    colors.push(average(0, y0, band, y1), average(w - band, y0, w, y1));
  }
  return colors;
}

function dilate(input, w, h, radius) {
  const out = new Uint8Array(input.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let on = 0;
    for (let dy = -radius; dy <= radius && !on; dy++) for (let dx = -radius; dx <= radius; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < w && yy < h && input[yy * w + xx]) { on = 1; break; }
    }
    out[y * w + x] = on;
  }
  return out;
}

function erode(input, w, h, radius) {
  const out = new Uint8Array(input.length);
  for (let y = radius; y < h - radius; y++) for (let x = radius; x < w - radius; x++) {
    let on = 1;
    for (let dy = -radius; dy <= radius && on; dy++) for (let dx = -radius; dx <= radius; dx++) {
      if (!input[(y + dy) * w + x + dx]) { on = 0; break; }
    }
    out[y * w + x] = on;
  }
  return out;
}

function keepCentralComponents(input, w, h) {
  const seen = new Uint8Array(input.length), output = new Uint8Array(input.length);
  const minSize = Math.max(12, Math.round(w * h * .003));
  for (let start = 0; start < input.length; start++) {
    if (!input[start] || seen[start]) continue;
    const queue = [start], component = []; seen[start] = 1;
    let central = false;
    for (let q = 0; q < queue.length; q++) {
      const i = queue[q], x = i % w, y = Math.floor(i / w); component.push(i);
      if (x > w * .1 && x < w * .9 && y > h * .1 && y < h * .9) central = true;
      for (const next of [i - 1, i + 1, i - w, i + w]) {
        if (next < 0 || next >= input.length || seen[next] || !input[next]) continue;
        const nx = next % w; if (Math.abs(nx - x) > 1) continue;
        seen[next] = 1; queue.push(next);
      }
    }
    if (central && component.length >= minSize) for (const i of component) output[i] = 1;
  }
  return output;
}

function maskBounds(mask, w, h) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x]) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1);
  }
  if (x1 < 0) return null;
  const px = Math.round((x1 - x0) * .04), py = Math.round((y1 - y0) * .04);
  return { x0: Math.max(0, x0 - px), y0: Math.max(0, y0 - py), x1: Math.min(w, x1 + px), y1: Math.min(h, y1 + py) };
}

function renderFocusedPhoto(source, mask) {
  const output = canvas(source.width, source.height), ctx = output.getContext('2d');
  ctx.save();
  ctx.filter = `blur(${Math.max(12, Math.round(Math.max(source.width, source.height) / 55))}px) brightness(.72) saturate(.55)`;
  ctx.drawImage(source, 0, 0);
  ctx.restore();
  const subject = canvas(source.width, source.height), subjectCtx = subject.getContext('2d');
  subjectCtx.drawImage(source, 0, 0);
  subjectCtx.globalCompositeOperation = 'destination-in'; subjectCtx.drawImage(mask, 0, 0);
  ctx.drawImage(subject, 0, 0);
  return output;
}

function describe(source, mask, bounds) {
  const x = bounds.x0, y = bounds.y0, w = Math.max(1, bounds.x1 - bounds.x0), h = Math.max(1, bounds.y1 - bounds.y0);
  const crops = [
    [0,0,1,1], [.12,.12,.76,.76], [0,0,.62,1], [.38,0,.62,1],
    [0,0,1,.62], [0,.38,1,.62], [0,0,.58,.58], [.42,.42,.58,.58], [.21,.21,.58,.58]
  ];
  return crops.map(([cx,cy,cw,ch]) => descriptor(source, mask, x + cx*w, y + cy*h, cw*w, ch*h));
}

function descriptor(source, mask, sx, sy, sw, sh) {
  const size = 48, sample = canvas(size, size), maskSample = canvas(size, size);
  const ctx = sample.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, size, size);
  const maskCtx = maskSample.getContext('2d', { willReadFrequently: true });
  maskCtx.drawImage(mask, sx, sy, sw, sh, 0, 0, size, size);
  const p = ctx.getImageData(0,0,size,size).data, m = maskCtx.getImageData(0,0,size,size).data;
  const gray = new Float32Array(size*size), vector = new Array(176).fill(0), weights = new Float32Array(size*size);
  for (let i=0;i<gray.length;i++) {
    gray[i] = .299*p[i*4]+.587*p[i*4+1]+.114*p[i*4+2]; weights[i] = m[i*4+3] / 255;
  }
  const counts = new Array(16).fill(0);
  for (let y=0;y<size;y++) for (let x=0;x<size;x++) {
    const i=y*size+x, weight=weights[i]; if (weight < .18) continue;
    const cell=Math.min(3,y>>4)*4+Math.min(3,x>>4), r=p[i*4],g=p[i*4+1],b=p[i*4+2],sum=r+g+b+1;
    vector[cell*3]+=r/sum*weight; vector[cell*3+1]+=g/sum*weight; vector[cell*3+2]+=b/sum*weight; counts[cell]+=weight;
  }
  for(let c=0;c<16;c++) for(let k=0;k<3;k++) vector[c*3+k]/=counts[c]||1;
  for(let y=1;y<size-1;y++) for(let x=1;x<size-1;x++) {
    const i=y*size+x, weight=Math.min(weights[i],weights[i-1],weights[i+1],weights[i-size],weights[i+size]);
    if (weight < .18) continue;
    const gx=gray[i+1]-gray[i-1], gy=gray[i+size]-gray[i-size];
    const mag=Math.hypot(gx,gy)*weight, bin=Math.floor(((Math.atan2(gy,gx)+Math.PI)/(2*Math.PI))*8)%8;
    const cell=Math.min(3,y>>4)*4+Math.min(3,x>>4); vector[48+cell*8+bin]+=mag;
  }
  const norm=Math.hypot(...vector)||1;
  return vector.map(v=>Number((v/norm).toFixed(6)));
}
