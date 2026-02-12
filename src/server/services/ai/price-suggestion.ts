/**
 * AI Price Suggestion Service
 *
 * Uses OpenAI GPT-4o to analyze item details and images,
 * then suggests competitive pricing for resale marketplaces.
 *
 * Considers: brand, condition, category, comparable sales,
 * marketplace fees, and platform-specific pricing norms.
 */

import OpenAI from "openai";

// ============ CONFIGURATION ============

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const DEFAULT_MODEL = "gpt-4o";

// ============ TYPES ============

export interface PriceSuggestionInput {
  /** Item title */
  title: string;
  /** Item description */
  description?: string;
  /** Item condition */
  condition: "new" | "like_new" | "good" | "fair" | "poor";
  /** Item category (user-provided or AI-suggested) */
  category?: string;
  /** Brand name */
  brand?: string;
  /** Optional image URLs for visual analysis */
  imageUrls?: string[];
  /** Target marketplace */
  targetPlatform: "ebay" | "poshmark" | "mercari";
  /** User's cost basis (what they paid) */
  costBasis?: number;
  /** Original retail price if known */
  originalRetailPrice?: number;
}

export interface PriceSuggestionResult {
  /** Suggested price range */
  suggestedPrice: {
    /** Low end - fast sale price */
    min: number;
    /** High end - patient pricing */
    max: number;
    /** Recommended list price balancing speed and profit */
    recommended: number;
  };
  /** Suggested floor price (lowest acceptable offer) */
  floorPrice: number;
  /** Estimated profit at recommended price */
  estimatedProfit?: {
    gross: number;
    platformFees: number;
    shippingEstimate: number;
    net: number;
  };
  /** Pricing rationale */
  reasoning: string;
  /** Comparable items context */
  comparables: string;
  /** Overall confidence in the suggestion (0-1) */
  confidence: number;
  /** Tokens used for this request */
  tokensUsed: number;
}

// ============ INTERNAL TYPES ============

interface AIPriceResponse {
  suggestedPrice: {
    min: number;
    max: number;
    recommended: number;
  };
  floorPrice: number;
  reasoning: string;
  comparables: string;
  confidence: number;
}

// ============ CLIENT ============

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (openaiClient) return openaiClient;

  if (!OPENAI_API_KEY) {
    throw new Error(
      "Missing OPENAI_API_KEY environment variable. Please set it in .env.local"
    );
  }

  openaiClient = new OpenAI({ apiKey: OPENAI_API_KEY });
  return openaiClient;
}

// ============ PLATFORM FEES ============

/** Estimated platform fee percentages */
const PLATFORM_FEES: Record<string, number> = {
  ebay: 0.1313, // 13.13% (12.9% FVF + 0.30 insertion avg)
  poshmark: 0.20, // 20% flat
  mercari: 0.10, // 10%
};

const SHIPPING_ESTIMATES: Record<string, number> = {
  ebay: 8.0,
  poshmark: 7.97, // Poshmark flat rate
  mercari: 7.0,
};

// ============ PROMPT CONSTRUCTION ============

function buildPricePrompt(input: PriceSuggestionInput): string {
  const parts: string[] = [];

  parts.push(`Analyze this item and suggest pricing for ${input.targetPlatform}:`);
  parts.push(`- Title: ${input.title}`);
  parts.push(`- Condition: ${input.condition.replace("_", " ")}`);

  if (input.brand) parts.push(`- Brand: ${input.brand}`);
  if (input.category) parts.push(`- Category: ${input.category}`);
  if (input.description) parts.push(`- Description: ${input.description.substring(0, 500)}`);
  if (input.originalRetailPrice) {
    parts.push(`- Original retail price: $${input.originalRetailPrice}`);
  }
  if (input.costBasis) {
    parts.push(`- Seller's cost basis: $${input.costBasis}`);
  }

  parts.push("");
  parts.push(`Return a JSON object with this exact structure:
{
  "suggestedPrice": {
    "min": number (quick sale price in USD),
    "max": number (patient pricing in USD),
    "recommended": number (balanced list price in USD)
  },
  "floorPrice": number (lowest acceptable offer, typically 60-70% of recommended),
  "reasoning": "string (2-3 sentences explaining the pricing rationale)",
  "comparables": "string (brief note on what similar items sell for)",
  "confidence": number (0-1, how confident you are in this price)
}

Consider:
- Current resale market values for this type of item
- Brand prestige and demand
- Condition impact on value
- Platform-specific pricing norms (${input.targetPlatform})
- Seasonal demand if applicable
- Factor in that this is resale, not retail

Be realistic and practical. Prices should reflect actual resale market values.`);

  return parts.join("\n");
}

