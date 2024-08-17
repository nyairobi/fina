import Database, { DbArcChart, DbArcUser } from 'core/Database';
import { FinaCommand } from 'core/FinaCommand';
import { FinaError } from 'core/FinaError';
import { Logger } from 'core/Logger';
import { Channel, GuildMember, TextChannel, ThreadChannel } from 'discord.js';
import Tools from 'util/Tools';
import fetch from 'node-fetch';
import { Mutex } from 'async-mutex';
import { Prisma } from '@prisma/client';
import {
    ArcContestColorModifierType,
    ArcContestColorModifierTypeCommon,
    ArcContestColorModifierTypeDuel,
    ArcContestDifficultyModifierType,
    BotArcApiResponse,
    BotArcApiUserInfoResponse,
    LowiroUserB30Response,
    LowiroUserInfoResponse
} from './Types';
import { FinaOptionData } from 'core/FinaOption';

export const localApiMutex = new Mutex();

export class ArcTeam {
    private _contestants: DbArcUser[];
    private _allegiance: 'light' | 'dark' | 'none';

    public constructor(contestants: DbArcUser[]) {
        this._contestants = contestants;
        this._allegiance = 'none';
    }

    public get userIds() {
        return this._contestants.map((contestant) => contestant.userId);
    }

    public get single() {
        return this._contestants.length === 1;
    }

    public get contestants() {
        return this._contestants;
    }

    public get allegiance() {
        return this._allegiance;
    }

    public set allegiance(allegiance: 'light' | 'dark' | 'none') {
        this._allegiance = allegiance;
    }

    public hasUser(arcName: string) {
        return this._contestants.some((contestant) => contestant.arcName === arcName);
    }

    public static pttComparator(a: ArcTeam, b: ArcTeam) {
        return (
            a._contestants.map((u) => u.ptt).reduce(Tools.sum) -
            b._contestants.map((u) => u.ptt).reduce(Tools.sum)
        );
    }

    public static b30Comparator(a: ArcTeam, b: ArcTeam) {
        return (
            a._contestants.map((u) => u.b30 ?? u.ptt).reduce(Tools.sum) -
            b._contestants.map((u) => u.b30 ?? u.ptt).reduce(Tools.sum)
        );
    }

    public static allContestants(teams: ArcTeam[]) {
        return teams.map((team) => team.contestants).flat();
    }

    public toString(separator: string = ', ') {
        return this._contestants
            .map((contestant) => `<@${contestant.userId}>`)
            .join(separator);
    }
}

