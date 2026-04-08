import type { MemoryStore, RetrievalProvider } from "./memory";
import type { RetrievalSnippet } from "./contracts";

type IndexedDocument = {
  sourceId: string;
  content: string;
};

type CreateInMemoryRetrievalProviderArgs = {
  documents: IndexedDocument[];
  maxResults?: number;
};

export function createInMemoryRetrievalProvider(
  args: CreateInMemoryRetrievalProviderArgs
): RetrievalProvider {
  const documents = args.documents;
  const maxResults = args.maxResults ?? 2;

  return {
    async retrieve(input) {
      const taskTerms = tokenize(input.task);
      const nodeTerms = tokenize(input.nodeInput);
      const roleTerms = tokenize(input.role);
      const queryTerms = [...taskTerms, ...nodeTerms, ...roleTerms];
      if (queryTerms.length === 0) {
        return [];
      }

      const ranked = documents
        .map((document) => {
          const score = rankDocument(document, input);
          if (score === 0) {
            return null;
          }
          return {
            sourceId: document.sourceId,
            content: document.content,
            relevance: score
          } satisfies RetrievalSnippet;
        })
        .filter((entry): entry is RetrievalSnippet => Boolean(entry))
        .sort((a, b) => (b.relevance ?? 0) - (a.relevance ?? 0))
        .slice(0, maxResults);

      return ranked;
    }
  };
}

export function createTaskAwareRetrievalProvider(args: {
  baseProvider: RetrievalProvider;
  memoryStore: MemoryStore;
  maxResults?: number;
}): RetrievalProvider {
  const maxResults = args.maxResults ?? 3;

  return {
    async retrieve(input) {
      const [baseResults, taskEntries] = await Promise.all([
        args.baseProvider.retrieve(input),
        args.memoryStore.getTaskEntries?.(input.taskId) ?? Promise.resolve([])
      ]);

      const memoryResults = (taskEntries ?? [])
        .map((entry) => {
          const score = rankDocument(
            {
              sourceId: entry.sourceId,
              content: entry.content
            },
            input
          );
          if (score === 0) {
            return null;
          }
          return {
            sourceId: entry.sourceId,
            content: entry.content,
            relevance: score
          } satisfies RetrievalSnippet;
        })
        .filter((entry): entry is RetrievalSnippet => Boolean(entry));

      return [...memoryResults, ...baseResults]
        .sort((a, b) => (b.relevance ?? 0) - (a.relevance ?? 0))
        .slice(0, maxResults);
    }
  };
}

function rankDocument(
  document: { sourceId: string; content: string },
  input: { task: string; nodeInput: string; role: string }
) {
  const taskTerms = tokenize(input.task);
  const nodeTerms = tokenize(input.nodeInput);
  const roleTerms = tokenize(input.role);
  const queryTerms = [...taskTerms, ...nodeTerms, ...roleTerms];
  const contentTerms = [...tokenize(document.sourceId), ...tokenize(document.content)];
  const score =
    countOverlap(nodeTerms, contentTerms) * 2 +
    countOverlap(taskTerms, contentTerms) +
    countOverlap(roleTerms, contentTerms) * 0.5;
  return score / Math.max(queryTerms.length, 1);
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3);
}

function countOverlap(queryTerms: string[], contentTerms: string[]): number {
  const contentSet = new Set(contentTerms);
  let overlap = 0;
  for (const term of new Set(queryTerms)) {
    if (contentSet.has(term)) {
      overlap += 1;
    }
  }
  return overlap;
}
