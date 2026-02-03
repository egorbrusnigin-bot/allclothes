// Map country names to ISO codes
const countryNameToCode: Record<string, string> = {
  "AUSTRIA": "AT",
  "ÖSTERREICH": "AT",
  "GERMANY": "DE",
  "DEUTSCHLAND": "DE",
  "UNITED STATES": "US",
  "UNITED STATES OF AMERICA": "US",
  "USA": "US",
  "U.S.": "US",
  "U.S.A.": "US",
  "UNITED KINGDOM": "GB",
  "GREAT BRITAIN": "GB",
  "UK": "GB",
  "FRANCE": "FR",
  "ITALY": "IT",
  "SPAIN": "ES",
  "NETHERLANDS": "NL",
  "BELGIUM": "BE",
  "SWITZERLAND": "CH",
  "SCHWEIZ": "CH",
  "SWEDEN": "SE",
  "NORWAY": "NO",
  "DENMARK": "DK",
  "FINLAND": "FI",
  "POLAND": "PL",
  "PORTUGAL": "PT",
  "CZECH REPUBLIC": "CZ",
  "JAPAN": "JP",
  "SOUTH KOREA": "KR",
  "KOREA": "KR",
  "CHINA": "CN",
  "CANADA": "CA",
  "AUSTRALIA": "AU",
  "NEW ZEALAND": "NZ",
  "BRAZIL": "BR",
  "MEXICO": "MX",
  "ARGENTINA": "AR",
  "RUSSIA": "RU",
  "UKRAINE": "UA",
};

// Convert country code to flag emoji
export function getCountryFlag(countryInput: string | null): string {
  if (!countryInput) return "";

  let code = countryInput.toUpperCase().trim().replace(/\s+/g, " ");

  // If it's a country name, convert to code
  if (code.length > 2) {
    code = countryNameToCode[code] || code.substring(0, 2);
  }

  // Must be exactly 2 characters for ISO 3166-1 alpha-2
  if (code.length !== 2) return "";

  // Regional indicator symbols are from U+1F1E6 (A) to U+1F1FF (Z)
  const codePoints = [...code].map(char =>
    0x1F1E6 - 65 + char.charCodeAt(0)
  );

  return String.fromCodePoint(...codePoints);
}

// Map of common country codes to names (for reference)
export const countryNames: Record<string, string> = {
  "AT": "Austria",
  "DE": "Germany",
  "US": "United States",
  "GB": "United Kingdom",
  "FR": "France",
  "IT": "Italy",
  "ES": "Spain",
  "NL": "Netherlands",
  "BE": "Belgium",
  "CH": "Switzerland",
  "SE": "Sweden",
  "NO": "Norway",
  "DK": "Denmark",
  "FI": "Finland",
  "PL": "Poland",
  "PT": "Portugal",
  "CZ": "Czech Republic",
  "JP": "Japan",
  "KR": "South Korea",
  "CN": "China",
  "CA": "Canada",
  "AU": "Australia",
  "NZ": "New Zealand",
  "BR": "Brazil",
  "MX": "Mexico",
  "AR": "Argentina",
  "RU": "Russia",
  "UA": "Ukraine",
};
