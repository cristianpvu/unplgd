import type Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_MODEL } from './client.js';
import { claudeMessages } from './usage.js';
import { extractJsonBlock } from './jsonExtract.js';
import { coCreationValidatorPrompt } from './cocreationPrompts.js';

export type CoCreationValidation = {
  valid: boolean;
  reason: string;
  scenePrompt: string;
};

function isValidation(x: unknown): x is CoCreationValidation {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.valid === 'boolean' &&
    typeof o.reason === 'string' &&
    typeof o.scenePrompt === 'string'
  );
}

export type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

// Apel Claude vision: primeste poza desenului (base64) + textul povestii;
// returneaza JSON cu valid/reason/scenePrompt. Throw daca AI-ul raspunde
// invalid — caller-ul (ruta) marcheaza sesiunea FAILED.
export async function validateCoCreation(
  imageBase64: string,
  mediaType: ImageMediaType,
  storyTitle: string,
  storyBody: string,
): Promise<CoCreationValidation> {
  const completion = await claudeMessages({
    model: ANTHROPIC_MODEL,
    max_tokens: 512,
    system: coCreationValidatorPrompt(storyTitle, storyBody),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: imageBase64 },
          },
          {
            type: 'text',
            text: 'Asta e desenul. Valideaza si scrie scenePrompt-ul pentru Imagen.',
          },
        ],
      },
    ],
  }, 'cocreation_validate');

  const replyText = completion.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();

  const json = extractJsonBlock(replyText);
  if (!isValidation(json)) {
    throw new Error(`AI returned invalid validation JSON: ${replyText.slice(0, 200)}`);
  }

  return json;
}
