export const COMPANY_LOGO_PATH = "/images/branding/dbest-logo-transparent.png";

export async function loadCompanyLogo(): Promise<string | null> {
  try {
    const response = await fetch(COMPANY_LOGO_PATH);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
