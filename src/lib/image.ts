/** Client-side: crop to square + shrink to 256px JPEG so it can be stored as a small data URL in the DB (no file storage needed). */
export function toAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return reject(new Error("Please choose a JPG, PNG or WebP image"));
    if (file.size > 8 * 1024 * 1024) return reject(new Error("Image must be under 8 MB"));
    const img = new Image();
    img.onload = () => {
      const size = 256, c = document.createElement("canvas");
      c.width = c.height = size;
      const s = Math.min(img.width, img.height);
      c.getContext("2d")!.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      resolve(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => reject(new Error("Could not read image"));
    img.src = URL.createObjectURL(file);
  });
}

/** Client-side: scale a product photo to max 1000px and compress to JPEG under ~350 KB, returned as a data URL. */
export function toPhoto(file: File, maxSide = 1000): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return reject(new Error(`${file.name}: please choose a JPG, PNG or WebP image`));
    if (file.size > 15 * 1024 * 1024) return reject(new Error(`${file.name}: image must be under 15 MB`));
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      let q = 0.85, out = c.toDataURL("image/jpeg", q);
      while (out.length > 350_000 && q > 0.4) { q -= 0.1; out = c.toDataURL("image/jpeg", q); }
      out.length > 450_000 ? reject(new Error(`${file.name}: image is too large`)) : resolve(out);
    };
    img.onerror = () => reject(new Error(`${file.name}: could not read image`));
    img.src = URL.createObjectURL(file);
  });
}
