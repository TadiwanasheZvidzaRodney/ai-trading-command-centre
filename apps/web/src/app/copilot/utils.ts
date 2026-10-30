export function extractTradeIdeas(
  markdown: string,
): Array<{ title: string; details: string[] }> {
  const ideas = [];
  const lines = markdown.split('\n');
  let current: { title: string; details: string[] } | null = null;

  for (const line of lines) {
    if (line.match(/^#{3,4}\s+Idea/i)) {
      if (current) ideas.push(current);
      current = { title: line.replace(/^#+\s+/, ''), details: [] };
    } else if (current && line.startsWith('- ')) {
      current.details.push(line.substring(2).trim());
    }
  }
  if (current) ideas.push(current);
  return ideas;
}

export function extractKeyAssumptions(markdown: string): string[] {
  const assumptions = [];
  const lines = markdown.split('\n');
  let inAssumptions = false;

  for (const line of lines) {
    if (line.match(/^#{2,4}\s+Assumptions/i)) {
      inAssumptions = true;
    } else if (inAssumptions) {
      if (line.match(/^#{2,4}\s+/)) {
        break;
      }
      if (line.startsWith('- ')) {
        assumptions.push(line.substring(2).trim());
      }
    }
  }
  return assumptions;
}

export function extractInvalidationConditions(markdown: string): string[] {
  const conditions = [];
  const lines = markdown.split('\n');
  let inInvalidation = false;

  for (const line of lines) {
    if (line.match(/^#{2,4}\s+Invalidation/i)) {
      inInvalidation = true;
    } else if (inInvalidation) {
      if (line.match(/^#{2,4}\s+/)) {
        break;
      }
      if (line.startsWith('- ')) {
        conditions.push(line.substring(2).trim());
      }
    }
  }
  return conditions;
}