// ============ MAIN FUNCTION ============

/**
 * Get AI-powered price suggestion for an inventory item
 */
export async function suggestPrice(
  input: PriceSuggestionInput
): Promise<PriceSuggestionResult> {
  if (!input.title) {
    throw new Error("Item title is required for price suggestion");
  }

  const client = getOpenAIClient();

  // Build messages array
  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [];

  // Add images if provided
  if (input.imageUrls && input.imageUrls.length > 0) {
    for (const url of input.imageUrls.slice(0, 4)) {
      content.push({
        type: "image_url" as const,
        image_url: { url, detail: "low" as const },
      });
    }
  }

  // Add the text prompt
  content.push({
    type: "text" as const,
    text: buildPricePrompt(input),
  });

  try {
    const response = await client.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        {
          role: "system",
          content: `You are an expert resale pricing analyst. You have deep knowledge of secondhand market values across eBay, Poshmark, and Mercari. You analyze items and suggest competitive prices that balance profit and sell-through rate. Respond ONLY with valid JSON.`,
        },
        {
          role: "user",
          content,
        },
      ],
      max_tokens: 800,
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const messageContent = response.choices[0]?.message?.content;
    if (!messageContent) {
      throw new Error("Empty response from OpenAI API");
    }

    // Parse response
    let jsonString = messageContent;
    const jsonMatch = messageContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonString = jsonMatch[1].trim();
    }

    const aiResponse: AIPriceResponse = JSON.parse(jsonString);

    // Validate and clamp prices
    const recommended = Math.max(1, aiResponse.suggestedPrice.recommended);
    const min = Math.max(1, Math.min(aiResponse.suggestedPrice.min, recommended));
    const max = Math.max(recommended, aiResponse.suggestedPrice.max);
    const floorPrice = Math.max(1, Math.min(aiResponse.floorPrice, min));
    const confidence = Math.min(1, Math.max(0, aiResponse.confidence));

    // Calculate estimated profit if cost basis is provided
    let estimatedProfit: PriceSuggestionResult["estimatedProfit"];
    if (input.costBasis !== undefined) {
      const feeRate = PLATFORM_FEES[input.targetPlatform] ?? 0.13;
      const shippingEstimate = SHIPPING_ESTIMATES[input.targetPlatform] ?? 8;
      const platformFees = recommended * feeRate;
      const net = recommended - platformFees - shippingEstimate - input.costBasis;

      estimatedProfit = {
        gross: recommended - input.costBasis,
        platformFees: Math.round(platformFees * 100) / 100,
        shippingEstimate,
        net: Math.round(net * 100) / 100,
      };
    }

    return {
      suggestedPrice: {
        min: Math.round(min * 100) / 100,
        max: Math.round(max * 100) / 100,
        recommended: Math.round(recommended * 100) / 100,
      },
      floorPrice: Math.round(floorPrice * 100) / 100,
      estimatedProfit,
      reasoning: aiResponse.reasoning,
      comparables: aiResponse.comparables,
      confidence,
      tokensUsed: response.usage?.total_tokens || 0,
    };
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      if (error.status === 401) {
        throw new Error("Invalid OpenAI API key");
      }
      if (error.status === 429) {
        throw new Error("OpenAI rate limit exceeded. Please try again in a moment.");
      }
      throw new Error(`OpenAI API error: ${error.message}`);
    }
    throw error;
  }
}

// ============ EXPORTS ============

export const priceSuggestionService = {
  suggestPrice,
};
