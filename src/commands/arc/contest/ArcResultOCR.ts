// import { BaseReply, IModalCommand } from 'core/FinaCommand';
// import { FinaCommandBuilder, FinaCommandResolvable } from 'core/FinaCommandBuilder';
// import { finassert } from 'core/FinaError';
// import { Logger } from 'core/Logger';
// import { FinaCommandInteraction, FinaModalInteraction } from 'core/Types';
// import {
//     Collection,
//     MessageActionRow,
//     MessageAttachment,
//     Modal,
//     TextInputComponent
// } from 'discord.js';
// import { TextInputStyles } from 'discord.js/typings/enums';
// import Fuse from 'fuse.js';
// import sharp from 'sharp';
// import { createWorker } from 'tesseract.js';
// import { SharpCommon } from 'util/SharpCommon';
// import Tools from 'util/Tools';
// import { ArcRoundResult, ArcTeam } from '../base/ArcCommon';
// import { ArcSessionManager } from './ArcSession';
// import { ArcSessionBasedCommand } from './ArcSessionBasedCommand';

// export class ArcResultOCR extends ArcSessionBasedCommand implements IModalCommand {
//     private _ocrWorker: Tesseract.Worker;

//     public constructor() {
//         super('ninja.nairobi.arc.result');
//         this.keys = ['ninja.nairobi.arc.contest'];

//         this._ocrWorker = createWorker();
//         this.initOCR();
//     }

//     private async initOCR() {
//         await this._ocrWorker.load();
//         await this._ocrWorker.loadLanguage('eng');
//         await this._ocrWorker.initialize('eng');
//         await this._ocrWorker.setParameters({
//             tessedit_char_whitelist:
//                 'abcdefghijkmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ23456789'
//         });
//     }

//     public createCommands(): FinaCommandResolvable {
//         return [
//             new FinaCommandBuilder(this)
//                 .setName('arc-result')
//                 .setDescription('Sends a result of the contest'),
//             new FinaCommandBuilder(this)
//                 .setName('arc-result-from-screenshot')
//                 .setDescription('Sends a result of the contest')
//                 .addOption({
//                     name: 'attachment',
//                     description: 'Screenshot of the result screen',
//                     type: 'Attachment',
//                     required: true
//                 })
//         ];
//     }

//     private async getResultsFromAttachment(
//         teams: ArcTeam[],
//         attachment: MessageAttachment | null
//     ): Promise<ArcRoundResult> {
//         const results = [];
//         if (attachment !== null) {
//             finassert(
//                 teams.every((team) => team.single),
//                 { message: "Attachments don't work in group matches" }
//             );
//             const arcaeaUsernames = ArcTeam.allContestants(teams).map(
//                 (contestant) => contestant.arcName
//             );
//             const arcaeaUsernamesOrdered: string[] = await this.ocr(
//                 arcaeaUsernames,
//                 attachment.url
//             );
//             for (const arcaeaUsername of arcaeaUsernamesOrdered) {
//                 const team = teams.find((team) => team.hasUser(arcaeaUsername));
//                 finassert(team !== undefined, {});
//                 results.push({ team });
//             }
//         }
//         return results;
//     }

//     public async process(
//         reply: BaseReply,
//         interaction: FinaCommandInteraction
//     ): Promise<void> {
//         const attachment = interaction.options.getAttachment('attachment');
//         const arcSession = ArcSessionManager.get(interaction.channelId);
//         const teams = arcSession.teams;

//         finassert(arcSession.awaitingResults, {
//             message: 'This session is not awaiting results'
//         });

//         const roundResults = await this.getResultsFromAttachment(teams, attachment);

//         if (roundResults.length === 0) {
//             const rows = [];
//             const isSingle = teams.every((team) => team.single);
//             const contestants = ArcTeam.allContestants(teams);
//             for (const contestant of contestants) {
//                 rows.push(
//                     new MessageActionRow().addComponents(
//                         new TextInputComponent()
//                             .setCustomId(contestant.userId)
//                             .setMinLength(1)
//                             .setMaxLength(isSingle ? 1 : 10)
//                             .setLabel(contestant.arcName)
//                             .setPlaceholder(
//                                 isSingle ? `1-${contestants.length}` : "10'000'000"
//                             )
//                             .setStyle(TextInputStyles.SHORT)
//                     )
//                 );
//             }
//             const modal = new Modal()
//                 .setCustomId(isSingle ? 'placements' : 'scores')
//                 .setTitle('Results')
//                 .addComponents(...rows);
//             await reply({
//                 modal
//             });
//         } else {
//             await arcSession.addResults(reply, roundResults, attachment);
//         }
//     }

//     public async processModal(
//         reply: BaseReply,
//         interaction: FinaModalInteraction
//     ): Promise<void> {
//         const arcSession = ArcSessionManager.get(interaction.channel.id);

