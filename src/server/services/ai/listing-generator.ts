/**
 * AI Listing Generation Service
 *
 * Uses OpenAI GPT-4o to analyze product images and generate
 * optimized listing content for resale marketplaces.
 */

import OpenAI from "openai";

// ============ CONFIGURATION ============

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Model selection: GPT-4o for best vision capabilities
const DEFAULT_MODEL = "gpt-4o";

// ============ TYPES ============

export type TargetPlatform = "ebay" | "poshmark" | "mercari";

export type ItemCondition = "NEW" | "LIKE_NEW" | "GOOD" | "FAIR" | "POOR";

export interface GenerateListingInput {
  /** Array of image URLs (R2 public URLs) */
  imageUrls: string[];
  /** Optional user-provided hints to improve accuracy */
  userHints?: {
    category?: string;
    brand?: string;
    condition?: string;
    keywords?: string[];
  };
  /** Target marketplace for optimization */
  targetPlatform: TargetPlatform;
}

export interface GeneratedListing {
  /** SEO-optimized title (max 80 chars for eBay) */
  title: string;
  /** HTML-formatted description with key details */
  description: string;
  /** Price suggestions based on item analysis */
  suggestedPrice: {
    min: number;
    max: number;
    recommended: number;
  };
  /** Suggested category information */
  category: {
    suggested: string;
    ebayId?: string;
    confidence: number;
  };
  /** Condition assessment */
  condition: {
    suggested: ItemCondition;
    confidence: number;
  };
  /** Extracted item specifics (brand, size, color, etc.) */
  itemSpecifics: Array<{
    name: string;
    value: string;
    confidence: number;
  }>;
  /** Overall confidence score (0-1) */
  overallConfidence: number;
  /** Tokens used for this generation */
  tokensUsed: number;
}

// ============ INTERNAL TYPES ============

interface AIListingResponse {
  title: string;
  description: string;
  suggestedPrice: {
    min: number;
    max: number;
    recommended: number;
  };
  category: {
    suggested: string;
    ebayId?: string;
    confidence: number;
  };
  condition: {
    suggested: string;
    confidence: number;
  };
  itemSpecifics: Array<{
    name: string;
    value: string;
    confidence: number;
  }>;
  overallConfidence: number;
}

// ============ CLIENT INITIALIZATION ============

let openaiClient: OpenAI | null = null;

/**
 * Get or create the OpenAI client
 * Lazy initialization to avoid errors during build time
 */
function getOpenAIClient(): OpenAI {
  if (openaiClient) return openaiClient;

  if (!OPENAI_API_KEY) {
    throw new Error(
      "Missing OPENAI_API_KEY environment variable. Please set it in .env.local"
    );
  }

  openaiClient = new OpenAI({
    apiKey: OPENAI_API_KEY,
  });

  return openaiClient;
}

// ============ PROMPT CONSTRUCTION ============

/**
 * Get platform-specific requirements for the prompt
 */
function getPlatformRequirements(platform: TargetPlatform): string {
  const requirements: Record<TargetPlatform, string> = {
    ebay: `
- Title: Maximum 80 characters, include brand, key features, and condition
- Use popular search terms that eBay buyers commonly use
- Include size, color, and material when visible
- Format description with HTML for eBay (use <p>, <ul>, <li> tags)
- Suggest eBay category ID if confident`,
    poshmark: `
- Title: Maximum 80 characters, focus on brand and style
- Poshmark shoppers love brands, so emphasize brand name prominently
- Include size prominently as Poshmark is fashion-focused
- Description should be conversational and friendly
- Include relevant style tags (boho, minimalist, vintage, etc.)`,
    mercari: `
- Title: Maximum 40 characters for Mercari
- Be concise but descriptive
- Focus on item name and condition
- Description should be straightforward and honest
- Include shipping-friendly details (weight, dimensions if relevant)`,
  };

  return requirements[platform];
}

/**
 * Build the system prompt for listing generation
 */
