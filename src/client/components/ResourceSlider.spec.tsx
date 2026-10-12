import { useState } from 'react';
import { afterEach, expect, test } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createExtensionTestHost } from '@pterodactyl/sdk/testing';
import ResourceSlider from './ResourceSlider';

afterEach(cleanup);

function Harness({ start, min, max }: { start: number; min: number; max: number }) {
    const [value, setValue] = useState(start);

    return <ResourceSlider id='memory' resource='memory' label='Memory' value={value} min={min} max={max} onChange={setValue} quota={{ available: max, limit: 8192 }} />;
}

function renderSlider(start: number, min = 1024, max = 3500) {
    const host = createExtensionTestHost({ extensionId: 'server-creator', prefix: 'srvc' });
    render(<Harness start={start} min={min} max={max} />, { wrapper: host.Wrapper });

    return host;
}

const slider = () => screen.getByRole('slider', { name: 'Memory' });

test('snaps to 256 MiB steps and still reaches an odd maximum', async () => {
    const host = renderSlider(1024);

    expect((await screen.findByRole('slider', { name: 'Memory' })).getAttribute('max')).toBe('10');
    fireEvent.change(slider(), { target: { value: '2' } });
    expect(slider().getAttribute('aria-valuetext')).toBe('1.5 GiB');
    fireEvent.change(slider(), { target: { value: '10' } });
    expect(slider().getAttribute('aria-valuetext')).toBe('3.42 GiB');
    expect(screen.getByText('0 GiB of 8 GiB left')).toBeTruthy();
    host.dispose();
});

test('takes an exact value and clamps it when leaving the field', async () => {
    const host = renderSlider(1024);

    fireEvent.click(await screen.findByRole('button', { name: 'Exact value' }));
    const input = screen.getByLabelText('Memory in MiB') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '1500' } });
    expect(slider().getAttribute('aria-valuetext')).toBe('1.46 GiB');

    fireEvent.change(input, { target: { value: '5000' } });
    expect(screen.getByText('Pick between 1 GiB and 3.42 GiB.')).toBeTruthy();
    fireEvent.blur(input);
    expect(input.value).toBe('3500');
    expect(screen.queryByText(/Pick between/)).toBeNull();
    host.dispose();
});

test('explains when the plan leaves no room to change the size', async () => {
    const host = renderSlider(2048, 2048, 1024);

    expect(await screen.findByText('(no room left in your plan to change it)')).toBeTruthy();
    expect(screen.queryByRole('slider')).toBeNull();
    host.dispose();
});
