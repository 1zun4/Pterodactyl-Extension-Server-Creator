import { describe, expect, test } from 'vitest';
import { formatCpu, formatMiB, indexOf, labels, leftText, positionOf, recommended, scaleFor, snap, stopCount, ticks, valueAt } from './resources';

describe('formatting', () => {
    test('memory and disk read as GiB', () => {
        expect(formatMiB(0)).toBe('0 GiB');
        expect(formatMiB(512)).toBe('512 MiB');
        expect(formatMiB(1024)).toBe('1 GiB');
        expect(formatMiB(1536)).toBe('1.5 GiB');
        expect(formatMiB(1280)).toBe('1.25 GiB');
        expect(formatMiB(20480)).toBe('20 GiB');
        expect(formatMiB(1024 * 1024 * 2)).toBe('2 TiB');
    });

    test('CPU reads as cores', () => {
        expect(formatCpu(100)).toBe('1 core');
        expect(formatCpu(150)).toBe('1.5 cores');
        expect(formatCpu(50)).toBe('0.5 cores');
        expect(formatCpu(200)).toBe('2 cores');
    });

    test('what is left after a choice', () => {
        expect(leftText('memory', 1024, 3072, 4096)).toBe('2 GiB of 4 GiB left');
        expect(leftText('cpu', 100, 100, 300)).toBe('0 cores of 3 cores left');
        expect(leftText('disk', 9999, 5120, 10240)).toBe('0 GiB of 10 GiB left');
    });
});

describe('stops', () => {
    test('include both ends even when they are off the step grid', () => {
        const scale = { min: 1000, max: 3500, step: 256 };

        expect(stopCount(scale)).toBe(12);
        expect(valueAt(scale, 0)).toBe(1000);
        expect(valueAt(scale, 1)).toBe(1024);
        expect(valueAt(scale, 10)).toBe(3328);
        expect(valueAt(scale, 11)).toBe(3500);
        expect(valueAt(scale, 99)).toBe(3500);
    });

    test('do not repeat ends that sit on the grid', () => {
        const scale = scaleFor('memory', 1024, 4096);

        expect(stopCount(scale)).toBe(13);
        expect(valueAt(scale, 1)).toBe(1280);
        expect(valueAt(scale, 11)).toBe(3840);
    });

    test('collapse to one stop when min reaches max', () => {
        const scale = scaleFor('cpu', 100, 100);

        expect(stopCount(scale)).toBe(1);
        expect(valueAt(scale, 3)).toBe(100);
        expect(indexOf(scale, 250)).toBe(0);
        expect(positionOf(scale, 100)).toBe(0);
    });

    test('snap to the nearest step and clamp to the range', () => {
        const scale = { min: 1000, max: 3500, step: 256 };

        expect(snap(scale, 1010)).toBe(1000);
        expect(snap(scale, 1100)).toBe(1024);
        expect(snap(scale, 1700)).toBe(1792);
        expect(snap(scale, 3400)).toBe(3328);
        expect(snap(scale, 3450)).toBe(3500);
        expect(snap(scale, 0)).toBe(1000);
        expect(snap(scale, 99999)).toBe(3500);
        expect(snap(scaleFor('cpu', 50, 300), 160)).toBe(150);
        expect(snap(scaleFor('disk', 5120, 20480), 7000)).toBe(7168);
    });
});

describe('marks', () => {
    test('ticks sit on common sizes inside the range', () => {
        const scale = scaleFor('memory', 1024, 8192);

        expect(ticks('memory', scale).map(({ value }) => value)).toEqual([2048, 4096, 6144]);
        expect(ticks('memory', scale)[1].at).toBeCloseTo(3 / 7);
    });

    test('labels keep both ends and drop crowded ticks', () => {
        expect(labels('memory', scaleFor('memory', 1024, 8192)).map(({ value }) => value)).toEqual([1024, 4096, 6144, 8192]);
        expect(labels('disk', scaleFor('disk', 5120, 1024 * 1024)).map(({ value }) => value)).toEqual([5120, 1024 * 1024]);
        expect(labels('cpu', scaleFor('cpu', 100, 100))).toEqual([{ value: 100, at: 0 }]);
    });

    test('recommended is the next common size that still fits', () => {
        expect(recommended('memory', scaleFor('memory', 1024, 4096))).toBe(2048);
        expect(recommended('memory', scaleFor('memory', 1536, 4096))).toBe(2048);
        expect(recommended('memory', scaleFor('memory', 2048, 3072))).toBeNull();
        expect(recommended('cpu', scaleFor('cpu', 100, 200))).toBe(200);
        expect(recommended('disk', scaleFor('disk', 5120, 20480))).toBe(10240);
    });
});
