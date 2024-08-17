import fetch from 'node-fetch';
import sharp from 'sharp';
import { StringTools } from './StringTools';

export class SharpCommon {
    /**
     * Fetch image
     * @param imageURL URL of the image
     * @returns A buffer containing image data
     */
    public static async fetchImage(imageURL: string) {
        const response = await fetch(StringTools.validateURL(imageURL));
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    }

    /**
     * Crop the picture to a square
     * @param imageURL URL of the image
     * @param size The desired width/height (default: max)
     * @returns A buffer with the cropped image
     */
    public static async squareCrop(imageURL: string, size?: number) {
        const imageBuffer = await this.fetchImage(imageURL);
        const sh = sharp(imageBuffer);
        if (size === undefined) {
            const info = (await sh.toBuffer({ resolveWithObject: true })).info;
            size = Math.min(info.width, info.height);
        }
        return await sh.resize({ width: size, height: size, position: 'top' }).toBuffer();
    }
    /**
     * Crop if the picture is horizontal, and resize
     * (Vertical images look good in thumbnails so they shouldn't be cropped)
     * @param imageURL The url
     * @param size Target image height
     * @returns Image buffer
     */
    public static async squareCropHorizontal(imageURL: string, size: number) {
        const imageBuffer = await this.fetchImage(imageURL);
        const sh = sharp(imageBuffer);
        const info = (await sh.toBuffer({ resolveWithObject: true })).info;
        if (info.width > info.height) {
            return await sh
                .resize({ width: size, height: size, position: 'top' })
                .toBuffer();
        } else {
            return await sh.resize(size).toBuffer();
        }
    }

    public static async resize(imageURL: string, size: number) {
        const imageBuffer = await this.fetchImage(imageURL);
        return await sharp(imageBuffer).resize(size).toBuffer();
    }

    public static async circle(
        imageURL: string,
        options?: {
            size?: number;
            includeStar?: boolean;
            allowAnimation?: boolean;
            animatedSize?: number;
        }
    ) {
        const imageBuffer = await this.fetchImage(imageURL);
        let animated = false;
        let frameCount = 1;
        if (options?.allowAnimation) {
            frameCount =
                (await sharp(imageBuffer, { animated: true }).metadata()).pages || 1;
            animated = frameCount > 1;
        }
        const size =
            (animated ? options?.animatedSize || options?.size : options?.size) || 72;

        const circleBuffer = Buffer.from(
            `<svg><rect x="0" y="0" width="${size}px" height="${size}px" rx="${
                size / 2
            }" ry="${size / 2}"/></svg>`
        );

        const image = sharp(imageBuffer, { animated }).resize({
            width: size,
            height: size * frameCount
        });
        let format = '';
        if (animated) {
            image.gif({ pageHeight: size });
            format = 'gif';
        } else {
            image.png();
            format = 'png';
        }
        let resBuffer = await sharp(await image.toBuffer(), { animated })
            .composite([
                { input: circleBuffer, blend: 'dest-in', tile: true, gravity: 'south' }
            ])
            .toBuffer();
        if (options?.includeStar) {
            // TODO star kinda assumes the gif is 72px
            return {
                buffer: await sharp(resBuffer, { animated })
                    .composite([
                        { input: './res/rps/star.png', gravity: 'southeast', tile: true }
                    ])
                    .toBuffer(),
                format
            };
        } else {
            return {
                buffer: resBuffer,
                format
            };
        }
    }
}
