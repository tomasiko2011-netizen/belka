'use client';

import { Card as CardType } from '@/lib/types';
import clsx from 'clsx';

interface CardProps {
  card?: CardType;
  faceDown?: boolean;
  onClick?: () => void;
  isSelected?: boolean;
  isValid?: boolean;
  isDisabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  style?: React.CSSProperties;
  className?: string;
}

const SUIT_SYMBOLS: Record<string, { symbol: string; color: string }> = {
  '♣': { symbol: '♣', color: '#1a1a2e' },
  '♠': { symbol: '♠', color: '#1a1a2e' },
  '♥': { symbol: '♥', color: '#c0392b' },
  '♦': { symbol: '♦', color: '#c0392b' },
};

const SIZES = {
  sm: { width: 48, height: 68, fontSize: '0.7rem', suitSize: '1.2rem' },
  md: { width: 68, height: 96, fontSize: '0.85rem', suitSize: '1.5rem' },
  lg: { width: 80, height: 112, fontSize: '1rem', suitSize: '1.8rem' },
};

export default function Card({
  card,
  faceDown = false,
  onClick,
  isSelected = false,
  isValid = false,
  isDisabled = false,
  size = 'md',
  style,
  className,
}: CardProps) {
  const sz = SIZES[size];

  if (faceDown || !card) {
    return (
      <div
        className={clsx('playing-card card-back', className)}
        style={{ width: sz.width, height: sz.height, ...style }}
      />
    );
  }

  const { symbol, color } = SUIT_SYMBOLS[card.suit];

  return (
    <div
      className={clsx(
        'playing-card',
        isSelected && 'selected',
        isValid && !isDisabled && 'valid-play',
        isDisabled && 'disabled',
        className
      )}
      style={{ width: sz.width, height: sz.height, cursor: onClick && !isDisabled ? 'pointer' : 'default', ...style }}
      onClick={!isDisabled ? onClick : undefined}
    >
      {/* Top left */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1 }}>
        <span style={{ color, fontSize: sz.fontSize, fontWeight: 700, fontFamily: 'Playfair Display, serif' }}>
          {card.rank}
        </span>
        <span style={{ color, fontSize: `calc(${sz.fontSize} * 0.9)` }}>{symbol}</span>
      </div>

      {/* Center suit */}
      <div style={{ textAlign: 'center', fontSize: sz.suitSize, color, lineHeight: 1 }}>
        {symbol}
      </div>

      {/* Bottom right (rotated) */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
        lineHeight: 1, transform: 'rotate(180deg)'
      }}>
        <span style={{ color, fontSize: sz.fontSize, fontWeight: 700, fontFamily: 'Playfair Display, serif' }}>
          {card.rank}
        </span>
        <span style={{ color, fontSize: `calc(${sz.fontSize} * 0.9)` }}>{symbol}</span>
      </div>
    </div>
  );
}
