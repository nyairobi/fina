type StringResolvable = string | null | undefined;

/**
 * Helper library-agnostic functions that process a string (non-mutating)
 */
export class StringTools {
    /**
     * All StringTools functions can take a null value for ease of use
     * By convention we don't use if(!str), so this is the replacement
     */
    private static isInvalid(str: StringResolvable): str is null | undefined {
        return str === null || str === undefined || str.length === 0;
    }

    /**
     * Cuts a string if it has too many characters
     * @param str The string
     * @param len The maximum number of characters
     * @returns
     * @see limitLines For multiline strings
     */
    public static trim(str: StringResolvable, len: number) {
        if (this.isInvalid(str)) {
            return '';
        }
        if (str.length > len) {
            str = `${str.slice(0, len - 3)}...`;
        }
        return str;
    }

    /**
     * Formats a string for places with limited space:
     * Cuts it if it has too many lines
     * with optional max line width
     * @param str The string
     * @param maxLines The maximum number of lines
     * @param maxLineWidth The maximum number of characters in a line (default: unlimited)
     * @returns The formatted string
     */
    public static limitLines(
        str: StringResolvable,
        maxLines: number,
        maxLineWidth?: number
    ) {
        if (this.isInvalid(str)) {
            return '';
        }

        const rawLines = str.split('\n');
        let lines: string[];

        if (maxLineWidth === undefined) {
            lines = rawLines;
        } else {
            lines = [];
            for (const rawLine of rawLines) {
                const words = rawLine.split(/\s/gimu);
                let currentLine = '';
                for (const word of words) {
                    if (currentLine.length + word.length + 1 > maxLineWidth) {
                        lines.push(currentLine);
                        currentLine = '';
                    }
                    currentLine += word + ' ';
                }
                lines.push(currentLine);
            }
        }

        if (lines.length > maxLines) {
            lines[maxLines - 1] = lines[maxLines - 1].slice(0, -3) + '...';
        }
        return lines
            .slice(0, maxLines)
            .map((line) => line.trim())
            .join('\n');
    }

    /**
     * Self-explanatory
     * @param str The string
     * @returns The string, capitalized
     */
    public static capitalize(str: StringResolvable) {
        if (this.isInvalid(str)) {
            return '';
        } else {
            return `${str.charAt(0).toUpperCase()}${str.slice(1)}`;
        }
    }

    /**
     * Surrounds a string with the Discord markdown spoiler
     * @param str The String
     * @param isSpoiler If set to false, returns the string unchanged
     * @returns
     */
    public static spoiler(str: StringResolvable, isSpoiler = true) {
        if (this.isInvalid(str)) {
            return '';
        } else if (isSpoiler) {
            return `||${str}||`;
        } else {
            return str;
        }
    }

    /**
     * Ensures a URL is formatted properly
     * @param url The URL
     * @returns The formatted URL
     */
    public static validateURL(url: StringResolvable) {
        if (this.isInvalid(url)) {
            return '';
        } else if (
            url.startsWith('https://') ||
            url.startsWith('http://') ||
            url.startsWith('attachment://')
        ) {
            // Valid URL
            return url;
        } else if (url.search(/\../) === -1) {
            // Completely invalid URL -> Returns a dummy image
            return 'https://cdn.discordapp.com/attachments/391366975936397314/950407658270249010/proxy-image.png';
        } else if (url.startsWith('//')) {
            // Some servers skip the protocol for whatever reason
            return `https:${url}`;
        } else {
            return `https://${url}`;
        }
    }

    /**
     * Hashes a string
     * @param str The string
     * @returns The hash
     * @see http://werxltd.com/wp/2010/05/13/javascript-implementation-of-javas-string-hashcode-method/
     */
    public static hashCode(str: StringResolvable) {
        let hash = 0;
        let chr;
        if (!this.isInvalid(str)) {
            for (let i = 0; i < str.length; ++i) {
                chr = str.charCodeAt(i);
                hash = (hash << 5) - hash + chr;
                hash |= 0; // Convert to 32bit integer
            }
        }
        return hash;
    }

    /**
     * Returns the first line
     * @param str
     * @returns
     * @see limitLines
     */
    public static firstLine(str: StringResolvable) {
        if (this.isInvalid(str)) {
            return '';
        }

        const delim = str.indexOf('\n');

        if (delim >= 0) {
            return str.slice(0, delim);
        } else {
            return str;
        }
    }

    /**
     * Like String.prototype.split(), but doesn't discard the remainder once the limit has been reached,
     * Instead leaving the remainder in the last element
     * @param str The string
     * @param delim The delimiter
     * @param limit The maximum number of substrings
     * @returns The split string
     */
    public static properSplit(str: StringResolvable, delim: string, limit: number) {
        if (this.isInvalid(str)) {
            return [];
        }

        const split = str.split(delim);

        if (split.length <= limit) {
            return split;
        } else {
            return [...split.slice(0, limit - 1), split.slice(limit - 1).join(delim)];
        }
    }
}
