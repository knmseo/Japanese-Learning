import kuromoji, { type IpadicFeatures, type Tokenizer } from '@sglkc/kuromoji'

export type Token = {
  /** Surface form as it appears in the sentence. */
  word: string
  /** 品詞 — part of speech. */
  pos: string
  /** 原形 — dictionary form, so conjugated verbs match their concept. */
  dictionaryForm: string
}

/** Copied out of node_modules into public/ by scripts/copy-dict.mjs. */
const DICT_PATH = '/kuromoji-dict/'

let tokenizerPromise: Promise<Tokenizer<IpadicFeatures>> | undefined

/** The IPADIC dictionary is ~18MB, so it loads once, lazily, on first use. */
function getTokenizer(): Promise<Tokenizer<IpadicFeatures>> {
  tokenizerPromise ??= new Promise((resolve, reject) => {
    kuromoji.builder({ dicPath: DICT_PATH }).build((err, tokenizer) => {
      if (err) reject(err)
      else resolve(tokenizer)
    })
  })
  return tokenizerPromise
}

export async function tokenize(text: string): Promise<Token[]> {
  const tokenizer = await getTokenizer()
  return tokenizer.tokenize(text).map((t) => ({
    word: t.surface_form,
    pos: t.pos,
    dictionaryForm: t.basic_form && t.basic_form !== '*' ? t.basic_form : t.surface_form,
  }))
}
