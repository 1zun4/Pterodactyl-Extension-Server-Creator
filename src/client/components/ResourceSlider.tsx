import { useState } from 'react';
import { Input, Label } from '@pterodactyl/sdk';
import { UNITS, clamp, formatSize, indexOf, labels, leftText, positionOf, recommended, scaleFor, stopCount, ticks, valueAt, type Sized } from '../lib/resources';

interface Props {
    id: string;
    resource: Sized;
    label: string;
    value: number;
    min: number;
    max: number;
    onChange: (value: number) => void;
    /** What the plan still has for this server, and the plan's total. */
    quota?: { available: number; limit: number };
    /** Offer a "Recommended" preset. Only makes sense when a game sets the minimum. */
    suggest?: boolean;
}

const thumb = [
    'srvc:[&::-webkit-slider-thumb]:size-7 srvc:[&::-webkit-slider-thumb]:appearance-none srvc:[&::-webkit-slider-thumb]:rounded-full srvc:[&::-webkit-slider-thumb]:border-4 srvc:[&::-webkit-slider-thumb]:border-primary srvc:[&::-webkit-slider-thumb]:bg-card srvc:[&::-webkit-slider-thumb]:shadow-md srvc:[&::-webkit-slider-thumb]:transition-shadow',
    'srvc:[&::-moz-range-thumb]:size-7 srvc:[&::-moz-range-thumb]:box-border srvc:[&::-moz-range-thumb]:rounded-full srvc:[&::-moz-range-thumb]:border-4 srvc:[&::-moz-range-thumb]:border-primary srvc:[&::-moz-range-thumb]:bg-card srvc:[&::-moz-range-thumb]:shadow-md srvc:[&::-moz-range-track]:bg-transparent',
    'srvc:focus-visible:[&::-webkit-slider-thumb]:ring-4 srvc:focus-visible:[&::-webkit-slider-thumb]:ring-ring/50 srvc:focus-visible:[&::-moz-range-thumb]:ring-4 srvc:focus-visible:[&::-moz-range-thumb]:ring-ring/50',
].join(' ');

const chip = 'srvc:inline-flex srvc:min-h-8 srvc:items-center srvc:rounded-full srvc:border srvc:px-3 srvc:text-xs srvc:font-medium srvc:transition-colors';

