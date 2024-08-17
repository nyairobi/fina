import sharp from 'sharp';
import { SharpCommon } from 'util/SharpCommon';

export class RPSRenderer {
    private static async duelFrame(
        frameFilename: string,
        imageFilename: string,
        color: string
    ) {
        const coloredFrame = await sharp(frameFilename).tint(color).toBuffer();
        return await sharp(coloredFrame)
            .composite([{ input: imageFilename, gravity: 'center' }])
            .toBuffer();
    }

    public static async render(options: {
        pfp1: { url: string; winner: boolean };
        pfp2: { url: string; winner: boolean };
        weapon1: { file: string; color: string };
        weapon2: { file: string; color: string };
        frame: string;
        background: string;
    }) {
        const [{ buffer: pfp1 }, { buffer: pfp2 }, frame1, frame2] = await Promise.all([
            SharpCommon.circle(options.pfp1.url, { includeStar: options.pfp1.winner }),
            SharpCommon.circle(options.pfp2.url, { includeStar: options.pfp2.winner }),
            this.duelFrame(options.frame, options.weapon1.file, options.weapon1.color),
            sharp(
                await this.duelFrame(
                    options.frame,
                    options.weapon2.file,
                    options.weapon2.color
                )
            )
                .flop()
                .toBuffer()
        ]);
        return await sharp(options.background)
            .resize({ width: 450, height: 180 })
            .composite([
                { input: pfp1, left: 5, top: 54 },
                { input: pfp2, left: 450 - 5 - 72, top: 54 },
                { input: frame1, left: 84, top: 42 },
                { input: frame2, left: 450 - 84 - 96, top: 42 },
                { input: './res/rps/vs.png', gravity: 'center' }
            ])
            .toBuffer();
    }
}