function buildSystemPrompt(platform: TargetPlatform): string {
  const platformReqs = getPlatformRequirements(platform);

  return `You are an expert reseller assistant specializing in creating optimized marketplace listings.
Your job is to analyze product images and generate compelling, SEO-optimized listings that sell.

You have extensive knowledge of:
- Resale markets (clothing, electronics, collectibles, home goods)
- Brand identification and authentication markers
- Condition assessment
- Market pricing for used goods
- Platform-specific best practices

Platform Requirements for ${platform.toUpperCase()}:
${platformReqs}

IMPORTANT GUIDELINES:
1. Be accurate - only claim what you can see in the images
2. Be honest about condition - note any visible wear, stains, or damage
3. Use natural language that appeals to buyers
4. Include relevant keywords for search visibility
5. Never exaggerate or make false claims
6. If uncertain about something, express lower confidence

For pricing:
- Consider brand prestige and demand
- Factor in visible condition
- Provide a realistic range based on typical resale values
- The "recommended" price should be competitive but profitable

For condition assessment, use these standards:
- NEW: With tags, never used, perfect condition
- LIKE_NEW: No tags but appears unused, no wear
- GOOD: Gently used, minimal wear, no significant flaws
- FAIR: Noticeable wear or minor flaws, fully functional
- POOR: Significant wear, damage, or flaws (still sellable)

Respond ONLY with valid JSON matching the required schema.`;
}

/**
 * Build the user prompt with images and optional hints
 */
function buildUserPrompt(input: GenerateListingInput): string {
  let prompt = `Analyze these product images and generate a complete listing for ${input.targetPlatform}.`;

  if (input.userHints) {
    prompt += "\n\nUser-provided hints (use if they help, but verify against images):";
    if (input.userHints.category) {
      prompt += `\n- Category: ${input.userHints.category}`;
    }
    if (input.userHints.brand) {
      prompt += `\n- Brand: ${input.userHints.brand}`;
    }
    if (input.userHints.condition) {
      prompt += `\n- Condition: ${input.userHints.condition}`;
    }
    if (input.userHints.keywords && input.userHints.keywords.length > 0) {
      prompt += `\n- Keywords: ${input.userHints.keywords.join(", ")}`;
    }
  }

  prompt += `

Return a JSON object with this exact structure:
{
  "title": "string (max 80 chars for eBay/Poshmark, 40 for Mercari)",
  "description": "string (HTML formatted for eBay, plain text for others)",
  "suggestedPrice": {
    "min": number,
    "max": number,
    "recommended": number
  },
  "category": {
    "suggested": "string (general category name)",
    "ebayId": "string or null (eBay category ID if known)",
    "confidence": number (0-1)
  },
  "condition": {
    "suggested": "NEW" | "LIKE_NEW" | "GOOD" | "FAIR" | "POOR",
    "confidence": number (0-1)
  },
  "itemSpecifics": [
    {
      "name": "string (e.g., 'Brand', 'Size', 'Color', 'Material')",
      "value": "string",
      "confidence": number (0-1)
    }
  ],
  "overallConfidence": number (0-1)
}

Extract ALL visible item specifics including but not limited to:
- Brand
- Size
- Color
- Material/Fabric
- Style
- Pattern
- Season (if applicable)
- Model/SKU (if visible)

Be thorough but only include what you can actually see or reasonably infer from the images.`;

  return prompt;
}

// ============ RESPONSE PARSING ============

/**
 * Parse and validate the AI response
 */
function parseAIResponse(content: string): AIListingResponse {
  // Try to extract JSON from the response (sometimes wrapped in markdown)
  let jsonString = content;

  // Handle markdown code blocks
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonString = jsonMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(jsonString) as AIListingResponse;

    // Validate required fields
    if (!parsed.title || typeof parsed.title !== "string") {
      throw new Error("Invalid response: missing or invalid title");
    }
    if (!parsed.description || typeof parsed.description !== "string") {
      throw new Error("Invalid response: missing or invalid description");
    }
    if (!parsed.suggestedPrice || typeof parsed.suggestedPrice.recommended !== "number") {
      throw new Error("Invalid response: missing or invalid suggestedPrice");
    }

    return parsed;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Failed to parse AI response as JSON: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Map condition string to ItemCondition enum
 */
function normalizeCondition(condition: string): ItemCondition {
  const normalized = condition.toUpperCase().replace(/[^A-Z_]/g, "");
  const valid: ItemCondition[] = ["NEW", "LIKE_NEW", "GOOD", "FAIR", "POOR"];

  if (valid.includes(normalized as ItemCondition)) {
    return normalized as ItemCondition;
  }

  // Handle common variations
  if (normalized.includes("LIKENEW") || normalized.includes("EXCELLENT")) {
    return "LIKE_NEW";
  }
  if (normalized.includes("VERYGOOD")) {
    return "GOOD";
  }
  if (normalized.includes("ACCEPTABLE")) {
    return "FAIR";
  }

  // Default to GOOD if unrecognized
  return "GOOD";
}

/**
 * Enforce title length limits by platform
 */
function enforceTitleLength(title: string, platform: TargetPlatform): string {
  const limits: Record<TargetPlatform, number> = {
    ebay: 80,
    poshmark: 80,
    mercari: 40,
  };

  const limit = limits[platform];
  if (title.length <= limit) {
    return title;
  }

  // Truncate intelligently at word boundary
  const truncated = title.substring(0, limit - 3);
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > limit * 0.7) {
    return truncated.substring(0, lastSpace) + "...";
  }
  return truncated + "...";
}

