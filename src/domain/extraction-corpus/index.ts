export {
  AI_CONTEXT_OVERLAP_CHARS,
  AI_CONTEXT_WINDOW_CHARS,
  CORPUS_COMPLETENESS_STATES,
  type AuthoritativeCorpus,
  type CorpusChunk,
  type CorpusCompleteness,
} from "./types";
export { assertCompleteChunkCoverage, chunkAuthoritativeCorpus } from "./chunk";
export {
  buildAuthoritativeCorpus,
  corpusCompletenessFromExtract,
  isSourceTruncated,
} from "./completeness";
