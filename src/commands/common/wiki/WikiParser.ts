import { finassert } from 'core/FinaError';
import { FinaError } from 'core/FinaError';
import { EmbedFieldData, MessageAttachment } from 'discord.js';
import { SharpCommon } from 'util/SharpCommon';
import { StringTools } from 'util/StringTools';
import parse from 'node-html-parser';
import fetch from 'node-fetch';
import { FinaReplyOptions } from 'core/FinaReplyOptions';

interface Infobox {
    text?: string;
    imageURL?: string;
    fields: EmbedFieldData[];
}

interface SiteInfo {
    sitename?: string;
    logo?: string;
}

export type WikiParseType = 'brief' | 'wiktionary';

export class WikiParser {
    private _apiUrl: string;
    private _siteInfo: SiteInfo;

    public constructor(apiUrl: string) {
        this._apiUrl = StringTools.validateURL(apiUrl);
        this._siteInfo = {};
    }

    public async init() {
        const response = await this.query({
            action: 'query',
            meta: 'siteinfo',
            siprop: 'general'
        });
        const result = response?.query?.general || {};
        this._siteInfo = result;
    }

    private urlToTitle(url: string) {
        // Turn a URL into a pagename
        return url.replace(
            /[^\/\n]*\/\/[^\.\/]+\.[^\.\/]+\.?[^\.\/]*\/(..\/)?(wiki\/)?/gu,
            ''
        );
    }

    public async query(params: object) {
        let url = `${this._apiUrl.trim()}?origin=*`;

        for (const [k, v] of Object.entries(params)) {
            url += '&' + k + '=' + v;
        }
        url += '&formatversion=2&format=json';

        // Logger.debug(url);

        try {
            const response = await (await fetch(url)).json();
            return response || {};
        } catch (error) {
            throw new FinaError({
                message: 'Unable to query the wiki',
                details: error as any,
                gif: 'dead'
            });
        }
    }

    public async parseWiktionary(title: string): Promise<Infobox> {
        const HEADLINE_WHITELIST = [
            'Etymology',
            'Noun',
            'Verb',
            'Adverb',
            'Adjective',
            'Pronoun',
            'Interjection',
            'Proverb',
            'Phrase',
            'Proper noun'
        ];
        const sections = await this.query({
            action: 'parse',
            page: this.urlToTitle(title),
            redirects: 1,
            prop: 'sections'
        });

        finassert(
            sections != null && sections.parse != null && sections.parse.sections != null,
            {
                message: 'This page could not be found'
            }
        );

        const sectionId = parseInt(
            sections.parse.sections.find((section: any) => section.anchor === 'English')
                ?.index
        );

        const response = await this.query({
            action: 'parse',
            page: title,
            redirects: 1,
            section: sectionId
        });

        if (response.parse == null || response.parse.text == null) {
            return {
                text: 'This word has no english definition',
                fields: []
            };
        }

        const root = parse(response.parse.text, { comment: false });
        const fields: EmbedFieldData[] = [];
        const referencesRegex = /\[[a-z0-9]+\]/gimu;

        for (const headline of root.querySelectorAll('h3, h4')) {
            const headlineName = headline.querySelector('.mw-headline')?.textContent;
            if (
                headlineName !==
                undefined /* && HEADLINE_WHITELIST.includes(headlineName)*/
            ) {
                const description = headline.nextElementSibling;
                const list = headline.nextElementSibling.nextElementSibling;

                let value = '';
                if (description.tagName === 'P') {
                    value += `*${description.structuredText}*\n`;
                }
                if (list != null && list.tagName === 'OL') {
                    const lis = list.querySelectorAll('> li');
                    let i = 0;
                    for (const li of lis) {
                        for (const child of li.getElementsByTagName('*')) {
                            if (
                                ![
                                    'A',
                                    'P',
                                    'SPAN',
                                    'DIV',
                                    'ASIDE',
                                    'I',
                                    'B',
                                    'STRONG',
                                    'EM'
                                ].includes(child.tagName)
                            ) {
                                child.innerHTML = '';
                            }
                        }
                        const text = li.structuredText.trim();
                        if (text.length > 0) {
                            value += `**${++i}.** ${text}\n`;
                        }
                    }
                }
                if (value.length > 0) {
                    fields.push({
                        name: headlineName,
                        value: StringTools.trim(
                            value.replace(referencesRegex, '') || '*No description*',
                            1024
                        )
                    });
                }
            }
        }

        return {
            fields
        };
    }