// ============ MAIN FUNCTION ============

/**
 * Generate a listing from product images using AI
 *
 * @param input - Image URLs, optional hints, and target platform
 * @returns Generated listing with confidence scores
 * @throws Error if API call fails or response is invalid
 */
export async function generateListing(
  input: GenerateListingInput
): Promise<GeneratedListing> {
  // Validate input
  if (!input.imageUrls || input.imageUrls.length === 0) {
    throw new Error("At least one image URL is required");
  }

  if (input.imageUrls.length > 4) {
    // GPT-4o vision has limits, use first 4 images
    console.warn("More than 4 images provided, using first 4 only");
    input.imageUrls = input.imageUrls.slice(0, 4);
  }

  const client = getOpenAIClient();

  // Build the content array with images
  const imageContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = input.imageUrls.map(
    (url) => ({
      type: "image_url" as const,
      image_url: {
        url,
        detail: "high" as const, // Use high detail for better analysis
      },
    })
  );

  // Add the text prompt
  const textContent: OpenAI.Chat.Completions.ChatCompletionContentPart = {
    type: "text" as const,
    text: buildUserPrompt(input),
  };

  try {
    const response = await client.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        {
          role: "system",
          content: buildSystemPrompt(input.targetPlatform),
        },
        {
          role: "user",
          content: [...imageContent, textContent],
        },
      ],
      max_tokens: 2000,
      temperature: 0.3, // Lower temperature for more consistent outputs
      response_format: { type: "json_object" }, // Request JSON response
    });

    // Extract the response content
    const messageContent = response.choices[0]?.message?.content;
    if (!messageContent) {
      throw new Error("Empty response from OpenAI API");
    }

    // Parse the response
    const aiResponse = parseAIResponse(messageContent);

    // Build the final result with normalization
    const result: GeneratedListing = {
      title: enforceTitleLength(aiResponse.title, input.targetPlatform),
      description: aiResponse.description,
      suggestedPrice: {
        min: Math.max(0, aiResponse.suggestedPrice.min),
        max: Math.max(0, aiResponse.suggestedPrice.max),
        recommended: Math.max(0, aiResponse.suggestedPrice.recommended),
      },
      category: {
        suggested: aiResponse.category.suggested,
        ebayId: aiResponse.category.ebayId || undefined,
        confidence: Math.min(1, Math.max(0, aiResponse.category.confidence)),
      },
      condition: {
        suggested: normalizeCondition(aiResponse.condition.suggested),
        confidence: Math.min(1, Math.max(0, aiResponse.condition.confidence)),
      },
      itemSpecifics: (aiResponse.itemSpecifics || []).map((spec) => ({
        name: spec.name,
        value: spec.value,
        confidence: Math.min(1, Math.max(0, spec.confidence)),
      })),
      overallConfidence: Math.min(1, Math.max(0, aiResponse.overallConfidence)),
      tokensUsed: response.usage?.total_tokens || 0,
    };

    // Ensure price sanity (max >= recommended >= min)
    if (result.suggestedPrice.min > result.suggestedPrice.recommended) {
      result.suggestedPrice.min = result.suggestedPrice.recommended * 0.8;
    }
    if (result.suggestedPrice.max < result.suggestedPrice.recommended) {
      result.suggestedPrice.max = result.suggestedPrice.recommended * 1.3;
    }

    return result;
  } catch (error) {
    // Handle specific OpenAI errors
    if (error instanceof OpenAI.APIError) {
      if (error.status === 401) {
        throw new Error("Invalid OpenAI API key. Please check your configuration.");
      }
      if (error.status === 429) {
        throw new Error("OpenAI rate limit exceeded. Please try again in a moment.");
      }
      if (error.status === 500) {
        throw new Error("OpenAI service error. Please try again.");
      }
      throw new Error(`OpenAI API error: ${error.message}`);
    }

    // Re-throw other errors
    throw error;
  }
}

// ============ EXPORTS ============

export const aiListingService = {
  generateListing,
};

export default aiListingService;
