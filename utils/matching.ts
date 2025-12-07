
import { WordEntry } from "../types";

/**
 * Shared logic for finding fuzzy matches in Chinese text using Intl.Segmenter.
 * Used by both the Content Script (for actual replacement) and the Settings Preview (for demo).
 */
export const findFuzzyMatches = (sourceText: string, candidates: WordEntry[]): { text: string, entry: WordEntry }[] => {
    // Use Chrome's native Intl.Segmenter for word segmentation
    // Casting to any because TS definition might be missing in some environments
    const segmenter = new (Intl as any).Segmenter('zh-CN', { granularity: 'word' });
    const segments = Array.from((segmenter as any).segment(sourceText)).map((s: any) => s.segment as string);
    const uniqueSegments = [...new Set(segments)]; // Dedupe

    const matches: { text: string, entry: WordEntry }[] = [];

    for (const seg of uniqueSegments) {
        if (!/[\u4e00-\u9fa5]/.test(seg)) continue; // Skip non-Chinese

        let bestMatch: WordEntry | null = null;
        let bestScore = 0; // 3=Exact, 2=SegContainsDict, 1=DictContainsSeg

        for (const entry of candidates) {
            if (!entry.translation) continue;
            const dict = entry.translation;

            // 1. Exact Match
            if (seg === dict) {
                if (bestScore < 3) { bestScore = 3; bestMatch = entry; }
            } 
            // 2. Segment contains Dictionary Word (e.g. Dict="开心", Seg="开心地")
            else if (seg.includes(dict)) {
                if (bestScore < 2) { bestScore = 2; bestMatch = entry; }
            }
            // 3. Dictionary Word contains Segment (e.g. Dict="很多种", Seg="很多")
            // Only allow if segment is meaningful (length >= 2 or dict is short)
            else if (dict.includes(seg)) {
                    if (seg.length >= 2 || dict.length <= 2) {
                    if (bestScore < 1) { bestScore = 1; bestMatch = entry; }
                    }
            }
        }

        if (bestMatch) {
            matches.push({ text: seg, entry: bestMatch });
        }
    }
    return matches;
};
