export function dressImageUrl(storagePath: string): string {
  const safePath = storagePath.split("/").map(encodeURIComponent).join("/");
  return `/api/dress-images/${safePath}`;
}
