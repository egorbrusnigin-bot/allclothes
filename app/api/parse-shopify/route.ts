import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Fetch the Shopify product page HTML
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch product page" },
        { status: response.status }
      );
    }

    const html = await response.text();

    // Extract sections from HTML
    const sections = extractSections(html);

    // Log what we found for debugging
    console.log("Parsed sections:", JSON.stringify(sections, null, 2));

    return NextResponse.json(sections);
  } catch (error) {
    console.error("Error parsing Shopify page:", error);
    return NextResponse.json(
      { error: "Failed to parse product page" },
      { status: 500 }
    );
  }
}

function extractSections(html: string) {
  const sections: {
    aboutUs?: string;
    sizeChart?: string;
    shipping?: string;
    washing?: string;
    contact?: string;
    details?: string;
  } = {};

  // Check for <details> tags (Shopify uses these for product accordions)
  const detailsRegex = /<details[^>]*>([\s\S]*?)<\/details>/gi;
  let detailsMatch;
  const technicalDetails: string[] = [];
  const unrecognizedSections: string[] = [];

  console.log("Parsing product details tags...");

  while ((detailsMatch = detailsRegex.exec(html)) !== null) {
    const detailsContent = detailsMatch[1];

    // Extract <summary> tag (the heading)
    const summaryMatch = detailsContent.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i);
    if (!summaryMatch) continue;

    const heading = summaryMatch[1].replace(/<[^>]*>/g, "").trim().toUpperCase();

    // Extract content after </summary>
    const contentAfterSummary = detailsContent.split(/<\/summary>/i)[1];
    if (!contentAfterSummary) continue;

    console.log(`Found detail: "${heading}"`);

    // Extract text from content
    const textContent = extractTextContent(contentAfterSummary);

    if (!textContent) continue;

    // Assign to appropriate field based on heading
    let recognized = false;

    if (heading.includes("ABOUT") || heading.includes("ÜBER UNS") || heading.includes("BRAND") || heading.includes("STORY")) {
      sections.aboutUs = textContent;
      recognized = true;
    } else if (heading.includes("SIZE") || heading.includes("CHART") || heading.includes("MODEL") || heading.includes("GRÖßENTABELLE") || heading.includes("FIT") || heading.includes("MEASUREMENTS")) {
      sections.sizeChart = textContent;
      recognized = true;
    } else if (heading.includes("SHIPPING") || heading.includes("DELIVERY") || heading.includes("VERSAND")) {
      sections.shipping = textContent;
      recognized = true;
    } else if (heading.includes("WASHING") || heading.includes("CARE") || heading.includes("WASH") || heading.includes("PFLEGE") || heading.includes("WÄSCHE") || heading.includes("LAUNDRY")) {
      sections.washing = textContent;
      recognized = true;
    } else if (heading.includes("CONTACT") || heading.includes("EMAIL") || heading.includes("SUPPORT") || heading.includes("KONTAKT") || heading.includes("HELP")) {
      sections.contact = textContent;
      recognized = true;
    } else if (heading.includes("DETAIL") || heading.includes("SPECIFICATION") || heading.includes("FEATURE") || heading.includes("MATERIAL") || heading.includes("FABRIC") || heading.includes("PRODUCT INFO") || heading.includes("TECHNISCH")) {
      // Directly set details for these keywords
      if (sections.details) {
        sections.details += "\n\n" + textContent;
      } else {
        sections.details = textContent;
      }
      recognized = true;
    }

    // Collect unrecognized sections
    if (!recognized) {
      unrecognizedSections.push(`${heading}:\n${textContent}`);
    }
  }

  // Try to find technical details (GSM, Cotton, etc.) in lists
  // But skip navigation, country selectors, and other UI elements
  const ulRegex = /<ul[^>]*>([\s\S]*?)<\/ul>/gi;
  let ulMatch;

  while ((ulMatch = ulRegex.exec(html)) !== null) {
    const listContent = ulMatch[1];

    // Skip if this looks like navigation or country/currency selector
    const listText = listContent.toLowerCase();
    if (
      listText.includes('class="nav') ||
      listText.includes('class="menu') ||
      listText.includes('currency') ||
      listText.includes('land">') ||
      listText.includes('country') ||
      // Skip if it has country names
      (listText.includes('deutschland') || listText.includes('österreich') ||
       listText.includes('schweiz') || listText.includes('united states'))
    ) {
      continue;
    }

    const items = extractListItems(listContent);

    // Only add if most items look like technical details
    const technicalItems = items.filter(item => isTechnicalDetail(item));
    if (technicalItems.length > 0 && technicalItems.length >= items.length * 0.5) {
      technicalItems.forEach((item) => {
        technicalDetails.push(`• ${item}`);
      });
    }
  }

  // Add technical details if found
  if (technicalDetails.length > 0) {
    if (sections.details) {
      sections.details = technicalDetails.join("\n") + "\n\n" + sections.details;
    } else {
      sections.details = technicalDetails.join("\n");
    }
  }

  // If no details found yet, add unrecognized sections
  if (!sections.details && unrecognizedSections.length > 0) {
    sections.details = unrecognizedSections.join("\n\n");
  }

  return sections;
}

