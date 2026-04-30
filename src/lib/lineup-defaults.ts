/** Pick the default field-position assignment for each batting slot from
 *  whatever positions the team actually has active. Two outfield setups are
 *  supported: 4 OF (LF/LCF/RCF/RF) when both center codes exist, otherwise
 *  3 OF (LF/CF/RF). Codes the team doesn't have are dropped — slots past the
 *  end fall through to "BN" at the call site. */
export function defaultFieldCodes(positions: { code: string }[]): string[] {
  const active = new Set(positions.map((p) => p.code));
  const has4OF = active.has("LCF") && active.has("RCF");
  const ordered = has4OF
    ? ["P", "C", "1B", "2B", "3B", "SS", "LF", "LCF", "RCF", "RF"]
    : ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];
  return ordered.filter((code) => active.has(code));
}
