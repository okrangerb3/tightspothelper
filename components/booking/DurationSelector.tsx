'use client'

// Duration selector component — drop-in replacement for the duration step in booking
// Shows 30min, 45min, 1hr as primary options with +15min increments up to 3hr

import { useState } from 'react'

interface Props {
  expertRate:   number      // $/hr
  feeType:      'percentage' | 'flat'
  feeValue:     number
  flatTiers?:   Record<string, number>
  value:        number      // selected minutes
  onChange:     (minutes: number) => void
}

const BASE_DURATIONS = [
  { minutes: 30,  label: '30 min', badge: null },
  { minutes: 45,  label: '45 min', badge: null },
  { minutes: 60,  label: '1 hour', badge: 'Most popular' },
]

function calcTotal(rate: number, mins: number, feeType: string, feeValue: number, flatTiers?: Record<string,number>) {
  const sub = rate * (mins / 60)
  const fee = feeType === 'percentage'
    ? sub * feeValue
    : flatTiers?.[String([15,30,45,60,75,90,105,120].find(t => t >= mins) ?? 120)] ?? feeValue
  return { sub: sub.toFixed(2), total: (sub + fee).toFixed(2) }
}

export function DurationSelector({ expertRate, feeType, feeValue, flatTiers, value, onChange }: Props) {
  const [showExtended, setShowExtended] = useState(value > 60)

  const extendedOptions = [75, 90, 105, 120, 150, 180].map(m => ({
    minutes: m,
    label:   m >= 60 ? `${m / 60 === Math.floor(m / 60) ? m/60 + ' hr' : (m/60).toFixed(1) + ' hr'}` : `${m} min`,
  }))

  // Normalize label for extended
  const extLabel = (m: number) => {
    if (m % 60 === 0) return `${m / 60}hr`
    return `${Math.floor(m/60)}h ${m%60}m`
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Session length</label>
        <p className="text-xs text-ink-500 mb-3">
          We pre-authorize 1 hour and settle for actual time used at the end.
        </p>
      </div>

      {/* Primary options */}
      <div className="grid grid-cols-3 gap-2">
        {BASE_DURATIONS.map(opt => {
          const { sub, total } = calcTotal(expertRate, opt.minutes, feeType, feeValue, flatTiers)
          const selected = value === opt.minutes
          return (
            <button key={opt.minutes} onClick={() => { onChange(opt.minutes); setShowExtended(false) }}
              className={`relative p-3 rounded-xl border text-left transition-all
                ${selected
                  ? 'border-brand-500 bg-brand-500/10'
                  : 'border-ink-700 hover:border-ink-500 bg-ink-900'}`}>
              {opt.badge && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] bg-brand-500 text-white px-1.5 py-0.5 rounded-full whitespace-nowrap">
                  {opt.badge}
                </span>
              )}
              <p className={`text-sm font-bold ${selected ? 'text-white' : 'text-ink-200'}`}>{opt.label}</p>
              <p className={`text-xs mt-0.5 ${selected ? 'text-brand-400' : 'text-ink-500'}`}>${total}</p>
            </button>
          )
        })}
      </div>

      {/* Add more time */}
      {!showExtended ? (
        <button onClick={() => setShowExtended(true)}
          className="w-full py-2.5 rounded-xl border border-dashed border-ink-700 text-xs text-ink-500
            hover:border-ink-500 hover:text-ink-300 transition-colors">
          + Need more time?
        </button>
      ) : (
        <div>
          <p className="text-xs text-ink-500 mb-2">Extended sessions</p>
          <div className="grid grid-cols-3 gap-2">
            {extendedOptions.map(opt => {
              const { sub, total } = calcTotal(expertRate, opt.minutes, feeType, feeValue, flatTiers)
              const selected = value === opt.minutes
              return (
                <button key={opt.minutes} onClick={() => onChange(opt.minutes)}
                  className={`p-3 rounded-xl border text-left transition-all
                    ${selected
                      ? 'border-brand-500 bg-brand-500/10'
                      : 'border-ink-700 hover:border-ink-500 bg-ink-900'}`}>
                  <p className={`text-sm font-bold ${selected ? 'text-white' : 'text-ink-200'}`}>{extLabel(opt.minutes)}</p>
                  <p className={`text-xs mt-0.5 ${selected ? 'text-brand-400' : 'text-ink-500'}`}>${total}</p>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Pre-auth notice */}
      <div className="bg-ink-800/50 border border-ink-700/50 rounded-xl p-3 text-xs text-ink-400 flex items-start gap-2">
        <span className="text-brand-400 shrink-0 mt-0.5">ⓘ</span>
        <span>
          We pre-authorize <strong className="text-white">
            ${calcTotal(expertRate, 60, feeType, feeValue, flatTiers).total}
          </strong> (1 hour) on your card.
          You're only charged for the actual time used when the session ends.
        </span>
      </div>
    </div>
  )
}
