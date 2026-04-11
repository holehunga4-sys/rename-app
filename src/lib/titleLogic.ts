import Tesseract from 'tesseract.js';

export const SUPPORTED_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "bmp"];

export const PRODUCT_TYPES = [
  "Auto",
  "T-Shirt",
  "Hoodie",
  "Sweatshirt",
  "Tank Top",
  "Long Sleeve",
  "Mug",
  "Poster",
  "Sticker",
  "Canvas",
];

export const TITLE_STYLES = ["Công thức", "Chuẩn SEO", "Quà tặng", "Cổ điển", "Tùy chỉnh"];
export const CASE_MODES = ["Tự động", "Viết Hoa Chữ Cái Đầu", "Viết hoa tự nhiên", "Giữ nguyên"];

const ACRONYM_WORDS = new Set([
  "USA", "NHL", "NBA", "NFL", "MLB", "UFC", "WWE", "FBI", "CIA", "NASA",
  "POD", "AI", "TV", "NY", "LA", "UK", "EU", "DC", "NCAA", "MLS",
  "3D", "2D", "4K", "8K", "LOL", "OMG", "IDK", "DIY", "BMX",
]);

const LOWERCASE_JOINERS = new Set([
  "a", "an", "and", "as", "at", "by", "for", "from", "in", "of", "on",
  "or", "the", "to", "vs", "with",
]);