//         finassert(arcSession.awaitingResults, {
//             message: 'This session is not awaiting results'
//         });

//         const teams = arcSession.teams;
//         const textInputs = interaction.components.map((row) => row.components[0]);
//         const roundResults: ArcRoundResult = [];

//         if (interaction.customId === 'placements') {
//             finassert(
//                 textInputs.every(
//                     (textInput) =>
//                         textInput.value[0] >= '1' &&
//                         textInput.value[0] <= `${textInputs.length}`
//                 ),
//                 { message: `Results must be numbers (1-${textInputs.length})` }
//             );

//             finassert(
//                 !Tools.hasDuplicates(textInputs.map((textInput) => textInput.value)),
//                 {
//                     message: 'You have to resolve the tie'
//                 }
//             );

//             textInputs.sort((a, b) => parseInt(a.value) - parseInt(b.value));

//             textInputs.forEach((textInput) => {
//                 const team = teams.find((team) =>
//                     team.userIds.includes(textInput.customId)
//                 );

//                 finassert(team !== undefined, {
//                     message: `Unable to find ${textInput.customId}`
//                 });

//                 roundResults.push({ team });
//             });
//         } else {
//             const results = new Collection<ArcTeam, number[]>();

//             textInputs.forEach((textInput) => {
//                 const team = teams.find((team) =>
//                     team.userIds.includes(textInput.customId)
//                 );

//                 finassert(team !== undefined, {
//                     message: `Unable to find <@${textInput.customId}>'s team`
//                 });

//                 const thisScore = parseInt(textInput.value.replace(/[^0-9]/g, ''));
//                 results.ensure(team, () => []).push(thisScore);
//             });

//             results.sort(
//                 (a, b) =>
//                     b.reduce(Tools.sum) - a.reduce(Tools.sum) ||
//                     Math.max(...b) - Math.max(...a)
//             );

//             for (const [team, scores] of results.entries()) {
//                 roundResults.push({ team, score: scores.reduce(Tools.sum) });
//             }
//         }

//         await arcSession.addResults(reply, roundResults, null);
//     }

//     private async ocrPass(usernames: string[], imageURL: string, region: sharp.Region) {
//         const sourceImage = sharp(await SharpCommon.fetchImage(imageURL));
//         // const editedUsernames = [];

//         // for (const username of usernames) {
//         //     editedUsernames.push(username.replaceAll('0', 'O')); //.replace(/l|1/g, 'I'));
//         // }

//         const metadata = await sourceImage.metadata();

//         if (metadata.width === undefined || metadata.height === undefined) {
//             return [];
//         }

//         const deepfriedImage = sourceImage
//             .extract({
//                 left: metadata.width / 2 + region.left,
//                 top: metadata.height / 2 + region.top,
//                 width: region.width,
//                 height: region.height
//             })
//             .threshold(192);

//         const negatedImage = sharp(await deepfriedImage.toBuffer()).negate({
//             alpha: false
//         });

//         const {
//             data: { text }
//         } = await this._ocrWorker.recognize(await negatedImage.toBuffer());

//         sharp(await deepfriedImage.toBuffer()).toFile(
//             Math.floor(Math.random() * 10000.0).toString() + imageURL.slice(-8)
//         );

//         Logger.debug(`OCR result:\n${text}`);

//         const fuse = new Fuse(text.split('\n'), {
//             threshold: 0.7,
//             shouldSort: true,
//             ignoreLocation: true
//         });

//         const searchResults = [];
//         for (let i = 0; i < usernames.length; ++i) {
//             const username = usernames[i];
//             // const editedUsername = editedUsernames[i];
//             const fuseResults = fuse.search(username);
//             if (fuseResults.length === 0) {
//                 return [];
//             }
//             const [fuseResult] = fuseResults;
//             searchResults.push({ name: username, pos: fuseResult.refIndex });
//         }

//         // Look for duplicates
//         if (
//             new Set(searchResults.map((result) => result.pos)).size !==
//             searchResults.length
//         ) {
//             return [];
//         }

//         return searchResults.sort((a, b) => a.pos - b.pos).map((value) => value.name);
//     }

//     private async ocr(usernames: string[], imageURL: string) {
//         let pass: string[] = await this.ocrPass(usernames, imageURL, {
//             left: -210 - 50,
//             top: -180,
//             width: 540,
//             height: 200 * usernames.length
//         }).catch(() => []);
//         if (pass.length === 0) {
//             pass = await this.ocrPass(usernames, imageURL, {
//                 left: -210 - 40,
//                 top: -190,
//                 width: 480,
//                 height: 190 * usernames.length
//             }).catch(() => []);
//             finassert(pass.length !== 0, {
//                 message:
//                     'Unable to parse the image. Re-run the command without sending the image'
//             });
//         }
//         return pass;
//     }
// }