    public async parseInfobox(title: string): Promise<Infobox> {
        const FIELDS_COUNT = 9; // No more than 19 because 20 is the API limit (and description will be added later)
        const response = await this.query({
            action: 'parse',
            page: title,
            redirects: 1,
            section: 0
        });

        let result: Infobox = { text: '', fields: [] };

        if (response == null || response.parse == null || response.parse.text == null) {
            return result;
        }

        const root = parse(response.parse.text); //, { comment: false });
        const referencesRegex = /\[[a-z0-9]+\]/gimu;

        for (const paragraph of root.querySelectorAll('.mw-parser-output > p')) {
            //paragraph.childNodes = [];
            if (paragraph.querySelector('aside') !== null) {
                continue;
            }
            const text = paragraph.structuredText;
            if (text.length > 0) {
                result.text += text + '\n';
            }
        }
        if (result.text?.length === 0) {
            result.text = '*No description*';
        } else {
            result.text = StringTools.trim(
                (result.text || '').replace(referencesRegex, '').trim(),
                300
            );
        }

        const classicInfobox = root.querySelector('.infobox');
        if (classicInfobox !== null) {
            for (const tr of classicInfobox.querySelectorAll('tr')) {
                const td = tr.querySelectorAll('th').concat(tr.querySelectorAll('td'));
                if (td.length === 2) {
                    const name = td[0].text.replace(referencesRegex, '').trim();
                    const value = StringTools.limitLines(
                        td[1].structuredText.replace(referencesRegex, ''),
                        3,
                        20
                    );
                    if (name.length > 0 && value.length > 0) {
                        result.fields.push({
                            name,
                            value,
                            inline: true
                        });
                        if (result.fields.length == FIELDS_COUNT) {
                            break;
                        }
                    }
                } else {
                    const img = tr.querySelector('img')?.getAttribute('src');
                    if (img !== undefined) {
                        result.imageURL = img;
                    }
                }
            }
        } else {
            // Wikia's portable infobox
            const portableInfobox = root.querySelector('.portable-infobox');
            if (portableInfobox !== null) {
                result.imageURL = portableInfobox
                    .querySelector('.pi-image-thumbnail')
                    ?.getAttribute('src');

                // If there is a tabber inside the infobox, only take the first tab
                const firstTab =
                    portableInfobox.querySelector('.wds-tab__content') ?? portableInfobox;

                // This is to make it work with horizontal infoboxes which are like
                // <tr>(header1) (header2) (header3)</tr><tr>(value1) (value2) (value3)</tr>
                const labels = firstTab.querySelectorAll('.pi-data-label');
                const values = firstTab.querySelectorAll('.pi-data-value');

                if (labels.length === values.length) {
                    for (let i = 0; i < labels.length; ++i) {
                        const label = labels[i].text.replace(referencesRegex, '');
                        const value = values[i].structuredText.replace(
                            referencesRegex,
                            ''
                        );

                        if (
                            label !== undefined &&
                            value !== undefined &&
                            label.length > 0 &&
                            value.length > 0
                        ) {
                            result.fields.push({
                                name: label,
                                value: StringTools.limitLines(value, 3, 20),
                                inline: true
                            });
                            if (result.fields.length == FIELDS_COUNT) {
                                break;
                            }
                        }
                    }
                }

                // for (const piData of firstTab.querySelectorAll('.pi-data')) {
                //     const label = piData
                //         .querySelector('.pi-data-label')
                //         ?.text.replace(referencesRegex, '');
                //     const value = piData
                //         .querySelector('.pi-data-value')
                //         ?.structuredText.replace(referencesRegex, '');
                //     if (
                //         label !== undefined &&
                //         value !== undefined &&
                //         label.length > 0 &&
                //         value.length > 0
                //     ) {
                //         result.fields.push({
                //             name: label,
                //             value: StringTools.limitLines(value, 3, 20),
                //             inline: true
                //         });
                //         if (result.fields.length == FIELDS_COUNT) {
                //             break;
                //         }
                //     }
                // }
            }
        }

        if (result.imageURL?.startsWith('/') && !result.imageURL.startsWith('//')) {
            result.imageURL = `${this._apiUrl.slice(
                0,
                this._apiUrl.indexOf('/', 8 /* skip https:// */)
            )}${result.imageURL}`;
        }
        return result;
    }

