export function toggleSelection(
  selected: ReadonlySet<string>,
  id: string
): Set<string> {
  const next = new Set(selected)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

export function selectRange(
  orderedIds: readonly string[],
  anchorId: string | null,
  targetId: string
): Set<string> {
  if (!anchorId) return new Set([targetId])
  const anchorIndex = orderedIds.indexOf(anchorId)
  const targetIndex = orderedIds.indexOf(targetId)
  if (anchorIndex < 0 || targetIndex < 0) return new Set([targetId])
  const start = Math.min(anchorIndex, targetIndex)
  const end = Math.max(anchorIndex, targetIndex)
  return new Set(orderedIds.slice(start, end + 1))
}

export function pruneSelection(
  selected: ReadonlySet<string>,
  availableIds: readonly string[]
): Set<string> {
  const available = new Set(availableIds)
  return new Set([...selected].filter((id) => available.has(id)))
}
