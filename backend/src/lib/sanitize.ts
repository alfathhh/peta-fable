type RecordLike = Record<string, unknown>;

export function sanitizeInfrastructure<T extends RecordLike>(record: T) {
  const { photoPath, ...safe } = record;
  const id = String(record.id);
  return {
    ...safe,
    photo_url: photoPath ? `/api/infrastructures/${id}/photo?size=full` : null,
    photo_thumb_url: photoPath ? `/api/infrastructures/${id}/photo?size=thumb` : null,
  };
}

export function sanitizeLayer<T extends RecordLike>(record: T) {
  const safe = { ...record };
  delete safe.geojsonPath;
  return safe;
}