export class ArcCommon {
    public static async query(
        command: string,
        params: { [key: string]: string | number | boolean },
        api: 'GLOBAL' | 'LOCAL'
    ) {
        if (api === 'LOCAL') {
            await localApiMutex.acquire();
        }

        const server =
            api === 'GLOBAL'
                ? process.env.ARCAPI_SERVER
                : process.env.ARCAPI_SERVER_LOCAL;

        let url = `${server}${command}`;
        let first = true;

        for (const [k, v] of Object.entries(params)) {
            url += `${first ? '?' : '&'}${k}=${v}`;
            first = false;
        }

        Logger.debug(url);

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': process.env.ARCAPI_UA!
                }
            });
            const json = await response.json();
            return json || {};
        } catch (error: unknown) {
            throw new FinaError({
                message: 'Unable to query BotArcApi',
                details: `${error}`,
                gif: 'dead'
            });
        } finally {
            if (api === 'LOCAL') {
                localApiMutex.release();
            }
        }
    }

    // Note from the future (2024): 
    // Tokens were hardcoded as this was hastily put together without loading from .env
    // But also, Arcaea Limited API is dead so, lol
    public static async userInfo616(usercode: string) {
        /* Workaround: it has to be 9-digit
         * Apparently I'm an idiot because I store a 9-digit number as an int */
        usercode = usercode.padStart(9, '0');

        const url = `https://arcaea-limitedapi.lowiro.com/api/v0/user/${usercode}`;

        Logger.debug(url);

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    accept: 'application/json',
                    Authorization: '<redacted>',
                    'X-CSRF-TOKEN': '<redacted>'
                }
            });
            const json = await response.json();
            return json || {};
        } catch (error: unknown) {
            throw new FinaError({
                message: 'Unable to query the Arcaea Limited Api',
                details: `${error}`,
                gif: 'dead'
            });
        }
    }

    public static async b30616(usercode: string) {
        /* Workaround: it has to be 9-digit
         * Apparently I'm an idiot because I store a 9-digit number as an int */
        usercode = usercode.padStart(9, '0');

        const url = `https://arcaea-limitedapi.lowiro.com/api/v0/user/${usercode}/best`;

        Logger.debug(url);

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    accept: 'application/json',
                    Authorization: '<redacted>',
                    'X-CSRF-TOKEN': '<redacted>'
                }
            });
            const json = await response.json();
            return json || {};
        } catch (error: unknown) {
            throw new FinaError({
                message: 'Unable to query the Arcaea Limited Api',
                details: `${error}`,
                gif: 'dead'
            });
        }
    }

    public static isValidResponse(data: unknown): data is BotArcApiResponse {
        if (typeof data === 'object' && data != null) {
            return 'status' in data && (data as any).status === 0;
        } else {
            return false;
        }
    }

    public static isValidUserResponse(data: unknown): data is BotArcApiUserInfoResponse {
        return (
            this.isValidResponse(data) &&
            'account_info' in data.content &&
            'recent_score' in data.content
        );
    }

    public static isValid616UserResponse(data: unknown): data is LowiroUserInfoResponse {
        if (typeof data === 'object' && data != null) {
            return 'data' in data && 'last_played_song' in (data as any).data;
        } else {
            return false;
        }
    }

    public static isValid616B30Response(data: unknown): data is LowiroUserB30Response {
        if (typeof data === 'object' && data != null) {
            return 'data' in data && Array.isArray((data as any).data);
        } else {
            return false;
        }
    }

    public static isLightAndConflict(type: ArcContestColorModifierType) {
        return (
            type === ArcContestColorModifierTypeDuel.LightAndConflict ||
            type === ArcContestColorModifierTypeDuel.LightAndConflictReverse
        );
    }

    public static async getCommonCharts(
        members: { id: string }[],
        minDifficulty: number,
        maxDifficulty: number,
        difficultyModifier: ArcContestDifficultyModifierType,
        colorModifier: ArcContestColorModifierType
    ) {
        const rule: Prisma.ArcChartFindManyArgs = {
            include: {
                ownerships: true
            },
            where: {
                AND: members.map((member) => {
                    return {
                        ownerships: {
                            some: {
                                userId: member.id
                            }
                        }
                    };
                }),
                chartConstant: { gte: minDifficulty, lte: maxDifficulty }
            }
        };

        switch (colorModifier) {
            case ArcContestColorModifierTypeCommon.None:
            case ArcContestColorModifierTypeDuel.LightAndConflict:
            case ArcContestColorModifierTypeDuel.LightAndConflictReverse:
                break;
            case ArcContestColorModifierTypeCommon.Dark:
                rule.where = { ...rule.where, color: 'DARK' };
                break;
            case ArcContestColorModifierTypeCommon.Light:
                rule.where = {
                    ...rule.where,
                    OR: [{ color: 'LIGHT' }, { color: 'COLORLESS' }]
                };
                break;
            case ArcContestColorModifierTypeCommon.LightInvertible:
                rule.where = { ...rule.where, NOT: { lightBg: '' } };
                break;
            case ArcContestColorModifierTypeCommon.DarkInvertible:
                rule.where = { ...rule.where, NOT: { darkBg: '' } };
                break;
            default:
                Logger.warn(`Unknown modifier ${colorModifier}`);
                break;
        }
        switch (difficultyModifier) {
            case ArcContestDifficultyModifierType.All:
                break;
            case ArcContestDifficultyModifierType.Past:
                rule.where = { ...rule.where, tier: 0 };
                break;
            case ArcContestDifficultyModifierType.Present:
                rule.where = { ...rule.where, tier: 1 };
                break;
            case ArcContestDifficultyModifierType.Future:
                rule.where = { ...rule.where, tier: 2 };
                break;
            case ArcContestDifficultyModifierType.Beyond:
                rule.where = { ...rule.where, tier: 3 };
                break;
            case ArcContestDifficultyModifierType.FutureBeyond:
                rule.where = { ...rule.where, tier: { gte: 2 } };
                break;
            default:
                Logger.warn(`Unknown modifier ${difficultyModifier}`);
                break;
        }

        return await Database.arcChart.findMany(rule);
    }

    public static getCommonDifficultyOptions(): FinaOptionData[] {
        return [
            {
                name: 'min-difficulty',
                description: 'Lowest chart difficulty value to choose from (default: 8)',
                type: 'Number',
                required: false,
                choices: [
                    ['1', 10],
                    ['2', 20],
                    ['3', 30],
                    ['4', 40],
                    ['5', 50],
                    ['6', 60],
                    ['7', 70],
                    ['8', 80],
                    ['9', 90],
                    ['9+', 97],
                    ['10', 100],
                    ['10+', 107],
                    ['11', 110],
                    ['12', 120]
                ]
            },
            {
                name: 'max-difficulty',
                description:
                    'Highest chart difficulty value to choose from (default: 12)',
                type: 'Number',
                required: false,
                choices: [
                    ['1', 19],
                    ['2', 29],
                    ['3', 39],
                    ['4', 49],
                    ['5', 59],
                    ['6', 69],
                    ['7', 79],
                    ['8', 89],
                    ['9', 96],
                    ['9+', 99],
                    ['10', 106],
                    ['10+', 109],
                    ['11', 116],
                    ['12', 126]
                ]
            }
        ];
    }

    public static getCommonModifierOptions(isDuel: boolean): FinaOptionData[] {
        const colorChoices: ArcContestColorModifierType[] = Object.values(
            ArcContestColorModifierTypeCommon
        );

        if (isDuel) {
            colorChoices.push(...Object.values(ArcContestColorModifierTypeDuel));
        }
        return [
            {
                name: 'difficulty-modifier',
                description: 'The difficulty type (default: all)',
                type: 'String',
                required: false,
                choices: Object.values(ArcContestDifficultyModifierType)
            },
            {
                name: 'side-modifier',
                description: 'The chart side (default: both)',
                type: 'String',
                required: false,
                choices: colorChoices
            }
        ];
    }
}
