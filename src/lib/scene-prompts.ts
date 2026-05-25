/**
 * Prompt templates for the 3-scene product image set generated from a single
 * raw nail photo. Each prompt is structured to fight the AI's instinct to
 * "creatively reinterpret" the nail design — they all hammer on pixel-level
 * preservation, which is the actual job.
 *
 * Shared by both providers (Gemini + OpenAI gpt-image-1), since the
 * underlying instruction is the same.
 */

export type Scene = 'product' | 'closeup' | 'lifestyle'

export interface ScenePrompt {
  scene: Scene
  label: string
  emoji: string
  prompt: string
}

const PRESERVATION_RUBRIC = `CRITICAL CONSTRAINTS — read carefully:
1. The nails in the input photo are the FINAL product. Do NOT redesign, restyle, recolor, repaint, or "improve" them.
2. Copy the nail design pixel-for-pixel: every color, gradient, glitter speck, hand-painted line, gem placement, base shade, tip shape, and length must be IDENTICAL to the input.
3. Treat the nails as a sticker / decal that you are placing into the scene — change only orientation/perspective, never the artwork itself.
4. If a nail in the input has 3 dots, your output has 3 dots in the same positions. Same goes for tip lines, gradients, gems, glitter — preserve all.
5. If you cannot preserve the exact nail design, return the input image UNCHANGED rather than producing a re-imagined version.
6. Output ONLY the image. No text, no watermark, no signature.`

export const SCENES: ScenePrompt[] = [
  {
    scene: 'product',
    label: 'Product shot',
    emoji: '💅',
    prompt: `TASK: Generate a clean, magazine-quality product photograph of the press-on nail set from the input image.

${PRESERVATION_RUBRIC}

SCENE COMPOSITION:
- Top-down flat-lay arrangement: all 10 nails laid out in two neat rows of 5 (one row per hand), tips pointing inward or arranged symmetrically.
- Background: soft cream / warm off-white textured surface (linen, marble, or matte paper).
- Lighting: soft diffused daylight from one direction, gentle shadow.
- Optional minimal styling element nearby: a single dried flower stem, a small folded piece of brand tissue paper, or a thin gold ring — but DO NOT add anything covering the nails.
- Style: indie handmade brand aesthetic, similar to Glossier or Hermès small-batch photography.
- Color palette: warm cream, terracotta, dusty rose, matte gold accents.`,
  },
  {
    scene: 'closeup',
    label: 'Hand close-up',
    emoji: '✋',
    prompt: `TASK: Generate a tight close-up product photo of the press-on nail set WORN on a human hand.

${PRESERVATION_RUBRIC}

SCENE COMPOSITION:
- A relaxed, elegant female hand visible from fingertip to mid-forearm.
- Hand pose: fingers gracefully relaxed, slightly spread so all 5 nails are clearly visible. Three-quarter angle or palm-down.
- Lighting: soft natural light, no harsh shadows.
- Background: clean cream / off-white minimal background, slightly blurred.
- Skin tone: neutral medium-light.
- Composition: nails take up ~40-60% of frame. Hand is the subject.
- Photo style: professional product photography, soft matte finish, magazine-quality.`,
  },
  {
    scene: 'lifestyle',
    label: 'Lifestyle',
    emoji: '☕',
    prompt: `TASK: Generate a lifestyle scene photograph where a female hand wearing the press-on nail set holds an everyday object, in a way that naturally showcases the nails.

${PRESERVATION_RUBRIC}

SCENE COMPOSITION:
- Pick ONE of these lifestyle moments: (a) hand wrapped around a ceramic latte cup with foam art; (b) hand holding a small bouquet of dried flowers; (c) hand resting on the edge of an open hardcover book.
- The chosen object must be soft, warm, and visually unobtrusive — never compete with the nails for attention.
- Lighting: warm afternoon natural light, soft golden quality.
- Background: out-of-focus indie cafe or sunlit bedroom, neutral creams and terracottas, no people in background.
- Hand pose: nails clearly visible, occupying ~30-50% of frame.
- Photo style: lifestyle product photography, casual but composed, mood-driven. Similar to Aesop or Le Labo brand imagery.`,
  },
]

export function getScenePrompt(scene: Scene): ScenePrompt {
  const found = SCENES.find((s) => s.scene === scene)
  if (!found) throw new Error(`Unknown scene: ${scene}`)
  return found
}
