// Robust HTML-element → JPG downloader for ID cards.
// Uses html2canvas with CORS enabled (handles Supabase Storage images
// reliably) and falls back to html-to-image if html2canvas errors out.

export async function downloadCardAsJpg(el: HTMLElement, fileName: string): Promise<void> {
  const dataUrl = await renderElementToJpeg(el);
  const link = document.createElement("a");
  link.download = `${fileName}.jpg`;
  link.href = dataUrl;
  link.click();
}

async function renderElementToJpeg(el: HTMLElement): Promise<string> {
  // Give any lazy-loaded images (photo/logo/QR) a chance to finish
  await waitForImages(el);

  try {
    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(el, {
      useCORS: true,
      allowTaint: false,
      backgroundColor: "#1E1B4B",
      scale: 3,
      logging: false,
      imageTimeout: 15000,
    });
    return canvas.toDataURL("image/jpeg", 0.95);
  } catch (err) {
    console.warn("html2canvas failed, falling back to html-to-image:", err);
    const { toJpeg } = await import("html-to-image");
    return await toJpeg(el, {
      pixelRatio: 3,
      cacheBust: true,
      quality: 0.95,
      backgroundColor: "#1E1B4B",
      skipFonts: true,
      // Transparent 1x1 GIF — used if any image fails to be embedded.
      imagePlaceholder:
        "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=",
      fetchRequestInit: { cache: "no-cache" as RequestCache, mode: "cors" },
    });
  }
}

async function waitForImages(el: HTMLElement, timeoutMs = 8000): Promise<void> {
  const imgs = Array.from(el.querySelectorAll("img"));
  if (imgs.length === 0) return;
  await Promise.race([
    Promise.all(
      imgs.map((img) => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise<void>((resolve) => {
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        });
      })
    ),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}
