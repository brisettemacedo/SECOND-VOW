export function claimResolution(claim: any) {
  const value = claim?.claim_resolutions;
  return (Array.isArray(value) ? value[0] : value) ?? null;
}
