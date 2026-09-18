declare module "arabic-persian-reshaper" {
  export const ArabicShaper: {
    convertArabic(text: string): string;
    convertArabicBack(text: string): string;
  };
  const reshaper: { ArabicShaper: typeof ArabicShaper };
  export default reshaper;
}