    public getSiteInfo(): SiteInfo {
        return this._siteInfo;
    }

    public async checkExistence(title: string) {
        const response = await this.query({
            action: 'parse',
            prop: '',
            page: title

            // TODO use this to limit the number of api calls
            // action: 'parse',
            // section: 0,
            // redirects: true,
            // prop: 'categories|text',
            // page: title
        });

        return response?.parse !== undefined;
    }

    /**
     * @see https://www.mediawiki.org/wiki/API:Opensearch
     * @returns A non-empty array of results
     */
    public async search(title: string, count: number) {
        const response = await this.query({
            action: 'opensearch',
            search: title,
            limit: count,
            namespace: '0',
            redirects: 'resolve',
            format: 'json',
            profile: 'fuzzy'
        });

        finassert(Array.isArray(response), {
            message: 'Wiki query returned an unexpected result',
            gif: 'dead'
        });

        /** query, titles, <EMPTY>, urls */
        const titles: string[] = response[1];
        const urls: string[] = response[3];

        finassert(titles.length > 0, {
            message: 'This page could not be found',
            gif: 'dead'
        });

        const results = titles.map((title, idx) => {
            return { title, url: urls[idx] };
        });

        const exactMatch = results.find((result) => {
            result.title.toLowerCase() === title.toLowerCase();
        });

        return exactMatch !== undefined ? [exactMatch] : results;
    }

    public async isDisambig(title: string) {
        const response = await this.query({
            action: 'query',
            titles: this.urlToTitle(title),
            redirects: 1,
            prop: 'pageprops',
            ppprop: 'disambiguation'
        });

        return response?.query?.pages?.at(0)?.pageprops?.disambiguation === '' || false;
    }

    // export const getExtract = async (this._apiUrl: string, title: string) => {
    //     const response = await query(this._apiUrl, {
    //         action: 'query',
    //         prop: 'extracts',
    //         exchars: '300',
    //         exlimit: '1',
    //         titles: title,
    //         explaintext: 1,
    //         exsectionformat: 'plain'
    //     });

    //     const extract = response?.query?.pages[0]?.extract;

    //     finassert(typeof extract === 'string', {
    //         message: 'Unable to read page contents',
    //         gif: 'dead'
    //     });

    //     return extract.slice(0, extract.indexOf('\n\n\n'));
    // };

    // export const getImage = async (this._apiUrl: string, image: string) => {
    //     const response = await query(this._apiUrl, {
    //         action: 'query',
    //         titles: `File:${image}`,
    //         redirects: 1,
    //         prop: 'imageinfo',
    //         iiprop: 'url'
    //     });

    //     return response?.query?.pages?.at(0)?.imageinfo?.at(0)?.url || '';
    // };

    public async getWikitext(title: string) {
        const response = await this.query({
            action: 'query',
            titles: this.urlToTitle(title),
            rvslots: '*',
            rvprop: 'content',
            redirects: 1,
            prop: 'revisions'
        });

        const page = response?.query?.pages?.at(0);

        finassert(page != null, {
            message: 'Unable to read page contents',
            gif: 'dead'
        });

        return page.revisions[0].slots.main.content;
    }

