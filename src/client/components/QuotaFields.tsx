import { Input, Label } from '@pterodactyl/sdk';
import type { Limits, Resource } from '../api';
import { LABELS } from '../lib/format';

const UNITS: Partial<Record<Resource, string>> = { memory: 'MiB', disk: 'MiB', cpu: '%' };

/** The seven quota numbers, used for the default quota and for single users. */
export default function QuotaFields({ value, onChange, prefix }: { value: Limits; onChange: (value: Limits) => void; prefix: string }) {
    return (
        <div className='srvc:grid srvc:grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] srvc:gap-4'>
            {(Object.keys(LABELS) as Resource[]).map((resource) => (
                <div key={resource}>
                    <Label htmlFor={`${prefix}-${resource}`} className='srvc:whitespace-nowrap'>
                        {LABELS[resource]}
                        {UNITS[resource] && ` (${UNITS[resource]})`}
                    </Label>
                    <Input id={`${prefix}-${resource}`} type='number' min={0} value={value[resource]} onChange={(event) => onChange({ ...value, [resource]: Number(event.currentTarget.value) })} />
                </div>
            ))}
        </div>
    );
}
