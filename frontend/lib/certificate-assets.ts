const cache: Record<string, string> = {};

async function loadImageAsBase64(url: string): Promise<string> {
  if (cache[url]) return cache[url];
  try {
    const res = await fetch(url);
    if (!res.ok) return "";
    const blob = await res.blob();
    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        cache[url] = result;
        resolve(result);
      };
      reader.onerror = () => resolve("");
      reader.readAsDataURL(blob);
    });
  } catch {
    return "";
  }
}

export async function getOmnilearnLogo(): Promise<string> {
  return loadImageAsBase64("/omni-learn-logo.png");
}

export async function getAfflatusLogo(): Promise<string> {
  return loadImageAsBase64("/afflatus-logo.png");
}

export async function loadSignatureImage(url: string): Promise<string> {
  if (!url) return "";
  return loadImageAsBase64(url);
}