/** A memory, disk or CPU picker that reads in GiB and cores but works in the API's MiB and percent. */
export default function ResourceSlider({ id, resource, label, value, min, max, onChange, quota, suggest = false }: Props) {
    const [exact, setExact] = useState(false);
    const [draft, setDraft] = useState<string | null>(null);
    const scale = scaleFor(resource, min, max);
    const friendly = formatSize(resource, value);
    const outside = value < min || value > max;
    const hint = quota && <p className='srvc:text-xs srvc:text-muted-foreground'>{leftText(resource, value, quota.available, quota.limit)}</p>;

    if (max <= min) {
        return (
            <div className='srvc:grid srvc:gap-1'>
                <p className='srvc:text-sm srvc:text-foreground'>
                    <span className='srvc:font-medium srvc:uppercase'>{label}:</span> {formatSize(resource, max < min ? value : min)}{' '}
                    <span className='srvc:text-muted-foreground'>{max < min ? '(no room left in your plan to change it)' : '(set by your plan)'}</span>
                </p>
                {hint}
            </div>
        );
    }

    const suggestion = suggest ? recommended(resource, scale) : null;
    const filled = outside ? (value > max ? 1 : 0) : positionOf(scale, value);
    const unit = UNITS[resource];

    return (
        <div className='srvc:grid srvc:gap-1'>
            <div className='srvc:flex srvc:items-baseline srvc:justify-between srvc:gap-3'>
                <Label htmlFor={id}>{label}</Label>
                <span aria-hidden className={`srvc:font-header srvc:text-lg srvc:font-semibold srvc:tabular-nums ${outside ? 'srvc:text-destructive' : 'srvc:text-foreground'}`}>
                    {friendly}
                </span>
            </div>
            <div className='srvc:relative srvc:h-11'>
                <div aria-hidden className='srvc:pointer-events-none srvc:absolute srvc:inset-x-3.5 srvc:top-1/2 srvc:h-2 srvc:-translate-y-1/2 srvc:rounded-full srvc:bg-sunken'>
                    <div className='srvc:absolute srvc:inset-y-0 srvc:left-0 srvc:rounded-full srvc:bg-primary' style={{ width: `${filled * 100}%` }} />
                    {ticks(resource, scale).map((tick) => (
                        <span key={tick.value} className={`srvc:absolute srvc:top-1/2 srvc:size-1.5 srvc:-translate-1/2 srvc:rounded-full ${tick.at <= filled ? 'srvc:bg-primary-foreground/70' : 'srvc:bg-muted-foreground/60'}`} style={{ left: `${tick.at * 100}%` }} />
                    ))}
                </div>
                <input
                    id={id}
                    type='range'
                    min={0}
                    max={stopCount(scale) - 1}
                    step={1}
                    value={indexOf(scale, value)}
                    aria-valuetext={friendly}
                    aria-describedby={quota ? `${id}-left` : undefined}
                    onChange={(event) => onChange(valueAt(scale, Number(event.currentTarget.value)))}
                    className={`srvc:relative srvc:block srvc:h-full srvc:w-full srvc:cursor-pointer srvc:appearance-none srvc:bg-transparent srvc:outline-none ${thumb}`}
                />
            </div>
            <div aria-hidden className='srvc:relative srvc:mx-3.5 srvc:h-4 srvc:text-xs srvc:text-muted-foreground'>
                {labels(resource, scale).map(({ value: mark, at }) => (
                    <span key={mark} className={`srvc:absolute srvc:top-0 srvc:whitespace-nowrap ${at === 0 ? 'srvc:-left-3.5' : at === 1 ? 'srvc:-right-3.5' : 'srvc:-translate-x-1/2'}`} style={at > 0 && at < 1 ? { left: `${at * 100}%` } : undefined}>
                        {formatSize(resource, mark)}
                    </span>
                ))}
            </div>
            <div className='srvc:mt-1 srvc:flex srvc:flex-wrap srvc:items-center srvc:justify-between srvc:gap-x-3 srvc:gap-y-2'>
                <div id={`${id}-left`}>{hint}</div>
                <div className='srvc:flex srvc:flex-wrap srvc:items-center srvc:gap-2'>
                    {suggestion !== null && (
                        <button type='button' aria-pressed={value === suggestion} onClick={() => onChange(suggestion)} className={`${chip} ${value === suggestion ? 'srvc:border-primary srvc:bg-primary/10 srvc:text-foreground' : 'srvc:border-border srvc:text-muted-foreground srvc:hover:border-primary srvc:hover:text-foreground'}`}>
                            Recommended: {formatSize(resource, suggestion)}
                        </button>
                    )}
                    <button type='button' aria-expanded={exact} aria-controls={`${id}-exact`} onClick={() => setExact(!exact)} className={`${chip} srvc:border-transparent srvc:text-muted-foreground srvc:hover:text-foreground`}>
                        {exact ? 'Hide exact value' : 'Exact value'}
                    </button>
                </div>
            </div>
            {exact && (
                <div className='srvc:flex srvc:items-center srvc:gap-2'>
                    <Input
                        id={`${id}-exact`}
                        type='number'
                        inputMode='numeric'
                        aria-label={`${label} in ${unit === '%' ? 'percent' : unit}`}
                        min={min}
                        max={max}
                        value={draft ?? String(value)}
                        onChange={(event) => {
                            const text = event.currentTarget.value;
                            setDraft(text);
                            text !== '' && Number.isInteger(Number(text)) && onChange(Number(text));
                        }}
                        onBlur={() => {
                            setDraft(null);
                            onChange(clamp(value, min, max));
                        }}
                    />
                    <span className='srvc:shrink-0 srvc:text-sm srvc:text-muted-foreground'>{unit}</span>
                </div>
            )}
            {outside && (
                <p className='srvc:text-xs srvc:text-destructive'>
                    Pick between {formatSize(resource, min)} and {formatSize(resource, max)}.
                </p>
            )}
        </div>
    );
}
