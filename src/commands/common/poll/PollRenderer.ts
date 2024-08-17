import { HexColorString, GuildEmoji } from 'discord.js';
import sharp from 'sharp';
import twemoji from 'twemoji';
import { SharpCommon } from 'util/SharpCommon';
import Tools from 'util/Tools';
import { PollCommon } from './PollCommon';
import fs from 'fs';
import { PollConfig } from './Config';
import 'dotenv/config';
import { Logger } from 'core/Logger';

// stroke:${process.env.BASE_COLOR};stroke-width:6;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1

const GOOD_COLORS = [
    '#d633ff',
    '#3399ff',
    '#33ffcc',
    '#66cc66',
    '#bbff33',
    '#ffcc33',
    '#ff9933',
    '#ff3333',
    '#ff3399'
] as HexColorString[];

export class PollRenderer {
    private static readonly CENTER =
        PollConfig.PIECHART_RADIUS + PollConfig.PIECHART_MARGIN;
    private static readonly BASE_SVG = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg version="1.1" viewBox="0 0 ${this.CENTER * 2} ${this.CENTER * 2}" width="${
        this.CENTER * 2
    }" height="${this.CENTER * 2}">`;
    private static readonly PATH_STYLE = `fill-opacity:0.9;stroke:none`;

    private static coords(deg: number, radius: number = PollConfig.PIECHART_RADIUS) {
        const rad = (deg / 180.0) * Math.PI;
        return [
            Math.cos(rad) * radius + this.CENTER,
            Math.sin(rad) * radius + this.CENTER
        ];
    }

    private static figure(start: number, end: number, color: HexColorString) {
        if (start === end || end - start >= 360) {
            return `\n<ellipse style="${this.PATH_STYLE};fill:${color};" cx="${this.CENTER}" cy="${this.CENTER}" rx="${PollConfig.PIECHART_RADIUS}" ry="${PollConfig.PIECHART_RADIUS}" />`;
        } else {
            let res = '';
            const angle = end - start;
            const keypointCount = Math.ceil(angle / 90);
            const keypointAngle = angle / keypointCount;

            const [startX, startY] = this.coords(start);
            res += `M ${startX},${startY} A `;

            for (let i = 0; i < keypointCount + 1; ++i) {
                const [x, y] = this.coords(start + i * keypointAngle);
                res += `${this.CENTER},${this.CENTER} 0 0 1 ${x},${y} `;
            }

            res += `L ${this.CENTER},${this.CENTER} Z`;
            return `\n<path style="${this.PATH_STYLE};fill:${color};" d="${res}" />`;
        }
    }

    private static toSvg(figures: string[]) {
        let res = this.BASE_SVG;
        for (const figure of figures) {
            res += figure;
        }
        res += '</svg>';
        return Buffer.from(res);
    }

    public static async render(
        // guild: Guild,
        data: {
            emojiValue: string | GuildEmoji;
            text: string;
            value: number;
        }[]
    ) {
        const total = data.map((dataPoint) => dataPoint.value).reduce(Tools.sum);
        const figures: string[] = [];
        const compositions = [];
        const goodData = data.filter((dataPoint) => dataPoint.value > 0);
        const colorsShuffled = Tools.shuffle(GOOD_COLORS);
        const colors = colorsShuffled.concat(colorsShuffled);

        let currentAngle = 0;

        for (const dataPoint of goodData) {
            const deltaAngle = (dataPoint.value / total) * 360.0;
            const [emojiX, emojiY] = this.coords(
                currentAngle + deltaAngle / 2,
                PollConfig.PIECHART_RADIUS / 2
            );

            let emojiBuffer: Buffer;
            // Roundabout method from key instead of value
            // if (isNaN(Number(dataPoint.emojiKey)) || dataPoint.emojiKey.length < 15) {
            //     const emojiValue = NodeEmoji.get(dataPoint.emojiKey);
            //     const twemojiCodepoint = twemoji.convert.toCodePoint(emojiValue);
            //     const emojiSvg = fs.readFileSync(`./res/twemoji/${twemojiCodepoint}.svg`);
            //     emojiBuffer = await sharp(emojiSvg).resize(32).toBuffer();
            // } else {
            //     const emoji = await guild.emojis.fetch(dataPoint.emojiKey);
            //     emojiBuffer = await SharpCommon.fetchImage(`${emoji.url}?size=32`);
            // }
            if (dataPoint.emojiValue instanceof GuildEmoji) {
                emojiBuffer = await SharpCommon.fetchImage(
                    `${dataPoint.emojiValue.url}?size=32`
                );
            } else {
                const twemojiCodepoint = twemoji.convert.toCodePoint(
                    dataPoint.emojiValue
                );

                const emojiSvg = await fs.promises
                    .readFile(`./res/twemoji/${twemojiCodepoint}.svg`)
                    .catch(async (error) => {
                        // Try a shorter codepoint
                        const [shorterCodepoint] = twemojiCodepoint.split('-');
                        return await fs.promises
                            .readFile(`./res/twemoji/${shorterCodepoint}.svg`)
                            .catch(() => fs.readFileSync('./res/twemoji/2754.svg'));
                    });
                emojiBuffer = await sharp(emojiSvg).resize(32).toBuffer();
            }

            const [r, g, b] = Array.from(
                await sharp(emojiBuffer).resize(1).raw().toBuffer()
            );

            // const color = PollCommon.isRegionalEmoji(dataPoint.emojiValue)
            //     ? PollConfig.DEFAULT_COLORS[
            //           compositions.length *
            //               Math.floor(PollConfig.DEFAULT_COLORS.length / goodData.length)
            //       ]
            //     : Tools.rgbToHex(r, g, b);

            const color = colors.shift() ?? '#FFFFFF';

            const endAngle = currentAngle + deltaAngle;
            figures.push(this.figure(currentAngle, endAngle, color));
            currentAngle = endAngle;

            if (deltaAngle >= 15) {
                compositions.push({
                    input: emojiBuffer,
                    // Emoji is assumed to be 32x32
                    top: Math.floor(emojiY) - 16,
                    left: Math.floor(emojiX) - 16
                });
            }
        }
        const circle = await sharp(this.toSvg(figures)).toBuffer();
        return await sharp(circle).composite(compositions).toBuffer();
    }
}
