import { DbArcChart } from 'core/Database';
import { FinaCommand } from 'core/FinaCommand';
import { Channel, GuildMember, ThreadChannel } from 'discord.js';
import { ArcTeam } from './ArcCommon';

export enum ArcContestType {
    'Group',
    'Versus'
}

export type ArcChart = DbArcChart & { status: 'ready' | 'banned' | 'picked' };

export type ArcRoundResult = { team: ArcTeam; score: number; shinies: number }[];

export enum ArcContestBanPhaseType {
    Normal = 'Normal',
    Classic = 'Classic',
    FirstPhase = 'First phase',
    None = 'None'
}

export enum ArcContestDifficultyModifierType {
    All = 'All difficulties',
    Past = 'Past only',
    Present = 'Present only',
    Future = 'Future only',
    Beyond = 'Beyond only',
    FutureBeyond = 'Future or Beyond'
}

export enum ArcContestColorModifierTypeCommon {
    None = 'Both',
    Light = 'Light side only',
    Dark = 'Conflict side only',
    LightInvertible = 'Light side or invertible',
    DarkInvertible = 'Conflict side or invertible'
}

export enum ArcContestColorModifierTypeDuel {
    LightAndConflict = 'Light vs Conflict',
    LightAndConflictReverse = 'Light vs Conflict (inverted)'
}

export type ArcContestColorModifierType =
    | ArcContestColorModifierTypeCommon
    | ArcContestColorModifierTypeDuel;

interface ArcSessionDataCommon {
    contestType: ArcContestType;
    banPhase: ArcContestBanPhaseType;
    rounds: number;
    command: FinaCommand;
    difficultyModifier: ArcContestDifficultyModifierType;
    colorModifier: ArcContestColorModifierType;
    rankBy: 'Score' | 'Shiny pures';
}

export interface ArcSessionData extends ArcSessionDataCommon {
    thread: ThreadChannel;
    teams: ArcTeam[];
    charts: ArcChart[];
}

export interface ArcSessionInputData extends ArcSessionDataCommon {
    sourceChannel: Channel;
    teamMembers: GuildMember[][];
    orderBy: string;
    minDifficulty: number;
    maxDifficulty: number;
    chartCount: number;
}

export interface BotArcApiResponse {
    status: number;
    content: object;
}

export interface BotArcApiUserInfoResponse extends BotArcApiResponse {
    status: number;
    content: {
        account_info: {
            code: string;
            name: string;
            user_id: number;
            is_mutual: boolean;
            is_char_uncapped_override: boolean;
            is_char_uncapped: boolean;
            is_skill_sealed: boolean;
            rating: number;
            join_date: number;
            character: number;
        };
        recent_score: [
            {
                score: number;
                health: number;
                ratingh: number;
                song_id: string;
                modifier: number;
                difficulty: number;
                clear_type: number;
                best_clear_type: number;
                time_played: number;
                near_count: number;
                miss_count: number;
                perfect_count: number;
                shiny_perfect_count: number;
            }
        ];
    };
}

export interface LowiroUserInfoResponse {
    data: {
        last_played_song: {
            song_id: string;
            difficulty: number;
            score: number;
            shiny_pure_count: number;
            pure_count: number;
            far_count: number;
            lost_count: number;
            recollection_rate: number;
            time_played: number;
            gauge_type: number;
        };
    };
}

export interface LowiroUserB30Response {
    data: [
        {
            song_id: string;
            difficulty: number;
            score: number;
            shiny_pure_count: number;
            pure_count: number;
            far_count: number;
            lost_count: number;
            recollection_rate: number;
            time_played: number;
            gauge_type: number;
            potential_value: number;
        }
    ];
}
