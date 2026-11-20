/** Shared checks for image data URLs uploaded from the browser (admin product photos, customer review photos). */
export const IMAGE_DATA_RE = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+=*)$/;

/** True only if the decoded bytes really are the image type the data URL claims (no disguised files). */
export function magicOk(type: string, b64: string): boolean {
  const h = Buffer.from(b64.slice(0, 24), "base64");
  if (type === "jpeg") return h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff;
  if (type === "png") return h.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  return h.subarray(0, 4).toString("ascii") === "RIFF" && h.subarray(8, 12).toString("ascii") === "WEBP";
}
