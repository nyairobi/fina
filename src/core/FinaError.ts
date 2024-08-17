import { APIMessage } from 'discord-api-types/v9';
import { DiscordAPIError, Message } from 'discord.js';
import Tools from 'util/Tools';

// Note from the future (2024): 
// This bit really trusts Google to keep Tenor alive
// Lol
// This was made before gfycat's sudden death
const ErrorGif = {
    dead: ['https://c.tenor.com/TgPXdDAfIeIAAAAd/gawr-gura-gura.gif'],
    angry: [
        'https://c.tenor.com/LxKt9arGYTwAAAAS/klee-genshin-impact.gif',
        'https://c.tenor.com/NVkIyK2MC8kAAAAd/anime-girl.gif',
        'https://c.tenor.com/Lmt2O6cauX8AAAAS/anime-cute.gif'
    ],
    permissions: ['https://c.tenor.com/ab5hKUJO-kIAAAAC/no-horny-gura.gif']
};

interface FinaErrorOptions {
    message?: string;
    details?: string | Error;
    gif?: keyof typeof ErrorGif;
}

export class FinaError extends Error {
    private _errorOptions: FinaErrorOptions;

    public constructor(errorOptions: FinaErrorOptions) {
        if (errorOptions.details instanceof Error) {
            super(errorOptions.details.message);
        } else {
            super(errorOptions.details || errorOptions.message || 'Unknown error');
        }
        this._errorOptions = errorOptions;
    }

    public toString() {
        return (
            this._errorOptions.details ?? this._errorOptions.message ?? 'Unknown error'
        );
    }

    public get replyMessage() {
        return this._errorOptions.message ?? 'Unknown error';
    }

    public get details() {
        return this._errorOptions.details;
    }

    public get gif() {
        if (this._errorOptions.gif !== undefined) {
            return Tools.randomArrayElement(ErrorGif[this._errorOptions.gif]);
        } else {
            return '';
        }
    }

    public static from(error: unknown) {
        if (error instanceof FinaError) {
            return error;
        } else if (this.isPermissionError(error)) {
            return new FinaError({
                message: 'Missing an unknown Discord permission (this is a bug)',
                details: error,
                gif: 'dead'
            });
        } else if (typeof error === 'string' || error instanceof Error) {
            return new FinaError({
                message: 'Unknown error',
                details: error,
                gif: 'dead'
            });
        } else {
            return new FinaError({
                message: 'Unknown error',
                details: `${error}`,
                gif: 'dead'
            });
        }
    }

    public static finassert(
        predicate: boolean,
        errorOptions: FinaErrorOptions
    ): asserts predicate {
        if (!predicate) {
            throw new FinaError(errorOptions);
        }
    }

    public static permission(permissionName: string, local: boolean) {
        return (error: unknown) => {
            if (this.isPermissionError(error)) {
                throw new FinaError({
                    message: `Missing ${permissionName} permission ${
                        local ? 'in the target channel' : ''
                    },`,
                    gif: 'permissions'
                });
            } else {
                throw error;
            }
        };
    }

    public static isErrorOptions(error: unknown): error is FinaErrorOptions {
        if (typeof error === 'object') {
            return error !== null && ('message' in error || 'details' in error);
        } else {
            return false;
        }
    }

    public static isPermissionError(error: unknown): error is DiscordAPIError {
        return (
            error instanceof DiscordAPIError && error.message === 'Missing Permissions'
        );
    }
}

export const finassert: (
    predicate: boolean,
    errorOptions: FinaErrorOptions
) => asserts predicate = FinaError.finassert;

export function finassertMessage(
    message: Message | APIMessage
): asserts message is Message {
    finassert(message instanceof Message, {
        message: 'Invalid Message',
        details: `APIMessage: ${message}`
    });
}