export function normalizeSpaces(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function cleanOcrText(text: string): string {
  let cleaned = text.replace(/\|/g, "I");
  cleaned = cleaned.replace(/\n/g, " ");
  cleaned = cleaned.replace(/[_~`]+/g, " ");
  cleaned = cleaned.replace(/[^A-Za-z0-9&'’\- ]+/g, " ");
  return normalizeSpaces(cleaned);
}

function lettersOnly(text: string): string {
  return text.replace(/[^a-zA-Z]/g, '');
}

function looksLikeAllCaps(text: string): boolean {
  const letters = lettersOnly(text);
  if (letters.length < 3) return false;
  
  let uppers = 0;
  let lowers = 0;
  for (let i = 0; i < letters.length; i++) {
    if (letters[i] === letters[i].toUpperCase()) uppers++;
    else lowers++;
  }
  
  if (uppers === 0) return false;
  return lowers === 0 || (uppers / Math.max(1, letters.length) >= 0.9 && lowers <= 1);
}

function splitKeepSeparators(word: string): string[] {
  return word.split(/([-'/])/).filter(Boolean);
}

function applyCaseToToken(token: string, isFirstWord: boolean, mode: string): string {
  const stripped = token.replace(/[^A-Za-z0-9]/g, "");
  const upper = stripped.toUpperCase();
  const lower = stripped.toLowerCase();

  if (!stripped) return token;
  if (ACRONYM_WORDS.has(upper)) return upper;
  if (/^\d+[A-Za-z]*$/.test(stripped)) {
    return ACRONYM_WORDS.has(upper) ? token.toUpperCase() : token;
  }

  if (mode === "Giữ nguyên") return token;

  const pieces = splitKeepSeparators(token);
  const converted: string[] = [];
  
  for (const piece of pieces) {
    if (piece === "-" || piece === "'" || piece === "/") {
      converted.push(piece);
      continue;
    }
    
    const partClean = piece.replace(/[^A-Za-z0-9]/g, "");
    if (!partClean) {
      converted.push(piece);
      continue;
    }
    
    const upperPart = partClean.toUpperCase();
    const lowerPart = partClean.toLowerCase();

    if (ACRONYM_WORDS.has(upperPart)) {
      converted.push(upperPart);
      continue;
    }

    if (mode === "Viết hoa tự nhiên") {
      if (isFirstWord && converted.length === 0) {
        converted.push(piece.charAt(0).toUpperCase() + piece.slice(1).toLowerCase());
      } else {
        converted.push(piece.toLowerCase());
      }
      continue;
    }

    // Title Case
    if (!isFirstWord && LOWERCASE_JOINERS.has(lowerPart)) {
      converted.push(piece.toLowerCase());
    } else {
      converted.push(piece.charAt(0).toUpperCase() + piece.slice(1).toLowerCase());
    }
  }

  return converted.join("");
}

export function smartCase(text: string, mode: string = "Tự động"): string {
  text = normalizeSpaces(text);
  if (!text) return text;

  let effectiveMode = mode;
  if (mode === "Tự động") {
    effectiveMode = looksLikeAllCaps(text) ? "Viết Hoa Chữ Cái Đầu" : "Giữ nguyên";
  }

  const words = text.split(' ');
  const output: string[] = [];
  for (let i = 0; i < words.length; i++) {
    output.push(applyCaseToToken(words[i], i === 0, effectiveMode));
  }
  return output.join(" ");
}

export function dedupeWords(text: string): string {
  const seen = new Set<string>();
  const out: string[] = [];
  const words = text.split(' ');
  
  for (const word of words) {
    const key = word.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(word);
  }
  return out.join(" ");
}

export function trimToWordCount(text: string, limit: number): string {
  const words = text.split(' ');
  return words.slice(0, limit).join(" ");
}

export function chooseMainPhrase(rawText: string, filenameStem: string, wordLimit: number, caseMode: string): string {
  let cleaned = cleanOcrText(rawText);
  if (cleaned) {
    cleaned = dedupeWords(cleaned);
    cleaned = trimToWordCount(cleaned, wordLimit);
    cleaned = smartCase(cleaned, caseMode);
    cleaned = normalizeSpaces(cleaned);
    if (cleaned) return cleaned;
  }

  let fallback = filenameStem.replace(/_/g, " ").replace(/-/g, " ");
  fallback = fallback.replace(/\b\d+\b/g, " ");
  fallback = cleanOcrText(fallback);
  fallback = dedupeWords(fallback);
  fallback = trimToWordCount(fallback, wordLimit);
  fallback = smartCase(fallback, caseMode);
  return normalizeSpaces(fallback) || "Graphic";
}

export function autoDetectProductType(filename: string): string {
  const low = filename.toLowerCase();
  const mapping: Record<string, string> = {
    "hoodie": "Hoodie",
    "sweatshirt": "Sweatshirt",
    "tank": "Tank Top",
    "long sleeve": "Long Sleeve",
    "longsleeve": "Long Sleeve",
    "mug": "Mug",
    "poster": "Poster",
    "sticker": "Sticker",
    "canvas": "Canvas",
    "tee": "T-Shirt",
    "shirt": "T-Shirt",
    "tshirt": "T-Shirt",
  };
  
  for (const [key, value] of Object.entries(mapping)) {
    if (low.includes(key)) return value;
  }
  return "T-Shirt";
}

export function buildTitle(
  mainText: string,
  productType: string,
  style: string,
  prefix: string,
  suffixKeywords: string,
  customTemplate: string,
  caseMode: string
): string {
  prefix = normalizeSpaces(prefix);
  suffixKeywords = normalizeSpaces(suffixKeywords);
  mainText = normalizeSpaces(mainText);
  productType = normalizeSpaces(productType);

  let title = "";

  if (style === "Công thức") {
    title = `${prefix} ${mainText} ${suffixKeywords}`.trim();
  } else if (style === "Chuẩn SEO") {
    title = `${prefix} ${mainText} ${productType} Graphic Shirt ${suffixKeywords}`.trim();
  } else if (style === "Quà tặng") {
    title = `${prefix} ${mainText} ${productType} Gift for Fans ${suffixKeywords}`.trim();
  } else if (style === "Cổ điển") {
    title = `${prefix} ${mainText} Vintage Retro ${productType} ${suffixKeywords}`.trim();
  } else {
    const template = customTemplate.trim() || "{prefix} {main} {product} {extra}";
    title = template
      .replace(/{prefix}/g, prefix)
      .replace(/{main}/g, mainText)
      .replace(/{product}/g, productType)
      .replace(/{extra}/g, suffixKeywords);
  }

  title = cleanOcrText(title);
  title = dedupeWords(title);
  title = smartCase(title, caseMode);
  return normalizeSpaces(title);
}

export async function extractTextFromImage(imageFile: File): Promise<string> {
  try {
    const result = await Tesseract.recognize(imageFile, 'eng', {
      logger: m => console.log(m)
    });
    return normalizeSpaces(result.data.text);
  } catch (error) {
    console.error("OCR Error:", error);
    return "";
  }
}
