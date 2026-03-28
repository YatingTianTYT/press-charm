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
  tags: string[]
}

// Predefined tags the AI should pick from
const STYLE_TAGS = ['Floral', 'Glitter', 'French', 'Minimal', 'Art', 'Ombre', 'Gems']
const VIBE_TAGS = ['Elegant', 'Cute', 'Bold']
const COLOR_TAGS = ['Pink', 'Red', 'Nude', 'White', 'Black', 'Blue', 'Green', 'Purple', 'Gold', 'Silver', 'Multicolor']
const ALL_TAGS = [...STYLE_TAGS, ...VIBE_TAGS, ...COLOR_TAGS]

export { STYLE_TAGS, VIBE_TAGS, COLOR_TAGS, ALL_TAGS }

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
- tags: An array of tags from this predefined list. Pick ALL that apply:
  Style: ${STYLE_TAGS.join(', ')}
  Vibe: ${VIBE_TAGS.join(', ')}
  Colors: ${COLOR_TAGS.join(', ')}
  Pick 2-5 tags that best describe the nail set. Always include at least one color tag.

Return ONLY valid JSON, no markdown or extra text.`,
          },
        ],
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  const result = JSON.parse(cleaned)

  // Validate tags against allowed list
  const validTags = (result.tags || []).filter((t: string) =>
    ALL_TAGS.includes(t)
  )

  return {
    title: result.title,
    description: result.description,
    price: result.price,
    features: result.features,
    careInstructions: result.careInstructions,
    tags: validTags,
  }
}