function extractTextContent(html: string): string {
  const parts: string[] = [];

  // Extract paragraphs
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let pMatch;
  while ((pMatch = pRegex.exec(html)) !== null) {
    const text = pMatch[1].replace(/<[^>]*>/g, "").trim();
    if (text) parts.push(text);
  }

  // Extract lists
  const ulRegex = /<ul[^>]*>([\s\S]*?)<\/ul>/gi;
  let ulMatch;
  while ((ulMatch = ulRegex.exec(html)) !== null) {
    const items = extractListItems(ulMatch[1]);
    items.forEach((item) => parts.push(`• ${item}`));
  }

  // Extract h3-h6 headings
  const headingRegex = /<h[3-6][^>]*>([\s\S]*?)<\/h[3-6]>/gi;
  let hMatch;
  while ((hMatch = headingRegex.exec(html)) !== null) {
    const text = hMatch[1].replace(/<[^>]*>/g, "").trim();
    if (text) parts.push(`\n${text}`);
  }

  return parts.join("\n").trim();
}

function extractListItems(html: string): string[] {
  const items: string[] = [];
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let match;

  while ((match = liRegex.exec(html)) !== null) {
    const text = match[1].replace(/<[^>]*>/g, "").trim();
    if (text) items.push(text);
  }

  return items;
}

function isTechnicalDetail(text: string): boolean {
  const upper = text.toUpperCase();

  // Skip if it looks like navigation or UI text
  if (text.length < 3 || text.length > 200) return false;
  if (upper.includes('SIGN IN') || upper.includes('CART') || upper.includes('MENU')) return false;

  return (
    upper.includes("GSM") ||
    upper.includes("WEIGHT") ||
    upper.includes("COTTON") ||
    upper.includes("POLYESTER") ||
    upper.includes("FIT") ||
    upper.includes("FABRIC") ||
    upper.includes("PRINT") ||
    upper.includes("MODEL") ||
    upper.includes("CM TALL") ||
    upper.includes("WEARS SIZE") ||
    upper.includes("MATERIAL") ||
    upper.includes("SLEEVE") ||
    upper.includes("COLLAR") ||
    upper.includes("WASH") ||
    upper.includes("IRON") ||
    upper.includes("TUMBLE") ||
    upper.includes("MACHINE") ||
    /\d+%/.test(upper) ||
    /\d+\s*GSM/i.test(text) ||
    /\d+\s*G\/M/.test(upper) ||
    /\d+CM/i.test(text) ||
    /(RELAXED|OVERSIZED|SLIM|REGULAR|LOOSE|TIGHT|BOXY)\s+(FIT|CUT)/i.test(text)
  );
}
