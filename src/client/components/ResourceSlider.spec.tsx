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

test('takes an exact value typed on the size and clamps it', async () => {
    const host = renderSlider(1024);

    fireEvent.click(await screen.findByRole('button', { name: 'Memory: 1 GiB. Type an exact value' }));
    const input = screen.getByLabelText('Memory in GiB') as HTMLInputElement;

    expect(input.value).toBe('1');
    fireEvent.change(input, { target: { value: '1500 MiB' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(slider().getAttribute('aria-valuetext')).toBe('1.46 GiB');

    fireEvent.click(screen.getByRole('button', { name: /Type an exact value/ }));
    fireEvent.change(screen.getByLabelText('Memory in GiB'), { target: { value: '5' } });
    fireEvent.blur(screen.getByLabelText('Memory in GiB'));
    expect(slider().getAttribute('aria-valuetext')).toBe('3.42 GiB');

    fireEvent.click(screen.getByRole('button', { name: /Type an exact value/ }));
    fireEvent.change(screen.getByLabelText('Memory in GiB'), { target: { value: 'lots' } });
    fireEvent.keyDown(screen.getByLabelText('Memory in GiB'), { key: 'Escape' });
    expect(screen.queryByLabelText('Memory in GiB')).toBeNull();
    expect(slider().getAttribute('aria-valuetext')).toBe('3.42 GiB');
    host.dispose();
});

test('locks the slider when the plan leaves no room to change the size', async () => {
    const host = renderSlider(2048, 2048, 1024);

    expect(await screen.findByText('No room left in your plan to change it')).toBeTruthy();
    expect((slider() as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: /Memory: 2 GiB/ }) as HTMLButtonElement).disabled).toBe(true);
    host.dispose();
});
