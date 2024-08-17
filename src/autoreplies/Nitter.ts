import { Message } from 'discord.js';
import { StringTools } from 'util/StringTools';

const DEFINITIONS: [RegExp, string][] = [
    [/twitter\.com/, 'nitter.net'],
    [/youtu(?:be\.com|\.be)/, 'yewtu.be'],
    [/(?:(?:old|new)\.)?reddit.com/, 'teddit.net']
];

const generateRegex = (domain: RegExp) => {
    return new RegExp(
        `(?:https:\\/\\/)?(www\\.)?` + domain.source + `\/[^\\s>]*(?=\\s|$|>)`,
        'gu'
    );
};

const __domains = DEFINITIONS.map(([domain, target]) => {
    return {
        domain,
        target,
        regex: generateRegex(domain)
    };
});

export const nitter = {
    description: 'Converts Twitter links to Nitter',
    pingReply: true,
    keys: ['ninja.nairobi.auto.nitter'],
    process: (message: Message) => {
        let res = '';
        for (const { domain, target, regex } of __domains) {
            const matches = message.content.match(regex);
            for (const match of matches ?? []) {
                res += `<${StringTools.validateURL(match.replace(domain, target))}>\n`;
            }
        }
        return res || undefined;
    }
};
