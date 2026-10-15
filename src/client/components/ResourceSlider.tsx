import { useState } from 'react';
import { Input, Label } from '@pterodactyl/sdk';
import { EDIT_UNITS, clamp, editable, formatSize, indexOf, labels, leftText, parseSize, positionOf, recommended, scaleFor, stopCount, ticks, valueAt, type Sized } from '../lib/resources';

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
    /** Mark a recommended size on the track. Only makes sense when a game sets the minimum. */
    suggest?: boolean;
}

const thumb = [
    'srvc:[&::-webkit-slider-thumb]:size-7 srvc:[&::-webkit-slider-thumb]:appearance-none srvc:[&::-webkit-slider-thumb]:rounded-full srvc:[&::-webkit-slider-thumb]:border-4 srvc:[&::-webkit-slider-thumb]:border-primary srvc:[&::-webkit-slider-thumb]:bg-card srvc:[&::-webkit-slider-thumb]:shadow-md srvc:[&::-webkit-slider-thumb]:transition-shadow',
    'srvc:[&::-moz-range-thumb]:size-7 srvc:[&::-moz-range-thumb]:box-border srvc:[&::-moz-range-thumb]:rounded-full srvc:[&::-moz-range-thumb]:border-4 srvc:[&::-moz-range-thumb]:border-primary srvc:[&::-moz-range-thumb]:bg-card srvc:[&::-moz-range-thumb]:shadow-md srvc:[&::-moz-range-track]:bg-transparent',
    'srvc:focus-visible:[&::-webkit-slider-thumb]:ring-4 srvc:focus-visible:[&::-webkit-slider-thumb]:ring-ring/50 srvc:focus-visible:[&::-moz-range-thumb]:ring-4 srvc:focus-visible:[&::-moz-range-thumb]:ring-ring/50',
].join(' ');

/** Keeps a label inside the track's width when it sits near either end. */
function placed(at: number) {
    if (at < 0.1) return { className: 'srvc:-left-3.5', style: undefined };
    if (at > 0.9) return { className: 'srvc:-right-3.5', style: undefined };

    return { className: 'srvc:-translate-x-1/2', style: { left: `${at * 100}%` } };
}

