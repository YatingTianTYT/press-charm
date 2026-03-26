import Anthropic from '@anthropic-ai/sdk'

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

interface AIListingResult {
  title: string
  description: string
  price: number // in cents
  features: string[]
  careInstructions: string
}

export async function analyzeNailImage(
  imageBase64: string,
  mimeType: string
): Promise<AIListingResult> {
  const response = await getClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: `You are a copywriter for an indie handmade press-on nail brand called Press Charm. Analyze this image of press-on nails and generate a product listing.

Return a JSON object with these fields:
- title: A catchy, descriptive product name (e.g. "Rose Gold Glitter Dreams")
- description: A compelling 2-3 sentence product description highlighting the design, style, and occasion
- price: Suggested retail price in cents (typical range 1500-3500, i.e. $15-$35)
- features: An array of 4 key features/highlights (e.g. "Handmade with premium gel", "Includes 10 nails in assorted sizes")
- careInstructions: Brief care instructions for press-on nails

Return ONLY valid JSON, no markdown or extra text.`,
          },
        ],
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  const result = JSON.parse(cleaned)

  return {
    title: result.title,
    description: result.description,
    price: result.price,
    features: result.features,
    careInstructions: result.careInstructions,
  }
}
