import { HexColorString } from 'discord.js';

/** Library-agnostic tools that don't fit anywhere else */
export default class Tools {
    /**
     * Picks a random element from an array
     * @param array The array
     * @returns A random element from the array
     */
    public static randomArrayElement<T>(array: T[]): T {
        return array[Math.floor(Math.random() * array.length)];
    }

    /**
     * Splits an array into subarrays of fixed size e.g.
     * [a, b, c, d, e], 2 --> [ [a, b], [c, d], [e] ]
     * @param array The array
     * @param chunkSize The maximum number of elements in a subarray
     * @returns The split array
     */
    public static splitArrayIntoChunks<T>(array: T[], chunkSize: number): T[][] {
        const res: T[][] = [];
        for (let i = 0; i < Math.ceil(array.length / chunkSize); ++i) {
            res.push(array.slice(i * chunkSize, (i + 1) * chunkSize));
        }
        return res;
    }

    /**
     * Expands comma-separated keys, e.g.
     * { "a, b, c": "d" } --> { "a": d, "b": "d", "c": "d"}
     */
    public static expandKeys(input: { [key: string]: unknown }) {
        for (const [key, value] of Object.entries(input)) {
            const subkeys = key.split(/,\s*/);
            delete input[key];
            for (const subkey of subkeys) {
                input[subkey] = value;
            }
        }
        return input;
    }

    /**
     * Shuffles array **in-place**
     * @param array The array
     * @returns The same array
     * @see https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
     */
    public static shuffle<T>(array: T[]) {
        //
        for (let i = array.length - 1; i > 0; --i) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    /**
     * Checks for duplicate values in an array
     * @param array The array
     * @returns Whether it has duplicate values
     */
    public static hasDuplicates(array: unknown[]) {
        const set = new Set(array);
        return set.size < array.length;
    }

    /**
     * reduce() callback summing up an array of numbers
     */
    public static sum(prev: number, curr: number) {
        return prev + curr;
    }

    /** Create an array of numbers from start to end, inclusive
     * @param start e.g. 3
     * @param start e.g. 6
     * @returns e.g. [3, 4, 5, 6]
     */
    public static range(start: number, end: number) {
        return Array(end - start + 1)
            .fill(start)
            .map((val, idx) => val + idx);
    }

    /**
     * Convert RGB to a HexColorString
     * @param r Red (8-bit)
     * @param g Green (8-bit)
     * @param b Blue (8-bit)
     * @returns #rrggbb
     */
    public static rgbToHex(r: number, g: number, b: number, a?: number): HexColorString {
        r = Math.floor(r % 256);
        g = Math.floor(g % 256);
        b = Math.floor(b % 256);
        const h = (c: number) => (c > 16 ? c.toString(16) : `0${c.toString(16)}`);
        return `#${h(r)}${h(g)}${h(b)}`;
    }

    // public static complementColor(
    //     color: HexColorString | number
    // ): [number, number, number, number] {
    //     if (typeof color !== 'number') {
    //         color = parseInt(color.slice(1), 16);
    //     }
    //     const complement = 0xffffff ^ color;
    // return this.rgbToHex(
    //     complement / 256 / 256,
    //     (complement / 256) % 256,
    //     complement % 256
    // );
    // }
}
