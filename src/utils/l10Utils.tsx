import React from 'react';

export interface ParsedL10 {
  homeL: number;
  homeD: number;
  homeW: number;
  awayW: number;
  awayD: number;
  awayL: number;
  homeWins: number;
  awayWins: number;
  isValid: boolean;
  isDetailed: boolean;
  raw: string;
}

/**
 * Universal parser for L10 strings.
 * Supports:
 * 1. Detailed LDW:WDL format: "2;1;7:9;1;0"
 *    - Home: 2 losses, 1 draw, 7 wins (LDW, homeWins = 7)
 *    - Away: 9 wins, 1 draw, 0 losses (WDL, awayWins = 9)
 * 2. Legacy H:A win format: "7:9"
 *    - homeWins = 7, awayWins = 9
 */
export function parseL10(l10?: string | null): ParsedL10 {
  const fallback: ParsedL10 = {
    homeL: 0,
    homeD: 0,
    homeW: 0,
    awayW: 0,
    awayD: 0,
    awayL: 0,
    homeWins: 0,
    awayWins: 0,
    isValid: false,
    isDetailed: false,
    raw: l10 || ''
  };

  if (!l10 || typeof l10 !== 'string') return fallback;
  const str = l10.trim();
  if (str === '' || str === '-' || str === 'NA' || str === 'Unknown') return fallback;

  // Split on primary colon separator
  const parts = str.split(':');
  if (parts.length !== 2) return fallback;

  const homePart = parts[0].trim();
  const awayPart = parts[1].trim();

  // Case 1: Detailed LDW:WDL format with semicolons or commas
  if (homePart.includes(';') || awayPart.includes(';') || homePart.includes(',') || awayPart.includes(',')) {
    const hArr = homePart.split(/[;,]/).map(s => parseFloat(s.trim()));
    const aArr = awayPart.split(/[;,]/).map(s => parseFloat(s.trim()));

    // Home is LDW: index 0 = L, index 1 = D, index 2 = W
    const homeL = !isNaN(hArr[0]) ? hArr[0] : 0;
    const homeD = !isNaN(hArr[1]) ? hArr[1] : 0;
    const homeW = !isNaN(hArr[2]) ? hArr[2] : (hArr.length === 1 ? homeL : 0);

    // Away is WDL: index 0 = W, index 1 = D, index 2 = L
    const awayW = !isNaN(aArr[0]) ? aArr[0] : 0;
    const awayD = !isNaN(aArr[1]) ? aArr[1] : 0;
    const awayL = !isNaN(aArr[2]) ? aArr[2] : 0;

    return {
      homeL,
      homeD,
      homeW,
      awayW,
      awayD,
      awayL,
      homeWins: homeW,
      awayWins: awayW,
      isValid: true,
      isDetailed: true,
      raw: str
    };
  }

  // Case 2: Legacy H:A wins format e.g. "7:9"
  const hWins = parseFloat(homePart);
  const aWins = parseFloat(awayPart);

  if (!isNaN(hWins) && !isNaN(aWins)) {
    return {
      homeL: 0,
      homeD: 0,
      homeW: hWins,
      awayW: aWins,
      awayD: 0,
      awayL: 0,
      homeWins: hWins,
      awayWins: aWins,
      isValid: true,
      isDetailed: false,
      raw: str
    };
  }

  return fallback;
}

/**
 * For NerdyTips table view: Keeps losses and draws in the background
 * by returning just the win counts "H:A" (e.g. "7:9").
 */
export function formatL10ForNerdyTips(l10?: string | null): string {
  const parsed = parseL10(l10);
  if (!parsed.isValid) return l10 && l10 !== 'NA' ? l10 : '-';
  return `${parsed.homeWins}:${parsed.awayWins}`;
}

interface L10DisplayProps {
  l10?: string | null;
  className?: string;
  showPrefix?: boolean;
}

/**
 * Display component for Match Cards and Seer Optimized Slips.
 * 
 * Sizing rules:
 * - Home (LDW): Ascending order -> L is smallest (8.5px), D is medium (10px), W is largest (12px bold).
 * - Away (WDL): Descending order -> W is largest (12px bold), D is medium (10px), L is smallest (8.5px).
 */
export const L10Display: React.FC<L10DisplayProps> = ({ l10, className = '', showPrefix = false }) => {
  const parsed = parseL10(l10);

  if (!parsed.isValid) {
    return (
      <span className={`inline-flex items-baseline font-mono text-gray-500 ${className}`}>
        {showPrefix && <span className="text-[9px] font-bold text-gray-400 mr-1">L10:</span>}
        <span className="text-[10px]">{l10 || '-'}</span>
      </span>
    );
  }

  // If detailed LDW:WDL
  if (parsed.isDetailed) {
    const tooltip = `Last 10 Matches (Home LDW: ${parsed.homeL}L ${parsed.homeD}D ${parsed.homeW}W | Away WDL: ${parsed.awayW}W ${parsed.awayD}D ${parsed.awayL}L)`;

    return (
      <span
        className={`inline-flex items-baseline font-mono leading-none ${className}`}
        title={tooltip}
      >
        {showPrefix && <span className="text-[9px] font-bold text-gray-500 mr-1">L10:</span>}

        {/* HOME LDW (Ascending font sizes: L < D < W) */}
        <span className="inline-flex items-baseline">
          <span className="text-[8.5px] font-medium text-gray-500" title={`Home Losses: ${parsed.homeL}`}>
            {parsed.homeL}
          </span>
          <span className="text-[8.5px] text-gray-400 mx-[1px] select-none">;</span>
          <span className="text-[10px] font-semibold text-gray-700" title={`Home Draws: ${parsed.homeD}`}>
            {parsed.homeD}
          </span>
          <span className="text-[8.5px] text-gray-400 mx-[1px] select-none">;</span>
          <span className="text-[12px] font-bold text-gray-900" title={`Home Wins: ${parsed.homeW}`}>
            {parsed.homeW}
          </span>
        </span>

        {/* Primary Separator */}
        <span className="text-[10px] font-bold text-gray-400 mx-1 select-none">:</span>

        {/* AWAY WDL (Descending font sizes: W > D > L) */}
        <span className="inline-flex items-baseline">
          <span className="text-[12px] font-bold text-gray-900" title={`Away Wins: ${parsed.awayW}`}>
            {parsed.awayW}
          </span>
          <span className="text-[8.5px] text-gray-400 mx-[1px] select-none">;</span>
          <span className="text-[10px] font-semibold text-gray-700" title={`Away Draws: ${parsed.awayD}`}>
            {parsed.awayD}
          </span>
          <span className="text-[8.5px] text-gray-400 mx-[1px] select-none">;</span>
          <span className="text-[8.5px] font-medium text-gray-500" title={`Away Losses: ${parsed.awayL}`}>
            {parsed.awayL}
          </span>
        </span>
      </span>
    );
  }

  // Legacy format H:A (win counts)
  return (
    <span
      className={`inline-flex items-baseline font-mono text-[10px] text-gray-700 font-semibold ${className}`}
      title={`Last 10 Wins: ${parsed.homeWins} - ${parsed.awayWins}`}
    >
      {showPrefix && <span className="text-[9px] font-bold text-gray-500 mr-1">L10:</span>}
      <span>{parsed.homeWins}:{parsed.awayWins}</span>
    </span>
  );
};
