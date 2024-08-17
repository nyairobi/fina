import { DbArcChart } from 'core/Database';
import { MessageAttachment } from 'discord.js';
import fs from 'fs';
import sharp from 'sharp';
import { ArcChart } from 'commands/arc/base/Types';

export class ArcRendererCard {
    private static readonly _DATA_DURATION = 60_000 * 15;
    private static _data: ReturnType<typeof this.loadData> | undefined;
    private static _timeout: NodeJS.Timeout | undefined;
    private static loadData() {
        return {
            baseSvg: fs.readFileSync('./res/arc/songcell.svg').toString(),
            shadow: fs.readFileSync('./res/arc/shadow.png').toString('base64'),
            cornerDark: fs.readFileSync('./res/arc/corner_dark.png').toString('base64'),
            cornerLight: fs.readFileSync('./res/arc/corner_light.png').toString('base64'),
            cornerColorless: fs
                .readFileSync('./res/arc/corner_colorless.png')
                .toString('base64'),
            backgroundByd: fs.readFileSync('./res/arc/bg_byd.png').toString('base64'),
            backgroundNormal: fs.readFileSync('./res/arc/bg.png').toString('base64'),
            backgroundSpecial: fs
                .readFileSync('./res/arc/bg_special.png')
                .toString('base64'),
            backgroundWorld: fs.readFileSync('./res/arc/bg_world.png').toString('base64'),
            badgeBan: fs.readFileSync('./res/arc/badge_ban.png').toString('base64'),
            badgeClear: fs.readFileSync('./res/arc/badge_pick.png').toString('base64'),
            difficulty: [0, 1, 2, 3].map((tier) =>
                fs.readFileSync(`./res/arc/corner_${tier}.png`).toString('base64')
            )
        };
    }
    private static get data() {
        if (this._data === undefined) {
            this._data = this.loadData();
            if (this._timeout) {
                clearTimeout(this._timeout);
            }
            setTimeout(() => (this._data = undefined), this._DATA_DURATION);
        }
        return this._data;
    }

    private static createSvg(chart: ArcChart) {
        const data = this.data;
        let jacketB64Data: string = '';
        if (chart.coverArt !== null) {
            try {
                jacketB64Data = fs.readFileSync(chart.coverArt).toString('base64');
            } catch (error) {
                jacketB64Data = '';
            }
        }
        return data.baseSvg
            .replaceAll('$title', chart.name)
            .replace(
                '$lightness',
                chart.color === 'DARK'
                    ? data.cornerDark
                    : chart.color === 'LIGHT'
                    ? data.cornerLight
                    : data.cornerColorless
            )
            .replace('$difficulty', data.difficulty[chart.tier])
            .replace('$jacket', jacketB64Data)
            .replace(
                '$background',
                chart.tier === 3
                    ? data.backgroundByd
                    : chart.isWorld
                    ? data.backgroundWorld
                    : chart.packName.startsWith('Arcaea')
                    ? data.backgroundNormal
                    : data.backgroundSpecial
            )
            .replace(
                '$badge',
                chart.status === 'banned'
                    ? data.badgeBan
                    : chart.status === 'picked'
                    ? data.badgeClear
                    : ''
            )
            .replaceAll('$difficultynumber', `${Math.floor(chart.chartConstant / 10.0)}`)
            .replaceAll(
                '$plus',
                chart.chartConstant > 90 && chart.chartConstant % 10 >= 7 ? '+' : ''
            )
            .replace('$shadow', data.shadow);
    }
    public static async render(charts: ArcChart[], chunkLength: number = 5) {
        const bufferPromises = [];
        for (let i = 0; i < Math.ceil(charts.length / chunkLength); ++i) {
            const chunkDbCharts = charts.slice(i * chunkLength, (i + 1) * chunkLength);
            const composition = sharp({
                create: {
                    width: 630,
                    height: (103 + 8) * (chunkLength - 1) + 103,
                    channels: 4,
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                }
            }).png();

            const lines = [];
            for (const chart of chunkDbCharts) {
                lines.push(await sharp(Buffer.from(this.createSvg(chart))).toBuffer());
            }

            bufferPromises.push(
                composition
                    .composite(
                        lines.map((buffer, idx) => {
                            return {
                                input: buffer,
                                left: 0,
                                top: idx * (103 + 8)
                            };
                        })
                    )
                    .toBuffer()
            );
        }
        const buffers = await Promise.all(bufferPromises);
        return buffers.map((buffer, idx) =>
            new MessageAttachment(buffer).setName(`list${idx}.png`)
        );
    }
}

export class ArcRendererCourse {
    private static readonly _DATA_DURATION = 60_000 * 15;
    private static _data: ReturnType<typeof this.loadData> | null = null;
    private static _timeout: NodeJS.Timeout | undefined;
    private static loadData() {
        return {
            baseSvg: fs.readFileSync('./res/arc/dan/course.svg').toString(),
            foregroundDark: fs
                .readFileSync('./res/arc/dan/fg_dark.png')
                .toString('base64'),
            foregroundLight: fs
                .readFileSync('./res/arc/dan/fg_dark.png')
                .toString('base64'),
            difficultyCorner: ['past', 'present', 'future', 'beyond'].map((difficulty) =>
                fs.readFileSync(`./res/arc/dan/diff-${difficulty}.png`).toString('base64')
            )
        };
    }
    private static get data() {
        if (this._data === null) {
            this._data = this.loadData();
            if (this._timeout) {
                clearTimeout(this._timeout);
            }
            setTimeout(() => (this._data = null), this._DATA_DURATION);
        }
        return this._data;
    }

    private static createSvg(title: string, bannerIdx: number, charts: DbArcChart[]) {
        const data = this.data;
        const jacketB64Data: string[] = [];
        let bannerB64Data: string = '';

        bannerB64Data = fs
            .readFileSync(`./res/arc/dan/dan-banner_${bannerIdx}.png`)
            .toString('base64');

        let svg = data.baseSvg
            .replaceAll('$title', title)
            .replace('$fg', bannerIdx < 7 ? data.foregroundLight : data.foregroundDark)
            .replace('$banner', bannerB64Data);

        charts.forEach((chart, idx) => {
            if (chart.coverArt !== null) {
                const coverB64Data = fs.readFileSync(chart.coverArt).toString('base64');
                svg = svg
                    .replace(`$cover${idx + 1}`, coverB64Data)
                    .replace(`$diff${idx + 1}`, data.difficultyCorner[chart.tier]);
            }
        });

        return svg;
    }
    public static async render(title: string, bannerIdx: number, charts: DbArcChart[]) {
        const buffer = await sharp(
            Buffer.from(this.createSvg(title, bannerIdx, charts)),
            { density: 300 }
        ).toBuffer();
        return new MessageAttachment(buffer).setName(`course.png`);
    }
}
