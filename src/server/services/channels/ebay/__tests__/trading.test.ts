/**
 * eBay Trading API Client Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  EbayTradingClient,
  buildRespondToBestOfferXml,
  parseRespondToBestOfferResponse,
  type RespondToBestOfferInput,
} from "../trading";
import { ChannelApiError } from "../../types";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("buildRespondToBestOfferXml", () => {
  it("should build Accept XML correctly", () => {
    const input: RespondToBestOfferInput = {
      itemId: "123456789",
      bestOfferIds: ["offer-001"],
      action: "Accept",
    };

    const xml = buildRespondToBestOfferXml(input);

    expect(xml).toContain("<ItemID>123456789</ItemID>");
    expect(xml).toContain("<BestOfferID>offer-001</BestOfferID>");
    expect(xml).toContain("<Action>Accept</Action>");
    expect(xml).not.toContain("<CounterOfferPrice");
    expect(xml).not.toContain("<SellerResponse>");
  });

  it("should build Decline XML correctly", () => {
    const input: RespondToBestOfferInput = {
      itemId: "123456789",
      bestOfferIds: ["offer-001"],
      action: "Decline",
      sellerMessage: "Sorry, this offer is too low.",
    };

    const xml = buildRespondToBestOfferXml(input);

    expect(xml).toContain("<Action>Decline</Action>");
    expect(xml).toContain("<SellerResponse>Sorry, this offer is too low.</SellerResponse>");
  });

  it("should build Counter XML with price", () => {
    const input: RespondToBestOfferInput = {
      itemId: "123456789",
      bestOfferIds: ["offer-001"],
      action: "Counter",
      counterOfferPrice: 45.99,
      counterOfferCurrency: "USD",
    };

    const xml = buildRespondToBestOfferXml(input);

    expect(xml).toContain("<Action>Counter</Action>");
    expect(xml).toContain('<CounterOfferPrice currencyID="USD">45.99</CounterOfferPrice>');
  });

  it("should handle multiple offer IDs", () => {
    const input: RespondToBestOfferInput = {
      itemId: "123456789",
      bestOfferIds: ["offer-001", "offer-002", "offer-003"],
      action: "Decline",
    };

    const xml = buildRespondToBestOfferXml(input);

    expect(xml).toContain("<BestOfferID>offer-001</BestOfferID>");
    expect(xml).toContain("<BestOfferID>offer-002</BestOfferID>");
    expect(xml).toContain("<BestOfferID>offer-003</BestOfferID>");
  });

  it("should escape special XML characters", () => {
    const input: RespondToBestOfferInput = {
      itemId: "123456789",
      bestOfferIds: ["offer-001"],
      action: "Decline",
      sellerMessage: 'Price is <too low> for "this" item & more',
    };

    const xml = buildRespondToBestOfferXml(input);

    expect(xml).toContain("&lt;too low&gt;");
    expect(xml).toContain("&quot;this&quot;");
    expect(xml).toContain("item &amp; more");
  });

  it("should truncate seller message to 500 characters", () => {
    const input: RespondToBestOfferInput = {
      itemId: "123456789",
      bestOfferIds: ["offer-001"],
      action: "Decline",
      sellerMessage: "A".repeat(600),
    };

    const xml = buildRespondToBestOfferXml(input);

    // Extract the seller response content
    const match = xml.match(/<SellerResponse>([^<]*)<\/SellerResponse>/);
    expect(match).not.toBeNull();
    expect(match![1].length).toBe(500);
  });

  it("should default counter currency to USD", () => {
    const input: RespondToBestOfferInput = {
      itemId: "123456789",
      bestOfferIds: ["offer-001"],
      action: "Counter",
      counterOfferPrice: 50.0,
    };

    const xml = buildRespondToBestOfferXml(input);

    expect(xml).toContain('currencyID="USD"');
  });
});

describe("parseRespondToBestOfferResponse", () => {
  it("should parse a successful response", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<RespondToBestOfferResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Ack>Success</Ack>
  <RespondToBestOffer>
    <BestOfferID>offer-001</BestOfferID>
    <Ack>Success</Ack>
  </RespondToBestOffer>
</RespondToBestOfferResponse>`;

    const result = parseRespondToBestOfferResponse(xml);

    expect(result.success).toBe(true);
    expect(result.responses).toHaveLength(1);
    expect(result.responses[0].bestOfferId).toBe("offer-001");
    expect(result.responses[0].success).toBe(true);
  });

  it("should parse a failure response with error details", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<RespondToBestOfferResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Ack>Failure</Ack>
  <Errors>
    <ErrorCode>21916284</ErrorCode>
    <ShortMessage>Best Offer has expired</ShortMessage>
    <LongMessage>The Best Offer you are trying to respond to has already expired.</LongMessage>
  </Errors>
</RespondToBestOfferResponse>`;

    const result = parseRespondToBestOfferResponse(xml);

    expect(result.success).toBe(false);
    expect(result.error).toContain("21916284");
    expect(result.error).toContain("Best Offer you are trying to respond to has already expired");
  });

  it("should handle Warning ack as success", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<RespondToBestOfferResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Ack>Warning</Ack>
  <RespondToBestOffer>
    <BestOfferID>offer-001</BestOfferID>
    <Ack>Success</Ack>
  </RespondToBestOffer>
</RespondToBestOfferResponse>`;

    const result = parseRespondToBestOfferResponse(xml);

    expect(result.success).toBe(true);
  });

  it("should handle multiple error blocks", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<RespondToBestOfferResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Ack>Failure</Ack>
  <Errors>
    <ErrorCode>100</ErrorCode>
    <ShortMessage>Error 1</ShortMessage>
    <LongMessage>First error occurred</LongMessage>
  </Errors>
  <Errors>
    <ErrorCode>200</ErrorCode>
    <ShortMessage>Error 2</ShortMessage>
    <LongMessage>Second error occurred</LongMessage>
  </Errors>
</RespondToBestOfferResponse>`;

    const result = parseRespondToBestOfferResponse(xml);

    expect(result.success).toBe(false);
    expect(result.error).toContain("100");
    expect(result.error).toContain("200");
    expect(result.error).toContain("First error occurred");
    expect(result.error).toContain("Second error occurred");
  });
});

describe("EbayTradingClient", () => {
  let client: EbayTradingClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new EbayTradingClient("sandbox");
  });

  describe("makeRequest", () => {
    it("should send correct headers for Trading API calls", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue("<Ack>Success</Ack>"),
      });

      await client.makeRequest("RespondToBestOffer", "test-token", "<xml/>");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.sandbox.ebay.com/ws/api.dll",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "text/xml",
            "X-EBAY-API-CALL-NAME": "RespondToBestOffer",
            "X-EBAY-API-SITEID": "0",
            "X-EBAY-API-COMPATIBILITY-LEVEL": "1349",
            "X-EBAY-API-IAF-TOKEN": "test-token",
          },
          body: "<xml/>",
        })
      );
    });

    it("should throw ChannelApiError on HTTP error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue("Internal Server Error"),
      });

      await expect(
        client.makeRequest("RespondToBestOffer", "test-token", "<xml/>")
      ).rejects.toThrow(ChannelApiError);
    });

    it("should mark 500 errors as retryable", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue("Internal Server Error"),
      });

      try {
        await client.makeRequest("RespondToBestOffer", "test-token", "<xml/>");
      } catch (error) {
        expect(error).toBeInstanceOf(ChannelApiError);
        expect((error as ChannelApiError).retryable).toBe(true);
      }
    });

    it("should mark 400 errors as non-retryable", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: vi.fn().mockResolvedValue("Bad Request"),
      });

      try {
        await client.makeRequest("RespondToBestOffer", "test-token", "<xml/>");
      } catch (error) {
        expect(error).toBeInstanceOf(ChannelApiError);
        expect((error as ChannelApiError).retryable).toBe(false);
      }
    });

    it("should use production URL when configured", async () => {
      const prodClient = new EbayTradingClient("production");
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue("<Ack>Success</Ack>"),
      });

      await prodClient.makeRequest("RespondToBestOffer", "test-token", "<xml/>");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.ebay.com/ws/api.dll",
        expect.anything()
      );
    });
  });

  describe("respondToBestOffer", () => {
    it("should accept an offer successfully", async () => {
      const successXml = `<?xml version="1.0" encoding="UTF-8"?>
<RespondToBestOfferResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Ack>Success</Ack>
  <RespondToBestOffer>
    <BestOfferID>offer-001</BestOfferID>
    <Ack>Success</Ack>
  </RespondToBestOffer>
</RespondToBestOfferResponse>`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(successXml),
      });

      const result = await client.respondToBestOffer("test-token", {
        itemId: "123456789",
        bestOfferIds: ["offer-001"],
        action: "Accept",
      });

      expect(result.success).toBe(true);
      expect(result.responses).toHaveLength(1);
      expect(result.responses[0].bestOfferId).toBe("offer-001");
    });

    it("should decline an offer with a message", async () => {
      const successXml = `<?xml version="1.0" encoding="UTF-8"?>
<RespondToBestOfferResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Ack>Success</Ack>
  <RespondToBestOffer>
    <BestOfferID>offer-002</BestOfferID>
    <Ack>Success</Ack>
  </RespondToBestOffer>
</RespondToBestOfferResponse>`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(successXml),
      });

      const result = await client.respondToBestOffer("test-token", {
        itemId: "123456789",
        bestOfferIds: ["offer-002"],
        action: "Decline",
        sellerMessage: "Sorry, this offer is too low.",
      });

      expect(result.success).toBe(true);

      // Verify the request body contains the seller message
      const requestBody = mockFetch.mock.calls[0][1].body;
      expect(requestBody).toContain("<SellerResponse>Sorry, this offer is too low.</SellerResponse>");
    });

    it("should counter an offer with a price", async () => {
      const successXml = `<?xml version="1.0" encoding="UTF-8"?>
<RespondToBestOfferResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Ack>Success</Ack>
  <RespondToBestOffer>
    <BestOfferID>offer-003</BestOfferID>
    <Ack>Success</Ack>
  </RespondToBestOffer>
</RespondToBestOfferResponse>`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(successXml),
      });

      const result = await client.respondToBestOffer("test-token", {
        itemId: "123456789",
        bestOfferIds: ["offer-003"],
        action: "Counter",
        counterOfferPrice: 75.5,
      });

      expect(result.success).toBe(true);

      // Verify counter offer price in request body
      const requestBody = mockFetch.mock.calls[0][1].body;
      expect(requestBody).toContain('currencyID="USD">75.50</CounterOfferPrice>');
    });

    it("should return error when counter has no price", async () => {
      const result = await client.respondToBestOffer("test-token", {
        itemId: "123456789",
        bestOfferIds: ["offer-003"],
        action: "Counter",
        // Missing counterOfferPrice
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Counter offer requires a price");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should handle API failure response", async () => {
      const failureXml = `<?xml version="1.0" encoding="UTF-8"?>
<RespondToBestOfferResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Ack>Failure</Ack>
  <Errors>
    <ErrorCode>21916284</ErrorCode>
    <ShortMessage>Best Offer has expired</ShortMessage>
    <LongMessage>The Best Offer has expired and can no longer be responded to.</LongMessage>
  </Errors>
</RespondToBestOfferResponse>`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(failureXml),
      });

      const result = await client.respondToBestOffer("test-token", {
        itemId: "123456789",
        bestOfferIds: ["offer-expired"],
        action: "Accept",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("expired");
    });

    it("should handle HTTP-level errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue("Internal Server Error"),
      });

      await expect(
        client.respondToBestOffer("test-token", {
          itemId: "123456789",
          bestOfferIds: ["offer-001"],
          action: "Accept",
        })
      ).rejects.toThrow(ChannelApiError);
    });
  });
});