/** A memory, disk or CPU picker that reads in GiB and cores but works in the API's MiB and percent. */
export default function ResourceSlider({ id, resource, label, value, min, max, onChange, quota, suggest = false }: Props) {
    const [draft, setDraft] = useState<string | null>(null);
    const fixed = max <= min;
    const scale = scaleFor(resource, min, max);
    const shown = fixed && max === min ? min : value;
    const friendly = formatSize(resource, shown);
    const outside = !fixed && (value < min || value > max);
    const suggestion = suggest && !fixed ? recommended(resource, scale) : null;
    const filled = fixed ? (max < min ? 0 : 1) : outside ? (value > max ? 1 : 0) : positionOf(scale, value);
    const marks = labels(resource, scale, 0.2, suggestion);
    const suggested = suggestion === null ? null : positionOf(scale, suggestion);

    const commit = () => {
        const parsed = draft === null ? null : parseSize(resource, draft);

        setDraft(null);
        parsed !== null && onChange(clamp(parsed, min, max));
    };

    return (
        <div className='srvc:grid srvc:gap-1'>
            <div className='srvc:flex srvc:min-h-9 srvc:items-center srvc:justify-between srvc:gap-3'>
                <Label htmlFor={id}>{label}</Label>
                {draft === null ? (
                    <button
                        type='button'
                        disabled={fixed}
                        aria-label={`${label}: ${friendly}. Type an exact value`}
                        title={fixed ? undefined : 'Type an exact value'}
                        onClick={() => setDraft(editable(resource, value))}
                        className={`srvc:-mr-1 srvc:rounded-sm srvc:px-1 srvc:font-header srvc:text-lg srvc:font-semibold srvc:tabular-nums srvc:underline-offset-4 srvc:decoration-dashed srvc:decoration-muted-foreground srvc:enabled:cursor-text srvc:enabled:underline srvc:enabled:hover:decoration-primary srvc:focus-visible:outline-2 srvc:focus-visible:outline-ring ${outside || max < min ? 'srvc:text-destructive' : 'srvc:text-foreground'}`}
                    >
                        {friendly}
                    </button>
                ) : (
                    <div className='srvc:flex srvc:items-center srvc:gap-2'>
                        <Input
                            autoFocus
                            inputMode='decimal'
                            aria-label={`${label} in ${EDIT_UNITS[resource]}`}
                            className='srvc:w-24 srvc:text-right srvc:tabular-nums'
                            value={draft}
                            onFocus={(event) => event.currentTarget.select()}
                            onChange={(event) => setDraft(event.currentTarget.value)}
                            onBlur={commit}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    commit();
                                } else if (event.key === 'Escape') {
                                    setDraft(null);
                                }
                            }}
                        />
                        <span className='srvc:text-sm srvc:text-muted-foreground'>{EDIT_UNITS[resource]}</span>
                    </div>
                )}
            </div>
            <div className={`srvc:relative srvc:h-11 ${fixed ? 'srvc:opacity-60' : ''}`}>
                <div aria-hidden className='srvc:pointer-events-none srvc:absolute srvc:inset-x-3.5 srvc:top-1/2 srvc:h-2 srvc:-translate-y-1/2 srvc:rounded-full srvc:bg-sunken'>
                    <div className='srvc:absolute srvc:inset-y-0 srvc:left-0 srvc:rounded-full srvc:bg-primary' style={{ width: `${filled * 100}%` }} />
                    {ticks(resource, scale).map((tick) => (
                        <span
                            key={tick.value}
                            className={`srvc:absolute srvc:top-1/2 srvc:-translate-1/2 srvc:rounded-full ${tick.value === suggestion ? 'srvc:size-2.5 srvc:ring-2 srvc:ring-primary' : 'srvc:size-1.5'} ${tick.at <= filled ? 'srvc:bg-primary-foreground/70' : 'srvc:bg-muted-foreground/60'}`}
                            style={{ left: `${tick.at * 100}%` }}
                        />
                    ))}
                </div>
                <input
                    id={id}
                    type='range'
                    min={0}
                    max={fixed ? 1 : stopCount(scale) - 1}
                    step={1}
                    value={fixed ? filled : indexOf(scale, value)}
                    disabled={fixed}
                    aria-valuetext={friendly}
                    aria-describedby={quota || fixed ? `${id}-left` : undefined}
                    onChange={(event) => onChange(valueAt(scale, Number(event.currentTarget.value)))}
                    className={`srvc:relative srvc:block srvc:h-full srvc:w-full srvc:cursor-pointer srvc:appearance-none srvc:bg-transparent srvc:outline-none srvc:disabled:cursor-not-allowed ${thumb}`}
                />
            </div>
            <div className={`srvc:relative srvc:mx-3.5 srvc:text-xs srvc:text-muted-foreground ${suggestion === null ? 'srvc:h-4' : 'srvc:h-9'}`}>
                {marks.map(({ value: mark, at }) => {
                    const { className, style } = placed(at);

                    return (
                        <span key={mark} aria-hidden className={`srvc:absolute srvc:top-0 srvc:whitespace-nowrap ${className} ${mark === suggestion ? 'srvc:font-medium srvc:text-primary' : ''}`} style={style}>
                            {formatSize(resource, mark)}
                        </span>
                    );
                })}
                {suggestion !== null && suggested !== null && (
                    <button
                        type='button'
                        aria-pressed={value === suggestion}
                        aria-label={`Use the recommended ${formatSize(resource, suggestion)}`}
                        onClick={() => onChange(suggestion)}
                        className={`srvc:absolute srvc:top-4 srvc:whitespace-nowrap srvc:rounded-sm srvc:text-[0.6875rem] srvc:font-medium srvc:uppercase srvc:tracking-wide srvc:text-primary srvc:hover:underline srvc:focus-visible:outline-2 srvc:focus-visible:outline-ring ${placed(suggested).className}`}
                        style={placed(suggested).style}
                    >
                        Recommended
                    </button>
                )}
            </div>
            <div id={`${id}-left`} className='srvc:mt-1 srvc:flex srvc:flex-wrap srvc:justify-between srvc:gap-x-3 srvc:text-xs srvc:text-muted-foreground'>
                {quota && <p>{leftText(resource, fixed ? shown : value, quota.available, quota.limit)}</p>}
                {fixed && <p className={max < min ? 'srvc:text-destructive' : undefined}>{max < min ? 'No room left in your plan to change it' : 'Set by your plan'}</p>}
            </div>
            {outside && (
                <p className='srvc:text-xs srvc:text-destructive'>
                    Pick between {formatSize(resource, min)} and {formatSize(resource, max)}.
                </p>
            )}
        </div>
    );
}
