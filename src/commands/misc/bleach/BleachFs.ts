import fs from 'fs';
import Tools from 'util/Tools';

export class BleachFs {
    private static _lineArrays: string[][];

    public static init() {
        const DIR_NAME = 'res/bleach';
        const dir = fs.readdirSync(DIR_NAME);
        this._lineArrays = [];
        for (const filename of dir) {
            this._lineArrays.push(
                fs
                    .readFileSync(`${DIR_NAME}/${filename}`, 'utf8')
                    .split('\n')
                    .filter((line) => line != '')
            );
        }
    }

    public static get randomLine() {
        return Tools.randomArrayElement(this._lineArrays);
    }
}

// const map = new Map();
// lines.forEach((line, i) => {
//     const simpleLine = line.toLowerCase().replace(/[^a-z0-9]/g, '');
//     if (!map.has(simpleLine)) {
//         map.set(simpleLine, []);
//     }
//     map.get(simpleLine).push(i);
// });
