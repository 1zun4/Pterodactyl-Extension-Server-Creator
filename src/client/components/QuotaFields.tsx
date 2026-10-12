import { Input, Label } from '@pterodactyl/sdk';
import type { Limits, Resource } from '../api';
import { LABELS } from '../lib/format';
import { UNITS, formatSize, isSized } from '../lib/resources';

/** The seven quota numbers, used for the default quota and for single users. */
export default function QuotaFields({ value, onChange, prefix }: { value: Limits; onChange: (value: Limits) => void; prefix: string }) {
    return (
        <div className='srvc:grid srvc:grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] srvc:gap-4'>
            {(Object.keys(LABELS) as Resource[]).map((resource) => {
                const id = `${prefix}-${resource}`;

                return (
                    <div key={resource}>
                        <Label htmlFor={id} className='srvc:whitespace-nowrap'>
                            {LABELS[resource]}
                            {isSized(resource) && ` (${UNITS[resource]})`}
                        </Label>
                        <Input id={id} type='number' min={0} value={value[resource]} aria-describedby={isSized(resource) ? `${id}-friendly` : undefined} onChange={(event) => onChange({ ...value, [resource]: Number(event.currentTarget.value) })} />
                        {isSized(resource) && (
                            <p id={`${id}-friendly`} className='srvc:mt-1 srvc:text-xs srvc:text-muted-foreground'>
                                = {formatSize(resource, value[resource])}
                            </p>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
