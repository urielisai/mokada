import logoMokadaUrl from '../../../assets/logo.svg';

let cachedLogoDataUrl: string | null = null;
let pendingLogoPromise: Promise<string | null> | null = null;

const rasterizeLogoToPngDataUrl = (): Promise<string | null> => {
  if (typeof document === 'undefined') return Promise.resolve(null);

  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        // ViewBox of logo.svg is 61.374763 x 20.538605 (~3:1 aspect ratio)
        canvas.width = 614;
        canvas.height = 205;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        cachedLogoDataUrl = canvas.toDataURL('image/png');
        resolve(cachedLogoDataUrl);
      } catch {
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
    image.src = logoMokadaUrl;
  });
};

// Preload logo on module import so it is ready synchronously when the user clicks print
if (typeof window !== 'undefined') {
  pendingLogoPromise = rasterizeLogoToPngDataUrl();
}

export const getMokadaLogoDataUrl = async (): Promise<string | null> => {
  if (cachedLogoDataUrl) return cachedLogoDataUrl;
  if (!pendingLogoPromise) {
    pendingLogoPromise = rasterizeLogoToPngDataUrl();
  }
  return pendingLogoPromise;
};