    public async printPageContent(title: string, parseType: WikiParseType) {
        title = this.urlToTitle(title);
        const [response, infobox] = await Promise.all([
            this.query({
                action: 'query',
                titles: title,
                // rvslots: '*',
                // rvprop: 'content',
                redirects: 1,
                prop: 'categories|info',
                // prop: 'revisions|categories|info|images',
                inprop: 'url'
            }),
            parseType === 'brief' ? this.parseInfobox(title) : this.parseWiktionary(title)
        ]);

        const page = response?.query?.pages?.at(0);

        const toFragment =
            (response?.query?.redirects?.at(0)?.tofragment as string) || null;

        finassert(page != null, {
            message: 'Unable to read page contents',
            gif: 'dead'
        });

        // const wikitext: string = page.revisions[0].slots.main.content;

        // const matches = Array.from(wikitext.matchAll(/image\s*=\s*(.*)\n/gimu))[0];
        // const image = matches != null && matches.length >= 2 ? matches[1] : null;

        let thumbnail = '';

        // if (image != null) {
        //     thumbnail = await getImage(this._apiUrl, image);
        // }

        if (thumbnail == '') {
            thumbnail = this._siteInfo.logo || '';
        }

        const isSpoiler = Array.isArray(page.categories)
            ? page.categories.find(
                  (category: any) => category.title.toLowerCase().indexOf('spoiler') >= 0
              ) !== undefined
            : false;

        let content = '';

        if (toFragment !== null) {
            // TODO use the HTML version instead...
            // const regex = new RegExp(
            //     `===?\\s*${toFragment}\\s*===?.*\\n+(.*)\\n`,
            //     'gimu'
            // );
            // const matches = Array.from(wikitext.matchAll(regex));
            // if (matches[0] != null && matches[0][1] != null) {
            //     content = StringTools.trim(
            //         matches[0][1],
            //         300
            //     );
            // }
            content = `This is a section of the article ${page.title}.`;
        } else {
            content = infobox.text || ''; //await getExtract(this._apiUrl, page.title);
        }

        content = StringTools.spoiler(content, isSpoiler) + '\n\n[Page link]';
        if (toFragment !== null) {
            // The ) replace is Discord Android bug workaround
            content += `(${page.fullurl.replace(')', '%29')}#${toFragment})`.replace(
                / /g,
                '_'
            );
        } else {
            content += `(${page.fullurl.replace(')', '%29')})`.replace(/ /g, '_');
        }

        let result: FinaReplyOptions = {
            author: {
                name: this._siteInfo.sitename,
                url: page.fullurl
            },
            title: StringTools.spoiler(toFragment || page.title, isSpoiler),
            thumbnail: { url: thumbnail }
        };

        if (infobox.imageURL !== undefined && !isSpoiler) {
            let filename = infobox.imageURL!.slice(infobox.imageURL!.lastIndexOf('.'));
            const filenameSlash = filename.indexOf('/');
            if (filenameSlash < 0) {
                filename = `thumb${filename}`;
            } else {
                filename = `thumb${filename.slice(0, filenameSlash)}`;
            }

            const attachment = new MessageAttachment(
                await SharpCommon.squareCropHorizontal(infobox.imageURL, 200),
                filename
            );
            result.files = [attachment];
            result.thumbnail = { url: `attachment://${filename}` };
        }
        if (infobox.fields.length > 0) {
            for (const field of infobox.fields) {
                field.value = StringTools.spoiler(field.value, isSpoiler);
            }
            if (infobox.text !== undefined && infobox.text.length > 0) {
                infobox.fields.push({
                    name: 'Description',
                    value: content,
                    inline: false
                });
            } else {
                // No text? Add page link as description, not a field
                result.content = content;
            }
            result.fields = infobox.fields;
        } else {
            result.content = content;
        }

        return result;
    }

    public async autocomplete(
        input: string,
        options: { count: number; skipDisambigCheck?: boolean }
    ) {
        const searchResults = await this.search(input, options.count);

        if (!options.skipDisambigCheck) {
            const promises: Promise<void>[] = [];

            for (const result of searchResults) {
                promises.push(
                    (async () => {
                        if (await this.isDisambig(result.url)) {
                            result.url = '';
                        }
                    })()
                );
            }

            await Promise.all(promises);
        }

        return searchResults
            .filter((result) => result.url !== '')
            .map((result) => {
                return { name: result.title, value: result.url };
            });
    }
}
