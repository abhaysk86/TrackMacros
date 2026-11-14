// Photos are shrunk on the device before upload: smaller uploads, lower AI cost,
// and only a small thumbnail is ever stored.

const loadImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file could not be read as an image.'));
    };
    img.src = url;
  });

function draw(img: HTMLImageElement, width: number, height: number, crop: boolean, quality: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  if (crop) {
    // Centre-crop to fill the square.
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, width, height);
  } else {
    ctx.drawImage(img, 0, 0, width, height);
  }
  return canvas.toDataURL('image/jpeg', quality);
}

export interface PreparedImage {
  /** JPEG, longest side at most 1024px, base64 without the data-URL prefix. */
  base64: string;
  /** 120px square JPEG data URL for the meal list. */
  thumb: string;
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  const img = await loadImage(file);
  const scale = Math.min(1, 1024 / Math.max(img.naturalWidth, img.naturalHeight));
  const full = draw(img, Math.round(img.naturalWidth * scale), Math.round(img.naturalHeight * scale), false, 0.8);
  return { base64: full.split(',')[1], thumb: draw(img, 120, 120, true, 0.7) };
}
